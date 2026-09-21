import * as runtime from '../modules/chrome/runtime.mjs'
import * as storage from '../modules/chrome/storage.mjs'
import { applyFontPreference } from '../modules/appearance.mjs'
import {
    applyFaviconFallback,
    getSiteFaviconFallbackUrl,
    getSiteFaviconUrl,
} from '../modules/favicon.mjs'
import {
    filterArchivePages,
    getArchiveProgress,
    getDisplayUrl,
} from './archiveView.mjs'

const PAGE_SIZE = 100
const UNDO_DURATION = 6000
const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
})

let archivePages = []
let filteredPages = []
let removedPage
let undoTimer
let visibleCount = PAGE_SIZE

document.addEventListener('DOMContentLoaded', init)

async function init () {
    bindEvents()

    try {
        const [pages, options] = await Promise.all([
            storage.local.sortByLatest(),
            storage.getOptions(),
        ])
        applyFontPreference(options)
        archivePages = pages.filter(page => page.url)
        applyFilter()
    } catch (error) {
        console.error('Read Later: unable to load the archive.', error)
        showLoadError()
    }

    requestAnimationFrame(() => document.body.classList.add('is-ready'))
}

function bindEvents () {
    document.querySelector('#archiveSearch').addEventListener('input', () => {
        visibleCount = PAGE_SIZE
        applyFilter()
    })
    document.querySelector('#loadMore').addEventListener('click', () => {
        visibleCount += PAGE_SIZE
        renderArchive()
    })
    document.querySelector('#undoRemove').addEventListener('click', undoRemove)
    document.addEventListener('keydown', handleShortcut)
}

function handleShortcut (event) {
    const search = document.querySelector('#archiveSearch')
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        document.activeElement?.tagName
    )

    if (event.key === '/' && !isTyping) {
        event.preventDefault()
        search.focus()
    } else if (event.key === 'Escape' && search.value) {
        search.value = ''
        visibleCount = PAGE_SIZE
        applyFilter()
        search.focus()
    }
}

function applyFilter () {
    const query = document.querySelector('#archiveSearch').value
    filteredPages = filterArchivePages(archivePages, query)
    renderArchive()
}

function renderArchive () {
    const list = document.querySelector('#archiveList')
    const visiblePages = filteredPages.slice(0, visibleCount)
    const fragment = document.createDocumentFragment()

    visiblePages.forEach(page => fragment.append(createArchiveItem(page)))
    list.replaceChildren(fragment)

    const query = document.querySelector('#archiveSearch').value.trim()
    const emptyState = document.querySelector('#emptyState')
    const isEmpty = filteredPages.length === 0

    emptyState.hidden = !isEmpty
    list.hidden = isEmpty
    updateEmptyState(query)
    updateCounts(query, visiblePages.length)
    updateLoadMore(visiblePages.length)
}

function createArchiveItem (page) {
    const item = document.createElement('li')
    item.className = 'archive-item'

    const favicon = document.createElement('img')
    favicon.className = 'item-favicon'
    favicon.src = getSiteFaviconUrl(page.url) || page.favIconUrl
    favicon.dataset.faviconFallback = getSiteFaviconFallbackUrl(page.url)
    favicon.addEventListener('error', () => applyFaviconFallback(favicon))
    favicon.alt = ''
    favicon.loading = 'lazy'

    const content = document.createElement('div')
    content.className = 'item-content'

    const link = document.createElement('a')
    link.className = 'item-title'
    link.href = page.url
    link.target = '_blank'
    link.rel = 'noreferrer'
    link.textContent = page.title || page.url
    link.addEventListener('click', event => openArchivePage(event, page.url))

    const displayUrl = document.createElement('span')
    displayUrl.className = 'item-url'
    displayUrl.textContent = getDisplayUrl(page.url)

    content.append(link, displayUrl)

    const metadata = document.createElement('div')
    metadata.className = 'item-metadata'

    const savedDate = document.createElement('time')
    savedDate.dateTime = new Date(page.date).toISOString()
    savedDate.textContent = dateFormatter.format(page.date)
    metadata.append(savedDate)

    const progress = getArchiveProgress(page)
    if (progress) {
        const progressLabel = document.createElement('span')
        progressLabel.className = `item-progress ${progress.type}`
        progressLabel.textContent = progress.label
        metadata.append(progressLabel)
    }

    const removeButton = document.createElement('button')
    removeButton.className = 'remove-button'
    removeButton.type = 'button'
    removeButton.textContent = 'Remove'
    removeButton.setAttribute('aria-label', `Remove ${link.textContent} from Archive`)
    removeButton.addEventListener('click', () => removeFromArchive(page, removeButton))

    item.append(favicon, content, metadata, removeButton)
    return item
}

function openArchivePage (event, url) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey
        || event.shiftKey || event.altKey) return

    event.preventDefault()
    runtime.sendMessage({
        message: 'open',
        data:    {
            url,
            currentTab: false,
            active:     true,
            isArchive:  true,
        },
    })
}

async function removeFromArchive (page, button) {
    button.disabled = true

    try {
        await storage.local.remove(page.url)
        archivePages = archivePages.filter(item => item.url !== page.url)
        removedPage = page
        visibleCount = Math.max(PAGE_SIZE, visibleCount - 1)
        applyFilter()
        showUndoToast()
    } catch (error) {
        console.error('Read Later: unable to remove the archived item.', error)
        button.disabled = false
        setPageStatus('Could not remove this item.', 'error')
    }
}

async function undoRemove () {
    if (!removedPage) return

    const page = removedPage
    document.querySelector('#undoRemove').disabled = true

    try {
        await storage.local.set(page)
        archivePages = [...archivePages, page]
            .sort((a, b) => b.date - a.date)
        removedPage = undefined
        hideUndoToast()
        applyFilter()
    } catch (error) {
        console.error('Read Later: unable to restore the archived item.', error)
        setPageStatus('Could not restore this item.', 'error')
    } finally {
        document.querySelector('#undoRemove').disabled = false
    }
}

function showUndoToast () {
    clearTimeout(undoTimer)
    const toast = document.querySelector('#undoToast')
    toast.hidden = false
    requestAnimationFrame(() => toast.classList.add('visible'))
    undoTimer = setTimeout(() => {
        removedPage = undefined
        hideUndoToast()
    }, UNDO_DURATION)
}

function hideUndoToast () {
    clearTimeout(undoTimer)
    const toast = document.querySelector('#undoToast')
    toast.classList.remove('visible')
    setTimeout(() => {
        if (!toast.classList.contains('visible')) toast.hidden = true
    }, 180)
}

function updateCounts (query, visibleItems) {
    const total = archivePages.length
    const matching = filteredPages.length
    const itemLabel = total === 1 ? 'item' : 'items'
    document.querySelector('#archiveCount').textContent = `${total} ${itemLabel}`
    document.title = `Archive (${total}) · Read Later`

    const summary = query
        ? `${matching} matching ${matching === 1 ? 'item' : 'items'}`
        : matching > visibleItems
            ? `Showing ${visibleItems} of ${matching}`
            : ''
    document.querySelector('#resultSummary').textContent = summary
}

function updateLoadMore (visibleItems) {
    const button = document.querySelector('#loadMore')
    const remaining = filteredPages.length - visibleItems
    button.hidden = remaining <= 0
    button.textContent = `Show ${Math.min(PAGE_SIZE, remaining)} more`
}

function updateEmptyState (query) {
    const title = document.querySelector('#emptyTitle')
    const message = document.querySelector('#emptyMessage')

    if (query) {
        title.textContent = 'No matching items'
        message.textContent = 'Try another title or URL.'
    } else {
        title.textContent = 'Archive is empty'
        message.textContent = 'Items you save will appear here.'
    }
}

function showLoadError () {
    document.querySelector('#archiveCount').textContent = 'Unavailable'
    document.querySelector('#archiveList').hidden = true
    document.querySelector('#emptyState').hidden = true
    document.querySelector('#archiveSearch').disabled = true
    setPageStatus('The archive could not be loaded. Reload this page to try again.', 'error')
}

function setPageStatus (message, type = '') {
    const status = document.querySelector('#pageStatus')
    status.className = `page-status ${type}`
    status.textContent = message
}

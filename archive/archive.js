import * as runtime from '../modules/chrome/runtime.mjs'
import * as storage from '../modules/chrome/storage.mjs'
import { applyFontPreference } from '../modules/appearance.mjs'
import {
    applyFaviconFallback,
    getSiteFaviconFallbackUrl,
    getSiteFaviconUrl,
} from '../modules/favicon.mjs'
import {
    countSites,
    filterArchivePages,
    getArchiveProgress,
    getDisplayUrl,
    getSiteName,
    groupArchivePages,
    splitMatches,
} from './archiveView.mjs'

const PAGE_SIZE = 100
const SITE_LIMIT = 30
const UNDO_DURATION = 6000
const timeFormatter = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })
const dayFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric',
})
const fullFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full', timeStyle: 'short',
})

let archivePages = []
let filteredPages = []
let selectedSite = ''
let showAllSites = false
let removedPage
let undoTimer
let visibleCount = PAGE_SIZE

const $ = selector => document.querySelector(selector)
const getQuery = () => $('#archiveSearch').value

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
    $('#archiveSearch').addEventListener('input', () => applyFilter())
    $('#undoRemove').addEventListener('click', undoRemove)
    $('#clearFilters').addEventListener('click', () => {
        $('#archiveSearch').value = ''
        selectedSite = ''
        applyFilter()
        $('#archiveSearch').focus()
    })
    $('#siteList').addEventListener('click', event => {
        const button = event.target.closest('button')
        if (!button) return
        if (button.dataset.more) {
            showAllSites = true
            renderSites()
            return
        }
        selectedSite = button.dataset.site === selectedSite
            ? ''
            : button.dataset.site
        applyFilter()
    })
    $('#archiveGroups').addEventListener('click', handleListClick)
    document.addEventListener('keydown', handleShortcut)

    new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return
        if (visibleCount >= filteredPages.length) return
        visibleCount += PAGE_SIZE
        renderArchive()
    }, { rootMargin: '800px 0px' }).observe($('#loadSentinel'))
}

function handleListClick (event) {
    const removeButton = event.target.closest('.remove-button')
    if (removeButton) {
        removeItem(removeButton.closest('.archive-item'))
        return
    }

    const link = event.target.closest('.item-title')
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey
        || event.shiftKey || event.altKey) return

    event.preventDefault()
    runtime.sendMessage({
        message: 'open',
        data:    {
            url:        link.href,
            currentTab: false,
            active:     true,
            isArchive:  true,
        },
    })
}

function handleShortcut (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return

    const search = $('#archiveSearch')
    const active = document.activeElement
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName)

    if (event.key === 'Escape') {
        if (search.value || selectedSite) {
            search.value = ''
            selectedSite = ''
            applyFilter()
        }
        if (isTyping) search.blur()
        return
    }

    if (isTyping) {
        if (event.key === 'ArrowDown' || event.key === 'Enter') {
            const first = $('.item-title')
            if (first) {
                event.preventDefault()
                first.focus()
            }
        }
        return
    }

    const item = active?.closest('.archive-item')

    switch (event.key) {
    case '/':
        event.preventDefault()
        search.focus()
        search.select()
        break
    case 'j':
    case 'ArrowDown':
        event.preventDefault()
        moveFocus(item, 1)
        break
    case 'k':
    case 'ArrowUp':
        event.preventDefault()
        moveFocus(item, -1)
        break
    case 'x':
    case 'Delete':
    case 'Backspace':
        if (!item) return
        event.preventDefault()
        removeItem(item)
        break
    case 'u':
        if (removedPage) undoRemove()
        break
    }
}

function moveFocus (item, step) {
    const links = [...document.querySelectorAll('.item-title')]
    if (!links.length) return

    const index = item ? links.indexOf(item.querySelector('.item-title')) : -1
    const next = index === -1
        ? (step > 0 ? 0 : links.length - 1)
        : Math.min(links.length - 1, Math.max(0, index + step))
    links[next].focus()
    links[next].closest('.archive-item').scrollIntoView({ block: 'nearest' })
}

function applyFilter () {
    visibleCount = PAGE_SIZE
    filteredPages = filterArchivePages(archivePages, getQuery(), selectedSite)
    renderSites()
    renderArchive()
}

function renderSites () {
    const queryPages = filterArchivePages(archivePages, getQuery())
    const sites = countSites(queryPages)
    if (selectedSite && !sites.some(({ site }) => site === selectedSite)) {
        sites.unshift({ site: selectedSite, count: 0 })
    }

    const shownSites = showAllSites ? sites : sites.slice(0, SITE_LIMIT)
    const selectedHidden = selectedSite
        && !shownSites.some(({ site }) => site === selectedSite)
    if (selectedHidden) {
        shownSites.push(sites.find(({ site }) => site === selectedSite))
    }

    const fragment = document.createDocumentFragment()
    fragment.append(createSiteButton('', 'All', queryPages.length))
    shownSites.forEach(({ site, count }) =>
        fragment.append(createSiteButton(site, site, count)))

    const hiddenCount = sites.length - shownSites.length
    if (hiddenCount > 0) {
        const item = document.createElement('li')
        const more = document.createElement('button')
        more.type = 'button'
        more.className = 'site-more'
        more.dataset.more = 'true'
        more.textContent = `+${hiddenCount}`
        more.title = `Show ${hiddenCount} more sites`
        item.append(more)
        fragment.append(item)
    }

    $('#siteList').replaceChildren(fragment)
}

function createSiteButton (site, label, count) {
    const item = document.createElement('li')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'site-button'
    button.dataset.site = site
    button.setAttribute('aria-pressed', String(site === selectedSite))
    button.title = label

    if (site) {
        const icon = createFavicon(`https://${site}`)
        icon.className = 'site-icon'
        button.append(icon)
    } else {
        const icon = document.createElement('span')
        icon.className = 'site-icon site-icon-all'
        button.append(icon)
    }

    const name = document.createElement('span')
    name.className = 'site-name'
    name.textContent = label

    const total = document.createElement('span')
    total.className = 'site-count'
    total.textContent = count.toLocaleString()

    button.append(name, total)
    item.append(button)
    return item
}

function renderArchive () {
    const query = getQuery()
    const visiblePages = filteredPages.slice(0, visibleCount)
    const fragment = document.createDocumentFragment()

    for (const group of groupArchivePages(visiblePages)) {
        const section = document.createElement('section')
        section.className = 'archive-group'

        const heading = document.createElement('h2')
        heading.className = 'group-heading'
        heading.textContent = group.label

        const list = document.createElement('ol')
        list.className = 'archive-list'
        group.pages.forEach(page =>
            list.append(createArchiveItem(page, group.kind, query)))

        section.append(heading, list)
        fragment.append(section)
    }

    $('#archiveGroups').replaceChildren(fragment)
    updateEmptyState(query)
    updateCounts()
}

function createFavicon (url, fallbackSrc = '') {
    const favicon = document.createElement('img')
    const src = getSiteFaviconUrl(url) || fallbackSrc
    if (src) favicon.src = src
    favicon.dataset.faviconFallback = getSiteFaviconFallbackUrl(url)
    favicon.addEventListener('error', () => applyFaviconFallback(favicon))
    favicon.alt = ''
    favicon.loading = 'lazy'
    return favicon
}

function appendHighlighted (element, text, query) {
    for (const segment of splitMatches(text, query)) {
        if (segment.match) {
            const mark = document.createElement('mark')
            mark.textContent = segment.text
            element.append(mark)
        } else {
            element.append(segment.text)
        }
    }
}

function createArchiveItem (page, groupKind, query) {
    const item = document.createElement('li')
    item.className = 'archive-item'
    item.dataset.url = page.url

    const favicon = createFavicon(page.url, page.favIconUrl)
    favicon.className = 'item-favicon'

    const main = document.createElement('div')
    main.className = 'item-main'

    const link = document.createElement('a')
    link.className = 'item-title'
    link.href = page.url
    link.target = '_blank'
    link.rel = 'noreferrer'
    appendHighlighted(link, page.title || page.url, query)

    const meta = document.createElement('div')
    meta.className = 'item-meta'

    const url = document.createElement('span')
    url.className = 'item-url'
    url.title = page.url
    appendHighlighted(url, getDisplayUrl(page.url), query)
    meta.append(url)

    const progress = getArchiveProgress(page)
    if (progress) {
        const progressLabel = document.createElement('span')
        progressLabel.className = `item-progress ${progress.type}`
        progressLabel.title = progress.label
        progressLabel.style.setProperty('--progress', `${progress.percent}%`)
        progressLabel.textContent = `${progress.percent}%`
        meta.append(progressLabel)
    }

    main.append(link, meta)

    const time = document.createElement('time')
    time.className = 'item-time'
    time.dateTime = new Date(page.date).toISOString()
    time.title = fullFormatter.format(page.date)
    time.textContent = groupKind === 'day'
        ? timeFormatter.format(page.date)
        : dayFormatter.format(page.date)

    const removeButton = document.createElement('button')
    removeButton.className = 'remove-button'
    removeButton.type = 'button'
    removeButton.tabIndex = -1
    removeButton.title = 'Remove (x)'
    removeButton.setAttribute('aria-label',
        `Remove ${page.title || getSiteName(page.url)}`)
    removeButton.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">'
        + '<path d="m4.5 4.5 7 7m0-7-7 7"/></svg>'

    item.append(favicon, main, time, removeButton)
    return item
}

async function removeItem (item) {
    if (!item || item.dataset.removing) return
    const page = archivePages.find(({ url }) => url === item.dataset.url)
    if (!page) return

    const hadFocus = item.contains(document.activeElement)
    const links = [...document.querySelectorAll('.item-title')]
    const index = links.indexOf(item.querySelector('.item-title'))
    item.dataset.removing = 'true'
    item.classList.add('is-removing')

    try {
        await storage.local.remove(page.url)
        archivePages = archivePages.filter(({ url }) => url !== page.url)
        removedPage = page
        const keepCount = visibleCount
        filteredPages = filterArchivePages(archivePages, getQuery(), selectedSite)
        visibleCount = keepCount
        renderSites()
        renderArchive()
        showUndoToast()

        if (hadFocus) {
            const nextLinks = document.querySelectorAll('.item-title')
            nextLinks[Math.min(index, nextLinks.length - 1)]?.focus()
        }
    } catch (error) {
        console.error('Read Later: unable to remove the archived item.', error)
        delete item.dataset.removing
        item.classList.remove('is-removing')
        setPageStatus('Could not remove this item.', 'error')
    }
}

async function undoRemove () {
    if (!removedPage) return

    const page = removedPage
    $('#undoRemove').disabled = true

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
        $('#undoRemove').disabled = false
    }
}

function showUndoToast () {
    clearTimeout(undoTimer)
    const toast = $('#undoToast')
    toast.hidden = false
    requestAnimationFrame(() => toast.classList.add('visible'))
    undoTimer = setTimeout(() => {
        removedPage = undefined
        hideUndoToast()
    }, UNDO_DURATION)
}

function hideUndoToast () {
    clearTimeout(undoTimer)
    const toast = $('#undoToast')
    toast.classList.remove('visible')
    setTimeout(() => {
        if (!toast.classList.contains('visible')) toast.hidden = true
    }, 180)
}

function updateCounts () {
    const total = archivePages.length
    const count = $('#archiveCount')
    count.textContent = total.toLocaleString()
    count.title = `${total.toLocaleString()} ${total === 1 ? 'item' : 'items'}`
    document.title = `Archive (${total}) · Read Later`
}

function updateEmptyState (query) {
    const isEmpty = filteredPages.length === 0
    const isFiltered = Boolean(query.trim() || selectedSite)
    $('#emptyState').hidden = !isEmpty
    $('#clearFilters').hidden = !isFiltered
    if (!isEmpty) return

    $('#emptyTitle').textContent = isFiltered
        ? 'No matching items'
        : 'Archive is empty'
    $('#emptyMessage').textContent = isFiltered
        ? 'Try another title, URL, or site.'
        : 'Items you save will appear here.'
}

function showLoadError () {
    $('#archiveCount').textContent = ''
    $('#emptyState').hidden = true
    $('#archiveSearch').disabled = true
    setPageStatus('The archive could not be loaded. Reload this page to try again.', 'error')
}

function setPageStatus (message, type = '') {
    const status = $('#pageStatus')
    status.className = `page-status ${type}`
    status.textContent = message
}

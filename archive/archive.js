import * as runtime from '../modules/chrome/runtime.mjs'
import * as storage from '../modules/chrome/storage.mjs'
import { applyFontPreference } from '../modules/appearance.mjs'
import { hideTooltipWithin, setupTooltips } from '../modules/tooltip.mjs'
import {
    applyFaviconFallback,
    getSiteFaviconFallbackUrl,
    getSiteFaviconUrl,
} from '../modules/favicon.mjs'
import { shouldShowDeleteIcon } from '../popup/selectionIcon.mjs'
import {
    filterArchivePages,
    getArchiveKeyBinding,
    getArchiveProgress,
    getDisplayUrl,
    splitMatches,
} from './archiveView.mjs'

const PAGE_SIZE = 100
const UNDO_DURATION = 6000
const TITLE_TOOLTIP_DELAY = 800
const DELETE_ICON = '../icons/delete-black.svg'
const HELP_URL = 'https://github.com/willbchang/chrome-read-later#readme'
const countSeparators = { slash: ' / ', colon: ':' }
const savedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
})

let options = {}
let archivePages = []
let filteredPages = []
let visibleCount = PAGE_SIZE
let activeUrl
let lastInputType = 'initial'
let lastKey = 'none'
let lastPointer
let removedPages = []
let undoTimer
let settingsSaveQueue = Promise.resolve()
let settingsChangeId = 0

const $ = selector => document.querySelector(selector)
const list = () => $('#archiveList')
const items = () => [...list().children]
const activeItem = () => list().querySelector('.archive-item.active')
const getQuery = () => $('#archiveSearch').value

document.addEventListener('DOMContentLoaded', init)

async function init () {
    setupTooltips()
    bindEvents()

    try {
        const [pages, storedOptions] = await Promise.all([
            storage.local.sortByLatest(),
            storage.getOptions(),
        ])
        options = storedOptions || {}
        applyFontPreference(options)
        applySettings()
        archivePages = pages.filter(page => page.url)
        applyFilter()
    } catch (error) {
        console.error('Read Later: unable to load the archive.', error)
        showLoadError()
    }
}

function bindEvents () {
    const search = $('#archiveSearch')
    search.addEventListener('input', applyFilter)
    search.addEventListener('keydown', handleSearchKey)

    list().addEventListener('mousemove', handleMouseMove)
    list().addEventListener('click', handleListClick)
    list().addEventListener('auxclick', handleListClick)
    document.querySelectorAll('.option-control').forEach(control =>
        control.addEventListener('change', saveSettings))
    $('#undoRemove').addEventListener('click', undoRemove)
    document.addEventListener('keydown', handleKey)

    new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return
        if (visibleCount >= filteredPages.length) return
        visibleCount += PAGE_SIZE
        render()
    }, { rootMargin: '600px 0px' }).observe($('#loadSentinel'))
}

function handleSearchKey (event) {
    const search = event.currentTarget
    if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (search.value) {
            search.value = ''
            applyFilter()
        } else {
            search.blur()
        }
    } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        search.blur()
        selectItem(items()[0], 'keyboard')
    } else if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault()
        openActive({ active: !(event.metaKey || event.ctrlKey) })
    }
}

function handleKey (event) {
    if (event.target.closest?.('input, textarea, select, button, a:not(.item-title)')) {
        return
    }

    const binding = getArchiveKeyBinding(event, lastKey)
    lastKey = binding
    const action = {
        Enter:              () => openActive({ active: true }),
        o:                  () => openActive({ active: true }),
        'Meta + Enter':     () => openActive({ active: false }),
        O:                  () => openActive({ active: false }),
        j:                  () => moveTo('next'),
        k:                  () => moveTo('previous'),
        ArrowDown:          () => moveTo('next'),
        ArrowUp:            () => moveTo('previous'),
        gg:                 () => moveTo('top'),
        G:                  () => moveTo('bottom'),
        'Meta + ArrowUp':   () => moveTo('top'),
        'Meta + ArrowDown': () => moveTo('bottom'),
        dd:                 () => removeItem(activeItem()),
        Backspace:          () => removeItem(activeItem()),
        Delete:             () => removeItem(activeItem()),
        u:                  undoRemove,
        'Meta + z':         undoRemove,
        yy:                 copyActiveUrl,
        '/':                focusSearch,
        ',':                openOptions,
        '?':                openHelp,
    }[binding]

    if (!action) return
    event.preventDefault()
    action()
}

function handleMouseMove (event) {
    // Scrolling under a still pointer fires mousemove; ignore it so the
    // keyboard selection stays put, as in the popup.
    const pointer = `${event.screenX},${event.screenY}`
    if (pointer === lastPointer) return
    lastPointer = pointer
    const item = event.target.closest('.archive-item')
    if (item) selectItem(item, 'mouse')
}

function handleListClick (event) {
    const item = event.target.closest('.archive-item')
    if (!item || event.button > 1) return
    event.preventDefault()
    selectItem(item, lastInputType === 'keyboard' ? 'keyboard' : 'mouse')

    if (event.target.dataset.deleteAction) {
        removeItem(item)
    } else {
        const background = event.button === 1 || event.metaKey || event.ctrlKey
        openActive({ active: !background })
    }
}

function applySettings () {
    $('#archiveMode').checked = options.archiveMode
    $('#archiveRetentionDays').value = String(options.archiveRetentionDays ?? 0)
    $('#archiveRetentionDays').disabled = !options.archiveMode
}

function saveSettings () {
    const changes = {
        archiveMode:          $('#archiveMode').checked,
        archiveRetentionDays: Number($('#archiveRetentionDays').value),
    }
    const changeId = ++settingsChangeId
    $('#archiveRetentionDays').disabled = !changes.archiveMode
    setPageStatus('')
    // Serialize writes so an older result never replaces a newer choice.
    settingsSaveQueue = settingsSaveQueue.then(() =>
        persistSettings(changes, changeId))
}

async function persistSettings (changes, changeId) {
    try {
        const result = await storage.setOptions(changes)
        if (changeId !== settingsChangeId) return
        options = result.options
        applySettings()
        // A shorter retention period may have removed old items.
        const pages = await storage.local.sortByLatest()
        archivePages = pages.filter(page => page.url)
        const query = getQuery()
        filteredPages = filterArchivePages(archivePages, query)
        render()
    } catch (error) {
        console.error('Read Later: unable to save archive settings.', error)
        if (changeId !== settingsChangeId) return
        applySettings()
        setPageStatus('Could not save these options.', 'error')
    }
}

function applyFilter () {
    visibleCount = PAGE_SIZE
    filteredPages = filterArchivePages(archivePages, getQuery())
    activeUrl = filteredPages[0]?.url
    render()
    window.scrollTo({ top: 0 })
}

function render () {
    const query = getQuery()
    const fragment = document.createDocumentFragment()
    filteredPages.slice(0, visibleCount)
        .forEach(page => fragment.append(createItem(page, query)))
    list().replaceChildren(fragment)

    const item = items().find(li => li.dataset.url === activeUrl) || items()[0]
    if (item) selectItem(item, lastInputType, { scroll: false })
    updateEmptyState(query)
    updateCount()
}

function createItem (page, query) {
    const item = document.createElement('li')
    item.className = 'archive-item'
    item.dataset.url = page.url

    const favicon = document.createElement('img')
    const faviconSrc = getSiteFaviconUrl(page.url) || page.favIconUrl
    if (faviconSrc) favicon.src = faviconSrc
    favicon.dataset.faviconFallback = getSiteFaviconFallbackUrl(page.url)
    favicon.addEventListener('error', () => {
        if (!favicon.dataset.deleteAction) applyFaviconFallback(favicon)
    })
    favicon.alt = ''
    favicon.loading = 'lazy'

    const text = document.createElement('div')
    text.className = 'item-text'

    // Like the popup's details hover: full title, then when it was saved.
    const title = document.createElement('a')
    title.className = 'item-title'
    title.href = page.url
    title.tabIndex = -1
    title.dataset.tooltip = page.title || page.url
    title.dataset.tooltipDelay = TITLE_TOOLTIP_DELAY
    title.dataset.tooltipDetail = savedDate.format(page.date)
    if (!page.title || page.title === page.url) title.classList.add('url-only')
    appendHighlighted(title, page.title || page.url, query)

    const url = document.createElement('span')
    url.className = 'item-url'
    appendHighlighted(url, getDisplayUrl(page.url), query)

    text.append(title, url)
    item.append(favicon, text)

    const progress = getArchiveProgress(page)
    if (progress) {
        const percent = document.createElement('span')
        percent.className = `percent ${progress.type}`
        percent.textContent = progress.label
        item.append(percent)
    }

    return item
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

function selectItem (item, inputType = 'keyboard', { scroll = true } = {}) {
    if (!item) return
    const previous = activeItem()
    if (previous && previous !== item) {
        hideTooltipWithin(previous)
        restoreFavicon(previous)
        previous.classList.remove('active')
    }

    item.classList.add('active')
    activeUrl = item.dataset.url
    lastInputType = inputType
    restoreFavicon(item)
    if (shouldShowDeleteIcon(options.selectedItemIconMode ?? 'always', inputType)) {
        showDeleteIcon(item)
    }
    if (scroll && inputType !== 'mouse') item.scrollIntoView({ block: 'nearest' })
    updateCount()
}

function showDeleteIcon (item) {
    const image = item.querySelector('img')
    if (!image.dataset.faviconSrc) image.dataset.faviconSrc = image.src
    image.dataset.deleteAction = 'true'
    image.src = DELETE_ICON
}

function restoreFavicon (item) {
    const image = item.querySelector('img')
    if (!image?.dataset.deleteAction) return
    image.src = image.dataset.faviconSrc
    delete image.dataset.deleteAction
}

function moveTo (direction) {
    const all = items()
    if (!all.length) return
    const index = all.indexOf(activeItem())
    const next = {
        previous: Math.max(0, index - 1),
        next:     Math.min(all.length - 1, index + 1),
        top:      0,
        bottom:   all.length - 1,
    }[direction]

    // G goes to the real end, so load every remaining item first.
    if (direction === 'bottom' && visibleCount < filteredPages.length) {
        visibleCount = filteredPages.length
        activeUrl = filteredPages.at(-1).url
        lastInputType = 'keyboard'
        render()
        activeItem()?.scrollIntoView({ block: 'nearest' })
        return
    }
    selectItem(all[next], 'keyboard')
}

function openActive ({ active }) {
    const url = activeItem()?.dataset.url
    if (!url) return
    runtime.sendMessage({
        message: 'open',
        data:    { url, currentTab: false, active, isArchive: true },
    })
}

async function copyActiveUrl () {
    const item = activeItem()
    if (!item) return
    await navigator.clipboard.writeText(item.dataset.url)
    item.animate([{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }],
        { duration: 300, iterations: 2 })
}

function focusSearch () {
    const search = $('#archiveSearch')
    search.focus()
    search.select()
}

function openOptions () {
    location.href = '../options/options.html'
}

function openHelp () {
    window.open(HELP_URL)
}

async function removeItem (item) {
    if (!item || item.dataset.removing) return
    const page = archivePages.find(({ url }) => url === item.dataset.url)
    if (!page) return

    item.dataset.removing = 'true'
    const all = items()
    const index = all.indexOf(item)
    const neighbor = all[index + 1] || all[index - 1]

    try {
        await storage.local.remove(page.url)
        await item.animate([{ opacity: 1 }, { opacity: 0 }],
            { duration: 150, easing: 'ease-out' }).finished
        archivePages = archivePages.filter(({ url }) => url !== page.url)
        filteredPages = filteredPages.filter(({ url }) => url !== page.url)
        removedPages.push(page)
        activeUrl = neighbor?.dataset.url
        render()
        showUndoToast()
    } catch (error) {
        console.error('Read Later: unable to remove the archived item.', error)
        delete item.dataset.removing
        setPageStatus('Could not remove this item.', 'error')
    }
}

async function undoRemove () {
    const page = removedPages.pop()
    if (!page) return

    try {
        await storage.local.set(page)
        archivePages = [...archivePages, page].sort((a, b) => b.date - a.date)
        filteredPages = filterArchivePages(archivePages, getQuery())
        const index = filteredPages.indexOf(page)
        if (index >= visibleCount) visibleCount = index + 1
        activeUrl = page.url
        lastInputType = 'keyboard'
        render()
        activeItem()?.scrollIntoView({ block: 'nearest' })
        if (!removedPages.length) hideUndoToast()
    } catch (error) {
        removedPages.push(page)
        console.error('Read Later: unable to restore the archived item.', error)
        setPageStatus('Could not restore this item.', 'error')
    }
}

function showUndoToast () {
    clearTimeout(undoTimer)
    const toast = $('#undoToast')
    toast.hidden = false
    requestAnimationFrame(() => toast.classList.add('visible'))
    undoTimer = setTimeout(hideUndoToast, UNDO_DURATION)
}

function hideUndoToast () {
    clearTimeout(undoTimer)
    const toast = $('#undoToast')
    toast.classList.remove('visible')
    setTimeout(() => {
        if (!toast.classList.contains('visible')) toast.hidden = true
    }, 160)
}

function updateCount () {
    const total = filteredPages.length
    const row = items().indexOf(activeItem()) + 1
    const separator = countSeparators[options.countFormat ?? 'slash']
    const count = $('#count')

    $('#row').textContent = row
    $('#total').textContent = total
    count.dataset.format = separator ? 'position' : 'total'
    count.querySelector('.count-separator').textContent = separator ?? ''

    const label = separator ? `Item ${row} of ${total}` : `${total} items`
    count.dataset.tooltip = label
    count.setAttribute('aria-label', label)
    document.title = `Archive (${archivePages.length}) · Read Later`
}

function updateEmptyState (query) {
    const isEmpty = filteredPages.length === 0
    $('#emptyState').hidden = !isEmpty
    if (!isEmpty) return

    $('#emptyTitle').textContent = query.trim()
        ? 'No matching items'
        : 'Archive is empty'
    $('#emptyMessage').textContent = query.trim()
        ? 'Try another title or URL.'
        : 'Items you save will appear here.'
}

function showLoadError () {
    $('#archiveSearch').disabled = true
    $('#emptyState').hidden = true
    setPageStatus('The archive could not be loaded. Reload this page to try again.', 'error')
}

function setPageStatus (message, type = '') {
    const status = $('#pageStatus')
    status.className = `toast ${type}`
    status.textContent = message
}

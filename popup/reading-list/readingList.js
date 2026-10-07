import * as storage from '../../modules/chrome/storage.mjs'
import * as generator from './readingItemGenerator.js'
import * as action from '../action.js'
import * as filter from '../filter.js'
import { applySiteFavicon } from '../../modules/favicon.mjs'

const readingList = $('#reading-list')

export async function setup () {
    resetEventListeners()
    await initDomFromStorage()
    loadSiteFavicons()
    setupItemHoverBehavior()
    observeClippedRows()
    activeFirstLi()
    updateStateOnMouseMove()
    doActionOnMouseClick()
    doActionOnBodyKeyDown()
}

function resetEventListeners () {
    // Remove all events listeners
    readingList.off()
    $('body').off()
}

async function initDomFromStorage () {
    const pages = await storage.sortSavedByLatest()
    const oldReadingItemsLength = readingList.children().length

    pages.filter(page => page.url)
        .map(page => readingList.append(generator.renderLiFrom(page, {
            isLocalOverflow: window.localOverflowUrls?.has(page.url),
            hoverMode:       window.options?.itemHoverMode,
        })))

    // This way improve the UX, readingList.empty() will flash the screen.
    readingList.children().slice(0, oldReadingItemsLength).remove()
}

function loadSiteFavicons () {
    readingList.find('img[data-site-favicon-src]').each((_, image) => {
        const siteFaviconSrc = image.dataset.siteFaviconSrc
        if (!siteFaviconSrc) return

        const siteFavicon = new Image()
        siteFavicon.onload = () => {
            applySiteFavicon(image, siteFavicon.src)
        }
        siteFavicon.src = siteFaviconSrc
    })
}

function setupItemHoverBehavior () {
    readingList.find('a.scroll-title').each((_, anchor) => {
        generator.setupTitleScroll(anchor)
    })
    readingList.find('a.mixed-hover').each((_, anchor) => {
        generator.setupMixedHover(anchor)
    })
    readingList.find('a[data-tooltip][data-tooltip-detail]').each((_, anchor) => {
        generator.setupDetailsTooltip(anchor)
    })
}

// Rows less than half visible past the clipped list padding ignore the
// pointer, so moving toward the status bar can't select a row whose highlight
// is hidden. This covers hover, clicks, and tooltips alike.
let clippedRowObserver

function observeClippedRows () {
    clippedRowObserver?.disconnect()
    const padding = parseFloat(getComputedStyle(readingList[0]).paddingTop)
    clippedRowObserver = new IntersectionObserver(entries => {
        for (const { target, intersectionRatio } of entries) {
            target.classList.toggle('is-clipped', intersectionRatio < 0.5)
        }
    }, {
        root:       readingList[0],
        rootMargin: `-${padding}px 0px`,
        threshold:  0.5,
    })
    readingList.children('li').each((_, li) => clippedRowObserver.observe(li))
}

function activeFirstLi () {
    const li = $('#reading-list li').first()
    const hasReadingItem = li.length !== 0

    if (hasReadingItem) {
        action.reactive(li, 'initial')
        action.scrollTo(li)
    }
}

function updateStateOnMouseMove () {
    // Chrome fires mousemove when the list scrolls under a still pointer,
    // which would steal the selection from gg, G, j, and k.
    let lastPointer
    readingList.on('mousemove', 'li', ({ currentTarget, screenX, screenY }) => {
        const pointer = `${screenX},${screenY}`
        if (pointer === lastPointer) return
        lastPointer = pointer
        const li = $(currentTarget)
        action.reactive(li, 'mouse')
        action.updateRowNumber()
    })
}

function doActionOnMouseClick () {
    readingList.on('click', event => {
        event.preventDefault()
        // Clicks on the list padding would otherwise open the selected item.
        if (!event.target.closest('li')) return

        try {
            const clickType = filter.getClickType(event, 'readingList')
            const clickAction = filter.getClickAction(clickType)
            clickAction()
        } catch (e) {
            console.log('Catch click action error: ', e, event.target.tagName)
        }
    })
}

function doActionOnBodyKeyDown () {
    $('body').on('keydown', event => {
        if (event.target.closest('#status-bar, .tooltip-popup')) return
        if (event.key.includes('Arrow')) event.preventDefault()
        const keyBinding = filter.getKeyBinding(event)
        const keyAction = filter.getKeyAction(keyBinding)
        keyAction && keyAction()
    })
}

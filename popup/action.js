import * as runtime from '../modules/chrome/runtime.mjs'
import * as localStore from '../modules/localStore/localStore.mjs'
import * as tabs from '../modules/chrome/tabs.mjs'
import { hideTooltipWithin } from '../modules/tooltip.mjs'
import { shouldShowDeleteIcon } from './selectionIcon.mjs'

const activeLi = () => $('.active')
const activeUrl = () => activeLi().find('a').attr('href')
const visibleLis = () => $('#reading-list li:visible')
const getSessionKey = () => 'deletedSyncUrls'
let lastSelectionInputType = 'initial'

export const open = ({ currentTab = false, active = true }) => {
    if (window.isHidingLi) return // prevents open same instance multiple times
    dele()
    runtime.sendMessage({
        message: 'open',
        data:    {
            url:       activeUrl(),
            currentTab,
            active,
        }
    })
    if (currentTab) window.close()
}

// dele is synonym of delete, delete is a keyword in JavasScript
export const dele = () => {
    if (window.isHidingLi) return // prevents hold d key and the deletion will jump around.
    window.isHidingLi = true
    const li = activeLi()
    const url = activeUrl()
    li.fadeOut('normal', () => {
        updateTotalNumber()
        moveToPreviousOrNext(li)
        window.isHidingLi = false
    })

    runtime.sendMessage({
        message: 'dele',
        data:    {
            key: getSessionKey(),
            url,
        }
    })
}

export const undo = () => {
    localStore.popArray(getSessionKey()).then(url => {
        const li = $(`a[href="${url}"]`).parent().fadeIn('normal')

        if (li.html()) {
            reactive(li, 'keyboard')
            scrollTo(li)
        }

        updateRowNumber()
        updateTotalNumber()
    })
}

export const moveTo = (direction, inputType = 'keyboard') => {
    const li = {
        previous: () => activeLi().prevAll(':visible').first(),
        next:     () => activeLi().nextAll(':visible').first(),
        top:      () => visibleLis().first(),
        bottom:   () => visibleLis().last(),
    }[direction]()

    if (li.html()) {
        reactive(li, inputType)
        scrollTo(li)
    }

    updateRowNumber()
}

export const copyUrl = async () => {
    activeLi().fadeOut(100).fadeIn(100).fadeOut(100).fadeIn(100)
    await navigator.clipboard.writeText(activeUrl())
}

export const question = () => window.open(
    'https://github.com/willbchang/chrome-read-later#readme')

export const reactive = (li, inputType = 'initial') => {
    const previousLi = activeLi()
    if (!previousLi.is(li)) {
        hideTooltipWithin(previousLi[0])
        restoreFavicon(previousLi)
        previousLi.removeClass('active')
        li.addClass('active')
    }

    lastSelectionInputType = inputType
    updateSelectedIcon(li, inputType)
}

const restoreFavicon = li => {
    const image = li.find('img')[0]
    if (!image) return

    if (image.dataset.faviconSrc) image.src = image.dataset.faviconSrc
    delete image.dataset.deleteAction
}

const updateSelectedIcon = (li, inputType) => {
    restoreFavicon(li)
    if (shouldShowDeleteIcon(
        window.options?.selectedItemIconMode ?? 'always',
        inputType
    )) showDeleteIcon(li)
}

const showDeleteIcon = li => {
    const image = li.find('img')[0]
    if (!image) return

    if (!image.dataset.faviconSrc) image.dataset.faviconSrc = image.src
    image.dataset.deleteAction = 'true'
    image.src = '../icons/delete-black.svg'
}

export const scrollTo = (li) => {
    li[0].scrollIntoView({ block: 'nearest' })
}

export const updateTotalNumber = () => updateCount()

export const updateRowNumber = () => updateCount()

const countSeparators = { slash: ' / ', colon: ':' }

const updateCount = () => {
    const items = visibleLis()
    const row = items.index(activeLi()) + 1
    const total = items.length
    const separator = countSeparators[window.options?.countFormat ?? 'slash']
    const count = $('#count')

    $('#row').text(row)
    $('#total').text(total)
    count.attr('data-format', separator ? 'position' : 'total')
    count.find('.count-separator').text(separator ?? '')

    const current = separator ? `${row}${separator}${total}` : `${total}`
    const local = items.filter('.local-overflow').length
    const synced = total - local
    count.find('.local-dot').prop('hidden', !local)
    const text = `${current} (${synced} synced + ${local} local)`
    count.attr({ 'aria-label': text, 'data-tooltip': text })
}

const moveToPreviousOrNext = li => {
    // The reading list is sort by the latest, the id is the timestamp,
    //  so the current id should be larger than last li, otherwise itself
    //  is the last li.
    const isLastLi = li.attr('id') < visibleLis().last().attr('id')
    isLastLi
        ? moveTo('previous', lastSelectionInputType)
        : moveTo('next', lastSelectionInputType)
}

export async function archive () {
    if (!window.options?.archiveMode) return
    const archiveUrl = chrome.runtime.getURL('archive/archive.html')
    await tabs.create(archiveUrl, true)
    window.close()
}

export function options () {
    const optionsUrl = chrome.runtime.getURL('options/options.html')
    tabs.create(optionsUrl, true)
}

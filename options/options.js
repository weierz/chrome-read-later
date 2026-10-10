import * as storage from '../modules/chrome/storage.mjs'
import { getSiteFaviconUrl } from '../modules/favicon.mjs'
import { setupTooltips } from '../modules/tooltip.mjs'
import { applyFontPreference } from '../modules/appearance.mjs'
import {
    parseReadingList,
    parseReadingListUrl,
    serializeReadingList,
} from './readingListFormat.mjs'

let currentOptions
let exportItems = []
let copyResetTimer
let optionsSaveQueue = Promise.resolve()
let optionsChangeId = 0

$(async () => {
    setupTooltips()
    bindSidebarNavigation()
    bindOptionControls()
    bindImportControls()
    bindExportControls()

    await Promise.all([
        loadOptions(),
        refreshExport(),
    ])
})

function bindSidebarNavigation () {
    const links = [...document.querySelectorAll('.sidebar-link')]
    const sections = [...document.querySelectorAll('.settings-section')]
    const setActiveLink = sectionId => {
        links.forEach(link => {
            const isActive = link.hash === `#${sectionId}`
            link.classList.toggle('active', isActive)
            if (isActive) {
                link.setAttribute('aria-current', 'page')
            } else {
                link.removeAttribute('aria-current')
            }
        })
    }

    const initialSection = location.hash.slice(1) || sections[0]?.id
    if (initialSection) setActiveLink(initialSection)

    links.forEach(link => link.addEventListener('click', () => {
        setActiveLink(link.hash.slice(1))
    }))

    const observer = new IntersectionObserver(entries => {
        const visibleSection = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visibleSection) setActiveLink(visibleSection.target.id)
    }, {
        rootMargin: '-10% 0px -70% 0px',
        threshold:  0,
    })

    sections.forEach(section => observer.observe(section))
}

function bindOptionControls () {
    $('.option-control').on('change', updateOptionHints)
    $('.option-control').on('change', saveOptions)
}

async function loadOptions () {
    try {
        currentOptions = await storage.getOptions()
        applyOptions(currentOptions)
        await updateStorageStatus()
    } catch (error) {
        console.error('Read Later: unable to load options.', error)
        setStatus($('#optionsStatus'), 'Could not load options.', 'error')
    }
}

function saveOptions () {
    const nextOptions = readOptions()
    const changeId = ++optionsChangeId
    enableAvailableOptionControls()
    setStatus($('#optionsStatus'), '')
    // Keep controls usable while serializing writes. Older results must not
    // replace newer edits that are already visible in the form.
    optionsSaveQueue = optionsSaveQueue.then(() => persistOptions(nextOptions, changeId))
}

async function persistOptions (nextOptions, changeId) {
    const previousOptions = currentOptions
    try {
        const result = await storage.setOptions(nextOptions)
        currentOptions = result.options
        if (changeId !== optionsChangeId) return
        applyOptions(currentOptions)

        if (result.syncError) {
            setStatus(
                $('#optionsStatus'),
                'Saved on this computer, but Chrome could not sync these options.',
                'warning'
            )
        } else {
            setStatus($('#optionsStatus'), '')
        }
    } catch (error) {
        console.error('Read Later: unable to save options.', error)
        if (changeId !== optionsChangeId) return
        if (previousOptions) {
            currentOptions = previousOptions
            applyOptions(previousOptions)
        }
        setStatus($('#optionsStatus'), 'Could not save these options.', 'error')
    } finally {
        if (changeId === optionsChangeId) enableAvailableOptionControls()
    }
}

function readOptions () {
    return {
        fontFamily:           $('#fontFamily').val(),
        itemNewTab:           $('#itemNewTab').prop('checked'),
        keepSavedTab:         $('#keepSavedTab').prop('checked'),
        itemHoverMode:        $('#itemHoverMode').val(),
        selectedItemIconMode: getChoice('selectedItemIconMode'),
        countFormat:          getChoice('countFormat'),
        archiveMode:          $('#archiveMode').prop('checked'),
        archiveRetentionDays: Number($('#archiveRetentionDays').val()),
        isOptions:            true,
    }
}

const itemHoverModeHints = {
    mixed:   'Short titles stay still, longer titles scroll, and very long titles show the title and URL.',
    details: 'Shows the URL after a short pause, with the full title when it is cut off.',
    title:   'Titles that are cut off scroll so you can read them in place.',
    never:   'Titles stay still and no details are shown.',
}

// Toggle groups are radio buttons sharing a name.
const getChoice = name => $(`input[name="${name}"]:checked`).val()

function setChoice (name, value) {
    $(`input[name="${name}"]`).each((_, input) => {
        input.checked = input.value === value
    })
}

function updateOptionHints () {
    $('#itemNewTabHint span').text(
        $('#itemNewTab').prop('checked') ? 'the current tab' : 'a new tab'
    )
    $('#itemHoverModeHint').text(itemHoverModeHints[$('#itemHoverMode').val()] ?? '')
}

function applyOptions (options) {
    applyFontPreference(options)
    $('#fontFamily').val(options?.fontFamily ?? 'system')
    $('#itemNewTab').prop('checked', options?.itemNewTab)
    $('#keepSavedTab').prop('checked', options?.keepSavedTab)
    $('#itemHoverMode').val(options?.itemHoverMode)
    setChoice('selectedItemIconMode', options?.selectedItemIconMode ?? 'always')
    setChoice('countFormat', options?.countFormat ?? 'slash')
    $('#archiveMode').prop('checked', options?.archiveMode)
    $('#archiveRetentionDays').val(String(options?.archiveRetentionDays ?? 0))
    updateOptionHints()
}

async function updateStorageStatus () {
    const $storageStatus = $('#storageStatus')
    try {
        const [pages, localUrls, syncFull] = await Promise.all([
            storage.sortSavedByLatest(),
            storage.getLocalOverflowUrls(),
            storage.isSyncFull(),
        ])
        const local = localUrls.length
        if (local) {
            setStatus(
                $storageStatus,
                `${pages.length - local} synced, ${local} on this computer only.`,
                'warning'
            )
        } else if (syncFull) {
            setStatus($storageStatus, 'Chrome Sync is full.', 'warning')
        } else if (pages.length) {
            setStatus($storageStatus, `${pluralize(pages.length, 'item')}, all synced.`)
        } else {
            setStatus($storageStatus, 'No saved items.')
        }
    } catch (error) {
        console.warn('Read Later: unable to check Chrome sync storage.', error)
        setStatus($storageStatus, '')
    }
}

function enableAvailableOptionControls () {
    $('.option-control').prop('disabled', false)
    $('#archiveRetentionDays').prop(
        'disabled',
        !$('#archiveMode').prop('checked')
    )
}

function bindImportControls () {
    const $textarea = $('#jsonInput')

    $textarea.on('input', () => {
        updateImportButton()
        hideImportResult()
    })

    $('#fileInput').on('change', event => loadImportFile(event.target.files[0]))

    const $drop = $('#importDrop')
    $drop.on('dragenter dragover', event => {
        if (!event.originalEvent.dataTransfer?.types.includes('Files')) return
        event.preventDefault()
        $drop.addClass('is-dragging')
    })
    $drop.on('dragleave drop', () => $drop.removeClass('is-dragging'))
    $drop.on('drop', event => {
        const file = event.originalEvent.dataTransfer?.files[0]
        if (!file) return
        event.preventDefault()
        loadImportFile(file)
    })

    $('#importButton').on('click', importReadingList)
    updateImportButton()
}

async function loadImportFile (file) {
    if (!file) return

    hideImportResult()
    try {
        $('#jsonInput').val(await file.text())
        $('#fileName').text(file.name)
    } catch (error) {
        console.error('Read Later: unable to read import file.', error)
        showImportResult('This file could not be read.', 'error')
    }
    updateImportButton()
}

async function importReadingList () {
    const content = $('#jsonInput').val().trim()
    if (!content) return

    $('#importButton').prop('disabled', true).text('Importing…')
    hideImportResult()

    try {
        const results = await importItems(content)
        showImportResults(results)

        if (results.success > 0) {
            // Clear the input so the same list is not imported twice.
            $('#jsonInput').val('')
            $('#fileInput').val('')
            $('#fileName').text('')
        }

        await Promise.all([
            loadOptions(),
            refreshExport(),
        ])
    } catch (error) {
        console.error('Read Later: import failed.', error)
        showImportResult('This is not valid JSON or JSONL.', 'error')
    } finally {
        $('#importButton').text('Import')
        updateImportButton()
    }
}

function showImportResults ({ success, skipped, usedLocalFallback }) {
    const imported = `Imported ${pluralize(success, 'item')}.`
    const message = success === 0
        ? `Nothing was imported. ${pluralize(skipped.length, 'entry', 'entries')} skipped.`
        : skipped.length
            ? `${imported} ${skipped.length} skipped.`
            : imported
    const overflow = usedLocalFallback
        ? ' Some items are stored on this computer because Chrome Sync is full.'
        : ''
    const type = success === 0 ? 'error' : skipped.length || usedLocalFallback ? 'warning' : 'success'

    showImportResult(message + overflow, type)
    updateStorageStatus()

    if (!skipped.length) return
    const shown = skipped.slice(0, 20)
    const $list = $('#importSkipped ul').empty()
    for (const { location, reason } of shown) {
        $('<li>').append(
            $('<span>').text(location),
            document.createTextNode(` · ${reason}`)
        ).appendTo($list)
    }
    if (skipped.length > shown.length) {
        $('<li>').text(`…and ${skipped.length - shown.length} more`).appendTo($list)
    }
    $('#importSkipped summary').text(`Show skipped ${skipped.length === 1 ? 'entry' : 'entries'}`)
    $('#importSkipped').prop('hidden', false).prop('open', success === 0)
}

function showImportResult (message, type) {
    setStatus($('#importStatus'), message, type)
    $('#importSkipped').prop('hidden', true)
    $('#importResult').prop('hidden', false).attr('data-type', type)
}

function hideImportResult () {
    $('#importResult').prop('hidden', true)
    setStatus($('#importStatus'), '')
}

function pluralize (count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`
}

function describeImportError (error) {
    if (error instanceof SyntaxError) return 'Not valid JSON'
    if (error.message.startsWith('Missing required field')) return 'Missing URL or title'
    if (error.message === 'Unsupported URL scheme') return 'Unsupported kind of URL'
    if (error instanceof TypeError || error.message.startsWith('Invalid URL')) {
        return 'Not a complete URL'
    }
    return error.message
}

async function importItems (content) {
    const entries = parseReadingList(content)
    const results = {
        success:           0,
        failed:            0,
        skipped:           [],
        usedLocalFallback: false,
    }

    for (const entry of entries) {
        try {
            if (entry.error) throw entry.error
            const imported = entry.item

            if (!imported?.url || !imported?.title) {
                throw new Error('Missing required field: url or title')
            }

            const url = parseReadingListUrl(imported.url)
            const page = {
                url,
                title:      imported.title,
                favIconUrl: getSiteFaviconUrl(url)
                    || `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`,
                date:       imported.timestamp
                    ? new Date(imported.timestamp).getTime()
                    : Date.now(),
                scroll:     imported.scroll
                    || { top: 0, height: 0, percent: '0%' },
                video:      imported.video
                    || { currentTime: 0, playbackRate: 1, percent: '0%' },
            }

            const result = await storage.setSavedPage(page)
            if (result.error) results.usedLocalFallback = true
            results.success++
        } catch (error) {
            results.failed++
            results.skipped.push({
                location: entry.location,
                reason:   describeImportError(error),
            })
            console.error(
                `Import error at ${entry.location}:`,
                error.message,
                '\nContent:',
                entry.source.substring(0, 100)
            )
        }
    }

    return results
}

function updateImportButton () {
    $('#importButton').prop('disabled', !$('#jsonInput').val().trim())
}

function bindExportControls () {
    $('input[name="exportFormat"]').on('change', renderExport)
    $('#copy').on('click', copyExport)
    $('#download').on('click', downloadExport)
}

async function refreshExport () {
    const $buttons = $('#copy, #download')
    $buttons.prop('disabled', true)

    try {
        const pages = await storage.sortSavedByLatest()
        exportItems = pages.map(simplifyPage)
        $('#exportSummary').text(exportItems.length
            ? `${pluralize(exportItems.length, 'item')} in your reading list.`
            : 'Your reading list is empty.')
        renderExport()
        $buttons.prop('disabled', exportItems.length === 0)
    } catch (error) {
        console.error('Read Later: unable to prepare export.', error)
        $('#exportSummary').text('The reading list could not be loaded.')
    }
}

function simplifyPage (page) {
    const result = {
        timestamp: new Date(page.date).toISOString(),
        title:     page.title,
        url:       page.url,
    }

    const isDefaultScroll = page.scroll?.top === 0
        && page.scroll?.height === 0
        && page.scroll?.percent === '0%'
    if (!isDefaultScroll) result.scroll = page.scroll

    const isDefaultVideo = page.video?.currentTime === 0
        && page.video?.playbackRate === 1
        && page.video?.percent === '0%'
    if (!isDefaultVideo) result.video = page.video

    return result
}

function renderExport () {
    const format = getChoice('exportFormat')
    $('#json-output').text(serializeReadingList(exportItems, format))
    $('#download').text(`Download ${format.toUpperCase()}`)
}

async function copyExport () {
    const $copy = $('#copy')
    try {
        await navigator.clipboard.writeText(getExportOutput())
        // Confirm on the button itself instead of with a separate message.
        clearTimeout(copyResetTimer)
        $copy.text('Copied').addClass('is-done')
        copyResetTimer = setTimeout(() => $copy.text('Copy').removeClass('is-done'), 1600)
    } catch (error) {
        console.error('Read Later: unable to copy export.', error)
        const message = 'Could not copy to the clipboard.'
        setStatus($('#optionsStatus'), message, 'error')
        setTimeout(() => {
            if ($('#optionsStatus').text() === message) setStatus($('#optionsStatus'), '')
        }, 4000)
    }
}

function downloadExport () {
    const format = getChoice('exportFormat')
    const mimeType = format === 'json'
        ? 'application/json'
        : 'application/x-ndjson'
    const blob = new Blob([getExportOutput()], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `reading-list-${new Date().toISOString().split('T')[0]}.${format}`
    link.click()
    URL.revokeObjectURL(url)
}

function getExportOutput () {
    return serializeReadingList(exportItems, getChoice('exportFormat'))
}

function setStatus ($element, message, type = '') {
    $element
        .removeClass('success warning error')
        .addClass(type)
        .text(message)
}

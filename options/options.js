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
let optionsStatusTimer
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
    $('.option-control').on('change', saveOptions)
}

async function loadOptions () {
    try {
        currentOptions = await storage.getOptions()
        applyOptions(currentOptions)
        await updateStorageControl(currentOptions)
    } catch (error) {
        console.error('Read Later: unable to load options.', error)
        setStatus($('#optionsStatus'), 'Could not load options.', 'error')
    }
}

function saveOptions () {
    const nextOptions = readOptions()
    const changeId = ++optionsChangeId
    clearTimeout(optionsStatusTimer)
    enableAvailableOptionControls()
    setStatus($('#optionsStatus'), 'Saving…')
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
        await updateStorageControl(
            currentOptions,
            !!result.modeError && currentOptions.hybrid,
            changeId
        )
        if (changeId !== optionsChangeId) return

        if (result.modeError) {
            setStatus(
                $('#optionsStatus'),
                'Other changes were saved, but the storage mode could not be changed.',
                'error'
            )
        } else if (result.syncError) {
            setStatus(
                $('#optionsStatus'),
                'Saved on this computer, but Chrome could not sync these options.',
                'warning'
            )
        } else {
            showTemporaryOptionsStatus('Saved', 'success')
        }
    } catch (error) {
        console.error('Read Later: unable to save options.', error)
        if (changeId !== optionsChangeId) return
        if (previousOptions) {
            currentOptions = previousOptions
            applyOptions(previousOptions)
            await updateStorageControl(previousOptions, false, changeId)
        }
        if (changeId !== optionsChangeId) return
        setStatus($('#optionsStatus'), 'Could not save these options.', 'error')
    } finally {
        if (changeId === optionsChangeId) enableAvailableOptionControls()
    }
}

function readOptions () {
    return {
        fontFamily:          $('#fontFamily').val(),
        itemNewTab:           $('#itemNewTab').prop('checked'),
        keepSavedTab:         $('#keepSavedTab').prop('checked'),
        itemHoverMode:        $('#itemHoverMode').val(),
        selectedItemIconMode: $('#selectedItemIconMode').val(),
        archiveMode:          $('#archiveMode').prop('checked'),
        archiveRetentionDays: Number($('#archiveRetentionDays').val()),
        hybrid:               $('#hybrid').prop('checked'),
        isOptions:            true,
    }
}

function applyOptions (options) {
    applyFontPreference(options)
    $('#fontFamily').val(options?.fontFamily ?? 'system')
    $('#itemNewTab').prop('checked', options?.itemNewTab)
    $('#keepSavedTab').prop('checked', options?.keepSavedTab)
    $('#itemHoverMode').val(options?.itemHoverMode)
    $('#selectedItemIconMode').val(options?.selectedItemIconMode)
    $('#archiveMode').prop('checked', options?.archiveMode)
    $('#archiveRetentionDays').val(String(options?.archiveRetentionDays ?? 0))
    $('#hybrid').prop('checked', options?.hybrid)
}

async function updateStorageControl (options, syncUnavailable = false, changeId) {
    const $hybrid = $('#hybrid')
    const $storageStatus = $('#storageStatus')

    if (options.hybrid && !syncUnavailable) {
        try {
            syncUnavailable = await storage.isSyncFull()
        } catch (error) {
            console.warn('Read Later: unable to check Chrome sync storage.', error)
        }
    }

    if (changeId !== undefined && changeId !== optionsChangeId) return

    $hybrid
        .prop('checked', options.hybrid)
        .data('syncUnavailable', syncUnavailable)

    if (syncUnavailable) {
        setStatus(
            $storageStatus,
            'Chrome Sync is full. New items will be stored locally.',
            'warning'
        )
    } else {
        setStatus(
            $storageStatus,
            options.hybrid
                ? 'Using Chrome Sync with local overflow.'
                : 'Using Chrome Sync only.'
        )
    }

    enableAvailableOptionControls()
}

function enableAvailableOptionControls () {
    $('.option-control').prop('disabled', false)
    $('#hybrid').prop(
        'disabled',
        $('#hybrid').data('syncUnavailable') === true
    )
    $('#archiveRetentionDays').prop(
        'disabled',
        !$('#archiveMode').prop('checked')
    )
}

function bindImportControls () {
    const $textarea = $('#jsonInput')

    $textarea.on('input', () => {
        updateImportButton()
        setStatus($('#importStatus'), '')
    })

    $('#fileInput').on('change', async event => {
        const file = event.target.files[0]
        if (!file) return

        $('#fileName').text(file.name)
        try {
            $textarea.val(await file.text())
            setStatus($('#importStatus'), '')
        } catch (error) {
            console.error('Read Later: unable to read import file.', error)
            setStatus($('#importStatus'), 'Could not read this file.', 'error')
        }
        updateImportButton()
    })

    $('#importButton').on('click', importReadingList)
    updateImportButton()
}

async function importReadingList () {
    const content = $('#jsonInput').val().trim()
    if (!content) return

    $('#importButton').prop('disabled', true)
    setStatus($('#importStatus'), 'Importing…')

    try {
        const results = await importItems(content)
        const syncWarning = results.usedLocalFallback
            ? ' Chrome Sync filled up, so overflow items were stored locally on this computer.'
            : ''

        if (results.failed === 0 && !results.usedLocalFallback) {
            setStatus(
                $('#importStatus'),
                `Imported ${results.success} items.`,
                'success'
            )
        } else {
            setStatus(
                $('#importStatus'),
                `Imported ${results.success} items; ${results.failed} failed.` +
                    `${syncWarning} Check the browser console for details.`,
                'warning'
            )
        }

        await Promise.all([
            loadOptions(),
            refreshExport(),
        ])
    } catch (error) {
        console.error('Read Later: import failed.', error)
        setStatus(
            $('#importStatus'),
            'Import failed. Check the browser console for details.',
            'error'
        )
    } finally {
        updateImportButton()
    }
}

async function importItems (content) {
    const entries = parseReadingList(content)
    const results = {
        success:           0,
        failed:            0,
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
    $('#exportFormat').on('change', renderExport)
    $('#copy').on('click', copyExport)
    $('#download').on('click', downloadExport)
}

async function refreshExport () {
    const $buttons = $('#copy, #download')
    $buttons.prop('disabled', true)

    try {
        const pages = await storage.sortSavedByLatest()
        exportItems = pages.map(simplifyPage)
        $('#exportSummary').text(
            `${exportItems.length} ${exportItems.length === 1 ? 'item' : 'items'} ready to export.`
        )
        setStatus($('#exportStatus'), '')
        renderExport()
        $buttons.prop('disabled', false)
    } catch (error) {
        console.error('Read Later: unable to prepare export.', error)
        $('#exportSummary').text('The reading list could not be loaded.')
        setStatus($('#exportStatus'), 'Could not prepare the export.', 'error')
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
    const format = $('#exportFormat').val()
    $('#json-output').text(serializeReadingList(exportItems, format))
    $('#download').text(`Download ${format.toUpperCase()}`)
}

async function copyExport () {
    try {
        await navigator.clipboard.writeText(getExportOutput())
        setStatus($('#exportStatus'), 'Copied to clipboard.', 'success')
    } catch (error) {
        console.error('Read Later: unable to copy export.', error)
        setStatus($('#exportStatus'), 'Could not copy to the clipboard.', 'error')
    }
}

function downloadExport () {
    const format = $('#exportFormat').val()
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
    setStatus($('#exportStatus'), `Downloaded ${format.toUpperCase()}.`, 'success')
}

function getExportOutput () {
    return serializeReadingList(exportItems, $('#exportFormat').val())
}

function showTemporaryOptionsStatus (message, type) {
    clearTimeout(optionsStatusTimer)
    setStatus($('#optionsStatus'), message, type)
    optionsStatusTimer = setTimeout(
        () => setStatus($('#optionsStatus'), ''),
        2000
    )
}

function setStatus ($element, message, type = '') {
    $element
        .removeClass('success warning error')
        .addClass(type)
        .text(message)
}

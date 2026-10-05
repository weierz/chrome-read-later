import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'

/* global globalThis */

const clone = value => JSON.parse(JSON.stringify(value))

const createStorageArea = (initialData = {}) => {
    let data = clone(initialData)
    let nextError
    let quotaBytes = Infinity
    let setCalls = 0

    return {
        failNextSet (message = 'QUOTA_BYTES quota exceeded') {
            nextError = message
        },
        fillQuota () {
            quotaBytes = JSON.stringify(data).length
        },
        resetQuota () {
            quotaBytes = Infinity
        },
        getSetCalls () {
            return setCalls
        },
        resetSetCalls () {
            setCalls = 0
        },
        get (key, callback) {
            if (key === undefined || key === null) {
                callback(clone(data))
                return
            }

            const keys = Array.isArray(key) ? key : [key]
            callback(Object.fromEntries(
                keys.filter(value => value in data)
                    .map(value => [value, clone(data[value])])
            ))
        },
        set (value, callback) {
            setCalls++
            if (Object.entries(value).some(([key, item]) =>
                new TextEncoder().encode(key + JSON.stringify(item)).length
                    > (this.QUOTA_BYTES_PER_ITEM ?? Infinity)
            )) {
                chrome.runtime.lastError = {
                    message: 'QUOTA_BYTES_PER_ITEM quota exceeded',
                }
                callback()
                delete chrome.runtime.lastError
                return
            }
            if (nextError) {
                chrome.runtime.lastError = { message: nextError }
                nextError = undefined
                callback()
                delete chrome.runtime.lastError
                return
            }

            const nextData = { ...data, ...clone(value) }
            if (JSON.stringify(nextData).length > quotaBytes) {
                chrome.runtime.lastError = {
                    message: 'QUOTA_BYTES quota exceeded',
                }
                callback()
                delete chrome.runtime.lastError
                return
            }

            data = nextData
            callback()
        },
        remove (key, callback) {
            const keys = Array.isArray(key) ? key : [key]
            keys.forEach(value => delete data[value])
            callback()
        },
        clear (callback) {
            data = {}
            callback()
        },
        getBytesInUse (key, callback) {
            callback(JSON.stringify(data).length)
        },
    }
}

const page = (url, date) => ({
    url,
    date,
    title:      url,
    scroll:     { top: 0, height: 0 },
    video:      { currentTime: 0, playbackRate: 1 },
    favIconUrl: '',
})

const syncArea = createStorageArea()
syncArea.QUOTA_BYTES = 102400
syncArea.MAX_ITEMS = 512
const localArea = createStorageArea()
const sessionArea = createStorageArea()

globalThis.chrome = {
    runtime: {},
    storage: {
        sync:    syncArea,
        local:   localArea,
        session: sessionArea,
    },
}

let storage

beforeAll(async () => {
    storage = await import('./storage.mjs')
})

beforeEach(async () => {
    syncArea.resetQuota()
    syncArea.QUOTA_BYTES = 102400
    syncArea.QUOTA_BYTES_PER_ITEM = 8192
    syncArea.MAX_ITEMS = 512
    await storage.sync.clear()
    await storage.local.clear()
    await storage.localSaved.clear()
    syncArea.resetSetCalls()
})

describe('hybrid reading list storage', () => {
    test('shows item details and enables the archive by default', async () => {
        const options = await storage.getOptions()

        expect(options.itemHoverMode).toBe('details')
        expect(options.selectedItemIconMode).toBe('always')
        expect(options.countFormat).toBe('slash')
        expect(options.archiveMode).toBe(true)
        expect(options.archiveRetentionDays).toBe(0)
    })

    test('migrates the disabled item popover to no hover behavior', async () => {
        await storage.local.set({
            options: {
                itemPopover: false,
                isOptions:   true,
            },
        })

        const options = await storage.getOptions()

        expect(options.itemHoverMode).toBe('never')
        expect(options.itemPopover).toBeUndefined()
    })

    test('reads legacy history settings as archive settings', async () => {
        await storage.local.set({
            options: {
                historyMode:          false,
                historyRetentionDays: 30,
                isOptions:            true,
            },
        })

        const options = await storage.getOptions()

        expect(options.archiveMode).toBe(false)
        expect(options.archiveRetentionDays).toBe(30)
        expect(options.historyMode).toBeUndefined()
        expect(options.historyRetentionDays).toBeUndefined()

        await storage.setOptions({ archiveMode: true })
        const savedOptions = (await storage.local.get('options')).options

        expect(savedOptions.archiveMode).toBe(true)
        expect(savedOptions.archiveRetentionDays).toBe(30)
        expect(savedOptions.historyMode).toBeUndefined()
        expect(savedOptions.historyRetentionDays).toBeUndefined()
    })

    test('does not archive new items when archive mode is disabled', async () => {
        await storage.setOptions({ archiveMode: false })

        await storage.setSavedPage(page('https://no-archive.example', 1))

        expect(await storage.sync.sortByLatest()).toHaveLength(1)
        expect(await storage.local.sortByLatest()).toHaveLength(0)
    })

    test('keeps only the latest archived items', async () => {
        const archivePages = Object.fromEntries(
            Array.from({ length: storage.ARCHIVE_ITEM_LIMIT }, (_, index) => {
                const savedPage = page(`https://archive-${index}.example`, index)
                return [savedPage.url, savedPage]
            })
        )
        await storage.local.set(archivePages)

        await storage.setSavedPage(page(
            'https://new-archive.example',
            storage.ARCHIVE_ITEM_LIMIT + 1
        ))

        const archive = await storage.local.sortByLatest()
        expect(archive).toHaveLength(storage.ARCHIVE_ITEM_LIMIT)
        expect(archive[0].url).toBe('https://new-archive.example')
        expect(
            archive.some(item => item.url === 'https://archive-0.example')
        ).toBe(false)
    })

    test('updates an archived item without removing another item', async () => {
        const archivePages = Object.fromEntries(
            Array.from({ length: storage.ARCHIVE_ITEM_LIMIT }, (_, index) => {
                const savedPage = page(`https://archive-${index}.example`, index)
                return [savedPage.url, savedPage]
            })
        )
        await storage.local.set(archivePages)

        await storage.setSavedPage(page(
            'https://archive-0.example',
            storage.ARCHIVE_ITEM_LIMIT + 1
        ))

        const archive = await storage.local.sortByLatest()
        expect(archive).toHaveLength(storage.ARCHIVE_ITEM_LIMIT)
        expect(archive[0].url).toBe('https://archive-0.example')
    })

    test('cleans up excess archive items without removing local overflow', async () => {
        const pages = Object.fromEntries(
            Array.from({ length: storage.ARCHIVE_ITEM_LIMIT + 1 }, (_, index) => {
                const savedPage = page(`https://archive-${index}.example`, index)
                return [savedPage.url, savedPage]
            })
        )
        await storage.local.set(pages)
        await storage.localSaved.set(page('https://overflow.example', 1000))

        expect(await storage.cleanupArchive()).toBe(1)

        expect(await storage.local.sortByLatest()).toHaveLength(
            storage.ARCHIVE_ITEM_LIMIT
        )
        expect(await storage.localSaved.sortByLatest()).toHaveLength(1)
    })

    test('applies a selected time range immediately and locally', async () => {
        const now = Date.now()
        const day = 24 * 60 * 60 * 1000
        await storage.local.set(page('https://old-archive.example', now - 31 * day))
        await storage.local.set(page('https://recent-archive.example', now - 29 * day))

        await storage.setOptions({ archiveRetentionDays: 30 })

        expect((await storage.local.sortByLatest()).map(item => item.url)).toEqual([
            'https://recent-archive.example',
        ])
        expect((await storage.local.get('options')).options.archiveRetentionDays).toBe(30)
        expect(
            (await storage.sync.get('options')).options.archiveRetentionDays
        ).toBeUndefined()
    })

    test('keeps the selected item icon mode local', async () => {
        await storage.setOptions({ selectedItemIconMode: 'mixed' })

        expect(
            (await storage.local.get('options')).options.selectedItemIconMode
        ).toBe('mixed')
        expect(
            (await storage.sync.get('options')).options.selectedItemIconMode
        ).toBeUndefined()
    })

    test('keeps the count format local', async () => {
        await storage.setOptions({ countFormat: 'total' })

        expect((await storage.local.get('options')).options.countFormat).toBe('total')
        expect(
            (await storage.sync.get('options')).options.countFormat
        ).toBeUndefined()
    })

    test('uses the system font by default', async () => {
        expect((await storage.getOptions()).fontFamily).toBe('system')
    })

    test('prefers the local font over a synced font', async () => {
        await storage.local.set({
            options: { fontFamily: 'monospace', isOptions: true },
        })
        await storage.sync.set({
            options: { fontFamily: 'serif', isOptions: true },
        })

        expect((await storage.getOptions()).fontFamily).toBe('monospace')
    })

    test('reads a legacy synced font when no local font is saved', async () => {
        await storage.sync.set({
            options: { fontFamily: 'avenir', isOptions: true },
        })

        expect((await storage.getOptions()).fontFamily).toBe('avenir')
    })

    test('saves the font locally and removes legacy synced fonts', async () => {
        await storage.sync.set({
            options: { fontFamily: 'avenir', isOptions: true },
        })

        await storage.setOptions({ fontFamily: 'serif' })

        expect((await storage.local.get('options')).options.fontFamily)
            .toBe('serif')
        expect((await storage.sync.get('options')).options.fontFamily)
            .toBeUndefined()
        expect((await storage.getOptions()).fontFamily).toBe('serif')
    })

    test('normalizes invalid saved fonts to the system font', async () => {
        await storage.sync.set({
            options: { fontFamily: 'unsupported', isOptions: true },
        })
        expect((await storage.getOptions()).fontFamily).toBe('system')

        await storage.sync.set({
            options: { fontFamily: 'serif', isOptions: true },
        })
        await storage.local.set({
            options: { fontFamily: '__proto__', isOptions: true },
        })
        expect((await storage.getOptions()).fontFamily).toBe('system')
    })

    test('saving the font keeps other synced options and saved pages', async () => {
        await storage.sync.set({
            options: { itemNewTab: true, keepSavedTab: true, fontFamily: 'avenir', isOptions: true },
            'https://example.com/kept': page('https://example.com/kept', 1),
        })

        await storage.setOptions({ fontFamily: 'monospace' })

        const synced = await storage.sync.get(['options', 'https://example.com/kept'])
        expect(synced.options.itemNewTab).toBe(true)
        expect(synced.options.keepSavedTab).toBe(true)
        expect(synced.options.fontFamily).toBeUndefined()
        expect(synced['https://example.com/kept'].url).toBe('https://example.com/kept')
        expect((await storage.getOptions()).fontFamily).toBe('monospace')
    })

    test('keeps the font locally when Chrome Sync rejects the options write', async () => {
        syncArea.failNextSet()

        const result = await storage.setOptions({ fontFamily: 'serif' })

        expect(result.syncError).toBeDefined()
        expect((await storage.getOptions()).fontFamily).toBe('serif')
    })

    test('normalizes invalid font input before saving', async () => {
        const result = await storage.setOptions({ fontFamily: { family: 'serif' } })

        expect(result.options.fontFamily).toBe('system')
        expect((await storage.local.get('options')).options.fontFamily)
            .toBe('system')
        expect((await storage.getOptions()).fontFamily).toBe('system')
    })

    test('applies the time range before archiving a new item', async () => {
        const day = 24 * 60 * 60 * 1000
        await storage.setOptions({ archiveRetentionDays: 7 })
        await storage.local.set(page(
            'https://old-archive.example',
            Date.now() - 8 * day
        ))

        await storage.setSavedPage(page('https://new-archive.example', Date.now()))

        expect((await storage.local.sortByLatest()).map(item => item.url)).toEqual([
            'https://new-archive.example',
        ])
    })

    test('retains local options after a failed sync and resumes remote updates after saving', async () => {
        await storage.setOptions({ hybrid: false, keepSavedTab: false })
        syncArea.failNextSet('MAX_WRITE_OPERATIONS_PER_MINUTE exceeded')

        const result = await storage.setOptions({ hybrid: false, keepSavedTab: true })

        expect(result.syncError).toBeDefined()
        expect((await storage.getOptions()).keepSavedTab).toBe(true)
        await storage.useHybridStorage()
        expect((await storage.getOptions()).keepSavedTab).toBe(true)
        expect((await storage.getOptions()).syncPending).toBeUndefined()

        await storage.setOptions(await storage.getOptions())
        expect((await storage.sync.get('options')).options.keepSavedTab).toBe(true)
        expect((await storage.sync.get('options')).options.syncPending).toBeUndefined()
        await storage.sync.set({ options: { keepSavedTab: false, isOptions: true } })
        expect((await storage.getOptions()).keepSavedTab).toBe(false)
        expect((await storage.getOptions()).hybrid).toBe(true)
    })

    test('promotes smaller overflow past an item that exceeds the per-item quota', async () => {
        await storage.setOptions({ hybrid: true })
        const oversized = { ...page('https://large.example', 1), title: 'x'.repeat(8192) }
        await storage.localSaved.set(oversized)
        await storage.localSaved.set(page('https://small.example', 2))

        await storage.rebalanceHybridStorage()

        expect((await storage.sync.sortByLatest()).map(item => item.url))
            .toEqual(['https://small.example'])
        expect((await storage.localSaved.sortByLatest()).map(item => item.url))
            .toEqual([oversized.url])
    })

    test('does not defer normal saves after a per-item quota failure', async () => {
        await storage.setOptions({ hybrid: true })
        await storage.setSavedPage({ ...page('https://large.example', 1), title: 'x'.repeat(8192) })

        const result = await storage.setSavedPage(page('https://small.example', 2))

        expect(result.syncSaved).toBe(true)
        expect(await storage.localSaved.sortByLatest()).toHaveLength(1)
    })

    test('shows the union of synced and local overflow items', async () => {
        await storage.sync.set(page('https://synced.example', 2))
        await storage.local.set(page('https://archive.example', 1))
        await storage.localSaved.set(page('https://local.example', 3))

        const result = await storage.setOptions({ hybrid: true })

        expect(result.error).toBeUndefined()
        expect((await storage.sortSavedByLatest()).map(item => item.url)).toEqual([
            'https://local.example',
            'https://synced.example',
        ])
        expect((await storage.local.sortByLatest()).map(item => item.url)).toEqual([
            'https://archive.example',
        ])
    })

    test('deduplicates pages that exist in both active stores', async () => {
        await storage.sync.set(page('https://same.example', 1))
        await storage.localSaved.set(page('https://same.example', 2))
        await storage.setOptions({ hybrid: true })

        const pages = await storage.sortSavedByLatest()

        expect(pages).toHaveLength(1)
        expect(pages[0].date).toBe(2)
    })

    test('falls back without losing the page when Chrome sync is full', async () => {
        await storage.sync.set(page('https://synced.example', 1))
        syncArea.fillQuota()

        const result = await storage.setSavedPage(page('https://new.example', 2))

        expect(result.error?.message).toContain('quota exceeded')
        expect((await storage.getOptions()).hybrid).toBe(true)
        expect((await storage.localSaved.sortByLatest()).map(item => item.url)).toEqual([
            'https://new.example',
        ])
        expect((await storage.sortSavedByLatest()).map(item => item.url)).toEqual([
            'https://new.example',
            'https://synced.example',
        ])
    })

    test('continues trying sync and removes a local duplicate on success', async () => {
        const savedPage = page('https://local.example', 1)
        await storage.localSaved.set(savedPage)
        await storage.setOptions({ hybrid: true })

        const result = await storage.setSavedPage(page(savedPage.url, 2))

        expect(result.syncSaved).toBe(true)
        expect(await storage.sync.sortByLatest()).toHaveLength(1)
        expect(await storage.localSaved.sortByLatest()).toHaveLength(0)
    })

    test('makes overflow authoritative when updating a synced page fails', async () => {
        const url = 'https://updated.example'
        await storage.sync.set(page(url, 1))
        syncArea.failNextSet()

        await storage.setSavedPage(page(url, 2))

        expect(await storage.sync.sortByLatest()).toHaveLength(0)
        expect((await storage.localSaved.sortByLatest())[0].date).toBe(2)
    })

    test('reports when Chrome sync storage is full', async () => {
        await storage.sync.set(page('https://synced.example', 1))
        syncArea.QUOTA_BYTES = 1

        expect(await storage.isSyncFull()).toBe(true)
    })

    test('estimates how many sync items remain', async () => {
        await storage.sync.set(page('https://one.example', 1))
        await storage.sync.set(page('https://two.example', 2))
        await storage.sync.set(page('https://three.example', 3))
        syncArea.MAX_ITEMS = 10

        const capacity = await storage.getSyncCapacity()

        expect(capacity.remainingItems).toBe(7)
        expect(capacity.isNearQuota).toBe(true)
    })

    test('counts only local overflow items', async () => {
        await storage.sync.set(page('https://synced.example', 1))
        await storage.localSaved.set(page('https://synced.example', 1))
        await storage.localSaved.set(page('https://local-one.example', 2))
        await storage.localSaved.set(page('https://local-two.example', 3))

        expect(await storage.getLocalOverflowCount()).toBe(2)
    })

    test('removes hybrid items from both active stores', async () => {
        const savedPage = page('https://synced.example', 1)
        await storage.sync.set(savedPage)
        await storage.local.set(savedPage)
        await storage.localSaved.set(savedPage)

        await storage.removeHybridSavedPage(savedPage.url)

        expect(await storage.sync.sortByLatest()).toHaveLength(0)
        expect(await storage.localSaved.sortByLatest()).toHaveLength(0)
        expect(await storage.local.sortByLatest()).toHaveLength(1)
    })

    test('keeps hybrid mode enabled when overflow does not fit in sync', async () => {
        await storage.setOptions({ hybrid: true })
        await storage.localSaved.set(page('https://local.example', 1))
        syncArea.failNextSet()

        const result = await storage.setOptions({ hybrid: false })

        expect(result.error?.message).toContain('quota exceeded')
        expect(result.options.hybrid).toBe(true)
        expect((await storage.getOptions()).hybrid).toBe(true)
    })

    test('moves overflow to sync when hybrid mode is disabled', async () => {
        await storage.setOptions({ hybrid: true })
        await storage.localSaved.set(page('https://local.example', 1))

        const result = await storage.setOptions({ hybrid: false })

        expect(result.error).toBeUndefined()
        expect(result.options.hybrid).toBe(false)
        expect(await storage.sync.sortByLatest()).toHaveLength(1)
        expect(await storage.localSaved.sortByLatest()).toHaveLength(0)
    })

    test('promotes local overflow after sync space is freed', async () => {
        await storage.setOptions({ hybrid: true })
        await storage.localSaved.set(page('https://local.example', 1))

        await storage.rebalanceHybridStorage()

        expect(await storage.sync.sortByLatest()).toHaveLength(1)
        expect(await storage.localSaved.sortByLatest()).toHaveLength(0)
    })

    test('promotes existing overflow before saving a new page', async () => {
        await storage.setOptions({ hybrid: true })
        await storage.localSaved.set(page('https://local.example', 1))

        await storage.setSavedPage(page('https://new.example', 2))

        expect((await storage.sync.sortByLatest()).map(item => item.url)).toEqual([
            'https://new.example',
            'https://local.example',
        ])
        expect(await storage.localSaved.sortByLatest()).toHaveLength(0)
    })

    test('stops promotion after the first total-quota failure', async () => {
        await storage.setOptions({ hybrid: true })
        await storage.localSaved.set(page('https://local-one.example', 1))
        await storage.localSaved.set(page('https://local-two.example', 2))
        syncArea.fillQuota()
        syncArea.resetSetCalls()

        await storage.rebalanceHybridStorage()

        expect(syncArea.getSetCalls()).toBe(1)
        expect(await storage.localSaved.sortByLatest()).toHaveLength(2)
    })

    test('defers later sync writes after a quota failure', async () => {
        await storage.setOptions({ hybrid: true })
        syncArea.fillQuota()
        syncArea.resetSetCalls()

        await storage.setSavedPage(page('https://local-one.example', 1))
        const result = await storage.setSavedPage(
            page('https://local-two.example', 2)
        )

        expect(syncArea.getSetCalls()).toBe(1)
        expect(result.deferred).toBe(true)
        expect(await storage.localSaved.sortByLatest()).toHaveLength(2)
    })

    test('migrates the previous local-only option to hybrid mode', async () => {
        await storage.local.set({
            options: { localOnly: true, isOptions: true },
        })

        const options = await storage.getOptions()

        expect(options.hybrid).toBe(true)
        expect(options.localOnly).toBeUndefined()
    })
})

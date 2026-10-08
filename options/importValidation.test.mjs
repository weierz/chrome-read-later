import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as formats from './readingListFormat.mjs'
import { getSiteFaviconUrl } from '../modules/favicon.mjs'

const optionsSource = readFileSync(new URL('./options.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*? from '[^']+'\n/gm, '')
const storageSource = readFileSync(new URL('../modules/chrome/storage.mjs', import.meta.url), 'utf8')
    .replace(/^export /gm, '')
const storageImports = [...storageSource.matchAll(/^import[\s\S]*? from '([^']+)'\n/gm)]
const storageDependencies = Object.assign({}, ...await Promise.all(storageImports.map(match =>
    import(new URL(match[1], new URL('../modules/chrome/storage.mjs', import.meta.url)).href)
)))

function createArea () {
    let data = {}
    return {
        get (key, callback) {
            const keys = key == null ? Object.keys(data) : Array.isArray(key) ? key : [key]
            callback(structuredClone(Object.fromEntries(
                keys.filter(item => item in data).map(item => [item, data[item]])
            )))
        },
        set (value, callback) { Object.assign(data, structuredClone(value)); callback() },
        remove (key, callback) {
            for (const item of Array.isArray(key) ? key : [key]) delete data[item]
            callback()
        },
    }
}

function importContext () {
    const context = vm.createContext({
        ...formats,
        ...storageDependencies,
        URL,
        getSiteFaviconUrl,
        $ () {},
        console: { error () {}, warn () {} },
        chrome: {
            runtime: { id: 'extension-id' },
            storage: { sync: createArea(), local: createArea(), session: createArea() },
        },
    })
    vm.runInContext(storageSource.replace(/^import[\s\S]*? from '[^']+'\n/gm, ''), context)
    vm.runInContext('globalThis.storage = { getOptions, setOptions, setSavedPage, sortSavedByLatest }', context)
    vm.runInContext(optionsSource, context)
    return context
}

async function importEntries (context, items) {
    context.importContent = JSON.stringify(items)
    return vm.runInContext('importItems(importContent)', context)
}

describe('import URL validation', () => {
    test('rejects a reserved URL without overwriting settings and still imports valid entries', async () => {
        const context = importContext()
        await vm.runInContext('storage.setOptions({ archiveMode: true, itemNewTab: true, keepSavedTab: true, archiveRetentionDays: 7 })', context)

        const result = await importEntries(context, [
            { url: 'options', title: 'Reserved storage key' },
            { url: 'https://example.com/article', title: 'Valid article' },
        ])

        expect(result.success).toBe(1)
        expect(result.failed).toBe(1)
        const options = await vm.runInContext('storage.getOptions()', context)
        expect(options.itemNewTab).toBe(true)
        expect(options.keepSavedTab).toBe(true)
        expect(options.archiveRetentionDays).toBe(7)
        const pages = await vm.runInContext('storage.sortSavedByLatest()', context)
        expect(pages.map(page => page.url)).toEqual(['https://example.com/article'])
    })

    test('rejects invalid types, relative URLs, reserved prefixes and unsupported schemes', async () => {
        const context = importContext()
        const result = await importEntries(context, [
            123, { nested: 'url' }, 'example.com/article', '//example.com/article',
            'saved:https://example.com/article', 'javascript:alert(1)',
            'data:text/html,<h1>Example</h1>', 'unknown:page',
        ].map(url => ({ url, title: 'Invalid page' })))

        expect(result.success).toBe(0)
        expect(result.failed).toBe(8)
        expect(await vm.runInContext('storage.sortSavedByLatest()', context)).toEqual([])
    })

    test('preserves website, file and browser URLs accepted by the reading list', async () => {
        const context = importContext()
        const urls = [
            'http://example.com/article', 'https://example.com/article',
            'file:///tmp/article.html', 'chrome://newtab/',
            'chrome-extension://extension-id/options/options.html', 'about:blank',
        ]
        const result = await importEntries(context, urls.map(url => ({ url, title: url })))

        expect(result.success).toBe(6)
        expect(result.failed).toBe(0)
        const pages = await vm.runInContext('storage.sortSavedByLatest()', context)
        expect(pages.map(page => page.url).sort()).toEqual([...urls].sort())
    })
})

describe('9.3.0 review fixtures', () => {
    const fixture = name => readFileSync(
        new URL(`../test-data/review-9.3.0/${name}`, import.meta.url), 'utf8'
    )
    const expectedUrls = [
        'https://example.com/review/article',
        'https://example.com/review/padded',
        'http://example.org/review/plain-http',
        'https://www.youtube.com/watch?v=fnaFiMabPq8',
        'file:///Users/Shared/read-later-review.html',
        'chrome://extensions/',
        'chrome-extension://abcdefghijklmnopabcdefghijklmnop/options/options.html',
        'about:blank',
    ]

    async function importFixture (name) {
        const context = importContext()
        await vm.runInContext('storage.setOptions({ itemNewTab: true, archiveMode: true })', context)
        context.importContent = fixture(name)
        const result = await vm.runInContext('importItems(importContent)', context)
        const pages = await vm.runInContext('storage.sortSavedByLatest()', context)
        const options = await vm.runInContext('storage.getOptions()', context)
        return { result, pages, options }
    }

    for (const [name, failed] of [['import-mixed.json', 11], ['import-mixed.jsonl', 12]]) {
        test(`${name} imports only valid entries and keeps settings`, async () => {
            const { result, pages, options } = await importFixture(name)

            expect(result.success).toBe(expectedUrls.length)
            expect(result.failed).toBe(failed)
            expect(pages.map(page => page.url).sort()).toEqual([...expectedUrls].sort())
            expect(options.itemNewTab).toBe(true)
            expect(options.archiveMode).toBe(true)
            expect(options.hybrid).toBeUndefined()
        })
    }

    test('keeps imported reading and video progress', async () => {
        const { pages } = await importFixture('import-mixed.json')
        const byUrl = Object.fromEntries(pages.map(page => [page.url, page]))

        expect(byUrl['https://example.com/review/article'].scroll.percent).toBe('40%')
        expect(byUrl['https://www.youtube.com/watch?v=fnaFiMabPq8'].video.percent).toBe('35%')
        expect(byUrl['https://example.com/review/article'].date)
            .toBe(Date.parse('2026-10-01T09:00:00Z'))
    })
})

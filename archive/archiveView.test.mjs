import { describe, expect, test } from 'bun:test'
import {
    countSites,
    filterArchivePages,
    getArchiveKeyBinding,
    getArchiveProgress,
    getDisplayUrl,
    getSiteName,
    groupArchivePages,
    splitMatches,
} from './archiveView.mjs'

const pages = [
    { title: 'A useful article', url: 'https://example.com/article' },
    { title: 'Release notes', url: 'https://github.com/example/release' },
    { title: 'Another', url: 'https://www.example.com/other' },
]

describe('archive view', () => {
    test('filters by title or URL without changing the source list', () => {
        expect(filterArchivePages(pages, 'USEFUL')).toEqual([pages[0]])
        expect(filterArchivePages(pages, 'github.com')).toEqual([pages[1]])
        expect(filterArchivePages(pages, '')).toEqual(pages)
        expect(filterArchivePages(pages, '')).not.toBe(pages)
    })

    test('filters by site, combined with the query', () => {
        expect(filterArchivePages(pages, '', 'example.com'))
            .toEqual([pages[0], pages[2]])
        expect(filterArchivePages(pages, 'other', 'example.com'))
            .toEqual([pages[2]])
        expect(filterArchivePages(pages, 'release', 'example.com'))
            .toEqual([])
    })

    test('names sites without www', () => {
        expect(getSiteName('https://www.example.com/a')).toBe('example.com')
        expect(getSiteName('not a URL')).toBe('not a URL')
    })

    test('counts sites, most pages first', () => {
        expect(countSites(pages)).toEqual([
            { site: 'example.com', count: 2 },
            { site: 'github.com', count: 1 },
        ])
    })

    test('groups recent pages by day and older pages by month', () => {
        const now = new Date(2026, 9, 9, 15)
        const at = (...args) => ({ date: new Date(...args).getTime() })
        const groups = groupArchivePages([
            at(2026, 9, 9, 10),
            at(2026, 9, 9, 1),
            at(2026, 9, 8, 23),
            at(2026, 9, 5, 12),
            at(2026, 9, 1, 12),
            at(2026, 8, 30, 12),
            at(2025, 8, 30, 12),
        ], now, 'en-US')

        expect(groups.map(group => [group.label, group.pages.length]))
            .toEqual([
                ['Today', 2],
                ['Yesterday', 1],
                ['Monday', 1],
                ['October', 1],
                ['September', 1],
                ['September 2025', 1],
            ])
        expect(groups.map(group => group.kind))
            .toEqual(['day', 'day', 'day', 'month', 'month', 'month'])
    })

    test('formats a compact display URL', () => {
        expect(getDisplayUrl('https://example.com/article')).toBe(
            'example.com/article'
        )
        expect(getDisplayUrl('not a URL')).toBe('not a URL')
    })

    test('splits text into highlighted matches', () => {
        expect(splitMatches('Read Later reads', 'READ')).toEqual([
            { text: 'Read', match: true },
            { text: ' Later ', match: false },
            { text: 'read', match: true },
            { text: 's', match: false },
        ])
        expect(splitMatches('Plain', ' ')).toEqual([
            { text: 'Plain', match: false },
        ])
    })

    test('prefers in-progress video progress over reading progress', () => {
        expect(getArchiveProgress({
            video:  { percent: '42%' },
            scroll: { top: 120, percent: '60%' },
        })).toEqual({ label: '42%', type: 'video' })
    })

    test('shows reading progress when there is no active video', () => {
        expect(getArchiveProgress({
            video:  { percent: '100%' },
            scroll: { top: 120, percent: '60%' },
        })).toEqual({ label: '60%', type: 'scroll' })
        expect(getArchiveProgress({ scroll: { top: 0, percent: '0%' } }))
            .toBeUndefined()
    })

    test('maps keys like the popup, with doubled d, g and y', () => {
        const key = (key, extra = {}) => ({ key, ...extra })
        expect(getArchiveKeyBinding(key('j'))).toBe('j')
        expect(getArchiveKeyBinding(key('d'), 'none')).toBe('d')
        expect(getArchiveKeyBinding(key('d'), 'd')).toBe('dd')
        expect(getArchiveKeyBinding(key('g'), 'g')).toBe('gg')
        expect(getArchiveKeyBinding(key('Enter', { metaKey: true })))
            .toBe('Meta + Enter')
        expect(getArchiveKeyBinding(key('z', { ctrlKey: true })))
            .toBe('Meta + z')
        expect(getArchiveKeyBinding(key('j', { metaKey: true }))).toBe('none')
        expect(getArchiveKeyBinding(key('q'))).toBe('none')
    })
})

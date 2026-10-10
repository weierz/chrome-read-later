import { describe, expect, test } from 'bun:test'
import {
    filterArchivePages,
    getArchiveKeyBinding,
    getArchiveProgress,
    getDisplayUrl,
    splitMatches,
} from './archiveView.mjs'

const pages = [
    { title: 'A useful article', url: 'https://example.com/article' },
    { title: 'Release notes', url: 'https://github.com/example/release' },
]

describe('archive view', () => {
    test('filters by title or URL without changing the source list', () => {
        expect(filterArchivePages(pages, 'USEFUL')).toEqual([pages[0]])
        expect(filterArchivePages(pages, 'github.com')).toEqual([pages[1]])
        expect(filterArchivePages(pages, '')).toEqual(pages)
        expect(filterArchivePages(pages, '')).not.toBe(pages)
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

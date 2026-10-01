import { beforeAll, describe, expect, test } from 'bun:test'

/* global globalThis */

globalThis.chrome = { runtime: { id: 'extension-id' } }
globalThis.he = { encode: value => value }

let getTitleScrollMetrics
let getMixedHoverMode
let renderLiFrom

beforeAll(async () => {
    ({
        getMixedHoverMode,
        getTitleScrollMetrics,
        renderLiFrom,
    } = await import('./readingItemGenerator.js'))
})

const page = {
    url:        'https://local.example',
    title:      'Local overflow item',
    date:       1,
    favIconUrl: '',
    scroll:     { top: 0 },
    video:      {},
}

describe('reading item storage styling', () => {
    test('marks local overflow rows', () => {
        expect(renderLiFrom(page, { isLocalOverflow: true }))
            .toContain('class="local-overflow"')
    })

    test('does not mark synced rows', () => {
        expect(renderLiFrom(page))
            .not.toContain('local-overflow')
    })

    test('uses the shared tooltip instead of a native title', () => {
        const html = renderLiFrom(page)

        expect(html).toContain('data-tooltip=')
        expect(html).toContain('data-tooltip-delay="800"')
        expect(html).not.toContain(' title=')
    })

    test('scrolls the title without showing details', () => {
        const html = renderLiFrom(page, { hoverMode: 'title' })

        expect(html).not.toContain('data-tooltip=')
        expect(html).toContain('class="scroll-title"')
        expect(html).toContain('class="title-track"')
        expect(html).toContain('class="title-repeat"')
        expect(html.match(/Local overflow item/g)).toHaveLength(2)
    })

    test('does not scroll a title that fits', () => {
        expect(getTitleScrollMetrics(200, 300)).toBeUndefined()
    })

    test('scrolls medium and long titles at the same speed', () => {
        const mediumTitle = getTitleScrollMetrics(400, 300)
        const longTitle = getTitleScrollMetrics(600, 300)

        expect(mediumTitle.distance).toBe(432)
        expect(longTitle.distance).toBe(632)
        expect(mediumTitle.distance / mediumTitle.duration).toBe(40)
        expect(longTitle.distance / longTitle.duration).toBe(40)
        expect(longTitle.duration).toBeCloseTo(15.8)
    })

    test('chooses mixed hover behavior from the rendered title length', () => {
        expect(getMixedHoverMode(300, 300)).toBe('never')
        expect(getMixedHoverMode(301, 300)).toBe('title')
        expect(getMixedHoverMode(600, 300)).toBe('title')
        expect(getMixedHoverMode(601, 300)).toBe('details')
    })

    test('renders mixed titles for post-render measurement', () => {
        const html = renderLiFrom(page, { hoverMode: 'mixed' })

        expect(html).toContain('class="mixed-hover"')
        expect(html).toContain('data-mixed-tooltip=')
        expect(html).not.toContain(' data-tooltip=')
        expect(html).toContain('class="title-track"')
    })

    test('can disable item hover behavior', () => {
        const html = renderLiFrom(page, { hoverMode: 'never' })

        expect(html).not.toContain('data-tooltip=')
        expect(html).not.toContain('scroll-title')
    })

    test('renders Chrome fallback while the site favicon loads', () => {
        const html = renderLiFrom({
            ...page,
            favIconUrl: 'https://stored.example/favicon.png',
        })

        expect(html).toContain(
            'src="chrome-extension://extension-id/_favicon/'
        )
        expect(html).toContain(
            'data-site-favicon-src="https://t0.gstatic.com/faviconV2?'
        )
        expect(html).toContain('url=https%3A%2F%2Flocal.example')
        expect(html).not.toContain('https://stored.example/favicon.png')
    })
})

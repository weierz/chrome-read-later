import { describe, expect, test } from 'bun:test'
import {
    applySiteFavicon,
    applyFaviconFallback,
    getSiteFaviconFallbackUrl,
    getChromeFaviconUrl,
    getSiteFaviconUrl,
} from './favicon.mjs'

describe('site favicon URL', () => {
    test('requests the site origin instead of the exact page URL', () => {
        const faviconUrl = new URL(getSiteFaviconUrl(
            'https://example.com/articles/read-later?source=feed#comments'
        ))

        expect(faviconUrl.origin).toBe('https://t0.gstatic.com')
        expect(faviconUrl.pathname).toBe('/faviconV2')
        expect(faviconUrl.searchParams.get('url'))
            .toBe('https://example.com')
        expect(faviconUrl.searchParams.get('size')).toBe('32')
        expect(faviconUrl.searchParams.get('nfrp')).toBe('2')
        expect(faviconUrl.searchParams.get('check_seen')).toBe('true')
    })

    test('preserves the subdomain and port', () => {
        const faviconUrl = new URL(getSiteFaviconUrl(
            'http://docs.example.com:8080/guide'
        ))

        expect(faviconUrl.searchParams.get('url'))
            .toBe('http://docs.example.com:8080')
    })

    test('rejects malformed and non-website URLs', () => {
        expect(getSiteFaviconUrl('not a url')).toBe('')
        expect(getSiteFaviconUrl('chrome://settings')).toBe('')
    })

    test('creates an immediate Chrome favicon URL', () => {
        expect(getChromeFaviconUrl(
            'https://local.example/article',
            'extension-id'
        )).toBe(
            'chrome-extension://extension-id/_favicon/' +
            '?pageUrl=https%3A%2F%2Flocal.example%2Farticle&size=32'
        )
    })

    test('applies a loaded site favicon', () => {
        const image = {
            src:     'chrome-extension://extension-id/_favicon/',
            dataset: {},
        }

        expect(applySiteFavicon(image, 'https://t0.gstatic.com/faviconV2'))
            .toBe(true)
        expect(image.src).toBe('https://t0.gstatic.com/faviconV2')
    })

    test('keeps the delete icon visible while updating its restoration URL', () => {
        const image = {
            src:     'chrome-extension://extension-id/icons/delete.svg',
            dataset: {
                deleteAction: 'true',
                faviconSrc:   'chrome-extension://extension-id/_favicon/',
            },
        }

        applySiteFavicon(image, 'https://t0.gstatic.com/faviconV2')

        expect(image.src).toContain('delete.svg')
        expect(image.dataset.faviconSrc)
            .toBe('https://t0.gstatic.com/faviconV2')
    })
    test('creates a sharp local letter fallback', () => {
        const fallbackUrl = getSiteFaviconFallbackUrl(
            'https://www.local.example/article'
        )
        const svg = decodeURIComponent(fallbackUrl.split(',')[1])

        expect(fallbackUrl).toStartWith('data:image/svg+xml,')
        expect(svg).toContain('width="32" height="32"')
        expect(svg).toContain('>L</text>')
    })

    test('applies the fallback once and preserves selection restoration', () => {
        const image = {
            src:     'https://t0.gstatic.com/faviconV2',
            dataset: {
                faviconFallback: 'data:image/svg+xml,fallback',
                faviconSrc:      'https://t0.gstatic.com/faviconV2',
            },
        }

        expect(applyFaviconFallback(image)).toBe(true)
        expect(image.src).toBe('data:image/svg+xml,fallback')
        expect(image.dataset.faviconSrc).toBe('data:image/svg+xml,fallback')
        expect(applyFaviconFallback(image)).toBe(false)
    })
})

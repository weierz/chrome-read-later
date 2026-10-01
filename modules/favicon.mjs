export function getSiteFaviconUrl (pageUrl) {
    try {
        const url = new URL(pageUrl)
        if (!['http:', 'https:'].includes(url.protocol)) return ''

        return 'https://t0.gstatic.com/faviconV2' +
            '?client=SOCIAL&type=FAVICON&nfrp=2&check_seen=true' +
            '&size=32&min_size=16&max_size=32' +
            '&fallback_opts=TYPE,SIZE,URL' +
            `&url=${encodeURIComponent(url.origin)}`
    } catch {
        return ''
    }
}

export function getChromeFaviconUrl (pageUrl, extensionId) {
    if (!pageUrl || !extensionId) return ''
    return `chrome-extension://${extensionId}/_favicon/` +
        `?pageUrl=${encodeURIComponent(pageUrl)}&size=32`
}

export function applySiteFavicon (image, siteFaviconUrl) {
    if (!siteFaviconUrl) return false

    if (image.dataset.deleteAction) {
        image.dataset.faviconSrc = siteFaviconUrl
    } else {
        image.src = siteFaviconUrl
        if (image.dataset.faviconSrc)
            image.dataset.faviconSrc = siteFaviconUrl
    }
    return true
}

export function getSiteFaviconFallbackUrl (pageUrl) {
    try {
        const url = new URL(pageUrl)
        if (!['http:', 'https:'].includes(url.protocol)) return ''

        const hostname = url.hostname.replace(/^www\./, '')
        const letter = hostname.charAt(0).toUpperCase()
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" ' +
            'width="32" height="32" viewBox="0 0 32 32">' +
            '<rect width="32" height="32" rx="6" fill="#e8eaed"/>' +
            '<text x="16" y="22" text-anchor="middle" ' +
            'font-family="Arial,sans-serif" font-size="18" ' +
            `font-weight="600" fill="#5f6368">${letter}</text></svg>`
        return `data:image/svg+xml,${encodeURIComponent(svg)}`
    } catch {
        return ''
    }
}

export function applyFaviconFallback (image) {
    const fallbackUrl = image.dataset.faviconFallback
    if (!fallbackUrl || image.dataset.faviconFallbackApplied) return false

    image.dataset.faviconFallbackApplied = 'true'
    image.src = fallbackUrl
    if (image.dataset.faviconSrc) image.dataset.faviconSrc = fallbackUrl
    return true
}

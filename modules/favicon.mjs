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

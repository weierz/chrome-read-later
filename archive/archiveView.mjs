export function filterArchivePages (pages, query) {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return [...pages]

    return pages.filter(page => {
        const searchableText = `${page.title || ''}\n${page.url || ''}`
            .toLocaleLowerCase()
        return searchableText.includes(normalizedQuery)
    })
}

export function getDisplayUrl (pageUrl) {
    try {
        const url = new URL(pageUrl)
        return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`
    } catch {
        return pageUrl
    }
}

// Splits text into plain and matching segments for highlighting.
export function splitMatches (text, query) {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle || !text) return [{ text, match: false }]

    const haystack = text.toLocaleLowerCase()
    const segments = []
    let index = 0

    while (index < text.length) {
        const found = haystack.indexOf(needle, index)
        if (found === -1) break
        if (found > index) {
            segments.push({ text: text.slice(index, found), match: false })
        }
        segments.push({
            text:  text.slice(found, found + needle.length),
            match: true,
        })
        index = found + needle.length
    }

    if (index < text.length) {
        segments.push({ text: text.slice(index), match: false })
    }
    return segments
}

// Same rules as the popup: unfinished video first, then reading position.
export function getArchiveProgress (page) {
    const videoPercent = page.video?.percent
    if (videoPercent && !['0%', '100%'].includes(videoPercent)) {
        return { label: videoPercent, type: 'video' }
    }

    const scrollPercent = page.scroll?.percent
    if (page.scroll?.top && scrollPercent) {
        return { label: scrollPercent, type: 'scroll' }
    }
}

// Keys follow the popup's bindings; d, g and y act when pressed twice.
export function getArchiveKeyBinding (event, lastKey) {
    const { key, metaKey, ctrlKey, altKey } = event
    const modifier = metaKey || ctrlKey

    if (key === 'Enter') return modifier ? 'Meta + Enter' : 'Enter'
    if (key === 'ArrowUp') return modifier ? 'Meta + ArrowUp' : 'ArrowUp'
    if (key === 'ArrowDown') return modifier ? 'Meta + ArrowDown' : 'ArrowDown'
    if (key === 'z' && modifier) return 'Meta + z'
    if (modifier || altKey) return 'none'
    if (['d', 'g', 'y'].includes(key)) {
        return lastKey === key ? key + key : key
    }
    return ['Backspace', 'Delete', 'j', 'k', 'o', 'O', 'G', 'u', '/', ',', '?']
        .includes(key) ? key : 'none'
}

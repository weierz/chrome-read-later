export function parseReadingList (content) {
    const trimmedContent = content.trim()
    if (!trimmedContent) throw new Error('The import is empty.')

    try {
        const parsed = JSON.parse(trimmedContent)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        return items.map((item, index) => ({
            item,
            location: `item ${index + 1}`,
            source:   JSON.stringify(item),
        }))
    } catch (jsonError) {
        if (trimmedContent.startsWith('[')) throw jsonError

        return trimmedContent.split('\n')
            .map((source, index) => ({ source, index }))
            .filter(({ source }) => source.trim())
            .map(({ source, index }) => {
                try {
                    return {
                        item:     JSON.parse(source),
                        location: `line ${index + 1}`,
                        source,
                    }
                } catch (error) {
                    return {
                        error,
                        location: `line ${index + 1}`,
                        source,
                    }
                }
            })
    }
}

export function serializeReadingList (items, format = 'json') {
    if (format === 'jsonl') {
        return items.map(item => JSON.stringify(item)).join('\n')
    }
    return JSON.stringify(items, null, 2)
}

export function parseReadingListUrl (value) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error('Invalid URL: expected an absolute page URL')
    }

    const url = new URL(value)
    const supportedProtocols = [
        'http:', 'https:', 'file:', 'chrome:', 'chrome-extension:', 'about:',
    ]
    if (!supportedProtocols.includes(url.protocol)) {
        throw new Error('Unsupported URL scheme')
    }
    return value.trim()
}

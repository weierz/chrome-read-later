export function filterArchivePages (pages, query, site = '') {
    const normalizedQuery = query.trim().toLocaleLowerCase()

    return pages.filter(page => {
        if (site && getSiteName(page.url) !== site) return false
        if (!normalizedQuery) return true

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

export function getSiteName (pageUrl) {
    try {
        return new URL(pageUrl).hostname.replace(/^www\./, '') || pageUrl
    } catch {
        return pageUrl || ''
    }
}

// Sites ordered by how many pages they hold, then alphabetically.
export function countSites (pages) {
    const counts = new Map()
    for (const page of pages) {
        const site = getSiteName(page.url)
        counts.set(site, (counts.get(site) || 0) + 1)
    }

    return [...counts]
        .map(([site, count]) => ({ site, count }))
        .sort((a, b) => b.count - a.count || a.site.localeCompare(b.site))
}

const startOfDay = (date, offset = 0) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset)
        .getTime()

// Recent pages are grouped by day; anything older than a week by month.
// Pages are expected newest first.
export function groupArchivePages (pages, now = new Date(), locale) {
    const today = startOfDay(now)
    const yesterday = startOfDay(now, -1)
    const weekAgo = startOfDay(now, -6)
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' })
    const month = new Intl.DateTimeFormat(locale, { month: 'long' })
    const monthYear = new Intl.DateTimeFormat(locale, {
        month: 'long', year: 'numeric',
    })
    const groups = []

    for (const page of pages) {
        const date = new Date(page.date)
        const time = date.getTime()
        let key, label, kind = 'day'

        if (time >= today) {
            key = 'today'
            label = 'Today'
        } else if (time >= yesterday) {
            key = 'yesterday'
            label = 'Yesterday'
        } else if (time >= weekAgo) {
            key = `day-${startOfDay(date)}`
            label = weekday.format(date)
        } else {
            kind = 'month'
            key = `month-${date.getFullYear()}-${date.getMonth()}`
            label = date.getFullYear() === now.getFullYear()
                ? month.format(date)
                : monthYear.format(date)
        }

        const last = groups.at(-1)
        if (last?.key === key) {
            last.pages.push(page)
        } else {
            groups.push({ key, label, kind, pages: [page] })
        }
    }

    return groups
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

export function getArchiveProgress (page) {
    const videoPercent = page.video?.percent
    if (videoPercent && !['0%', '100%'].includes(videoPercent)) {
        return {
            label:   `Video ${videoPercent}`,
            percent: parseInt(videoPercent, 10),
            type:    'video',
        }
    }

    const scrollPercent = page.scroll?.percent
    if (page.scroll?.top && scrollPercent) {
        return {
            label:   `Read ${scrollPercent}`,
            percent: parseInt(scrollPercent, 10),
            type:    'reading',
        }
    }
}

import {
    getChromeFaviconUrl,
    getSiteFaviconUrl,
} from '../../modules/favicon.mjs'

const TITLE_GAP = 32
const TITLE_SCROLL_PIXELS_PER_SECOND = 40
const ITEM_DETAILS_HOVER_DELAY = 800

export function getTitleScrollMetrics (titleWidth, availableWidth) {
    if (titleWidth <= availableWidth) return

    const distance = titleWidth + TITLE_GAP
    return {
        distance,
        duration: distance / TITLE_SCROLL_PIXELS_PER_SECOND,
    }
}

export function getMixedHoverMode (titleWidth, availableWidth) {
    if (titleWidth <= availableWidth) return 'never'
    if (titleWidth <= availableWidth * 2) return 'title'
    return 'details'
}

export function setupTitleScroll (anchor) {
    const title = anchor.querySelector('.title-primary')
    const metrics = getTitleScrollMetrics(
        title.offsetWidth,
        anchor.clientWidth
    )
    if (!metrics) return false

    anchor.classList.add('is-overflowing')
    anchor.style.setProperty(
        '--title-scroll-offset',
        `-${metrics.distance}px`
    )
    anchor.style.setProperty(
        '--title-scroll-duration',
        `${metrics.duration}s`
    )
    return true
}

export function setupMixedHover (anchor) {
    const title = anchor.querySelector('.title-primary')
    const hoverMode = getMixedHoverMode(
        title.offsetWidth,
        anchor.clientWidth
    )
    const tooltip = anchor.dataset.mixedTooltip

    anchor.classList.remove('mixed-hover')
    anchor.removeAttribute('data-mixed-tooltip')

    if (hoverMode === 'title') {
        anchor.removeAttribute('data-tooltip-delay')
        anchor.classList.add('scroll-title')
        setupTitleScroll(anchor)
    } else {
        anchor.textContent = title.textContent
        if (hoverMode === 'details') {
            anchor.dataset.tooltip = tooltip
        } else {
            anchor.removeAttribute('data-tooltip-delay')
        }
    }

    return hoverMode
}

export function renderLiFrom (page, {
    isLocalOverflow = false,
    hoverMode = 'details',
} = {}) {
    const chromeFaviconUrl = getChromeFaviconUrl(
        page.url,
        chrome.runtime.id
    )
    const siteFaviconUrl = getSiteFaviconUrl(page.url)

    return `
      <li id=${page.date}${isLocalOverflow ? ' class="local-overflow"' : ''}>
        <img src="${chromeFaviconUrl || page.favIconUrl}" data-site-favicon-src="${siteFaviconUrl}" alt="">
        <a href="${page.url}"${getTooltipAttribute()} class="${getTextClass()}" tabindex="-1">${getTitleContent()}</a>
        ${getVideoPercent() || getScrollPercent()}
      </li>
    `

    function getTooltipAttribute () {
        const attribute = hoverMode === 'details'
            ? 'data-tooltip'
            : hoverMode === 'mixed'
                ? 'data-mixed-tooltip'
                : ''
        if (!attribute) return ''

        const text = page.title === page.url
            ? page.url
            : `${page.title}\n\n${page.url}`
        // eslint-disable-next-line no-undef
        return ` ${attribute}="${he.encode(text)}" data-tooltip-delay="${ITEM_DETAILS_HOVER_DELAY}"`
    }

    function getTextClass () {
        return [
            page.url === page.title ? 'url-only' : '',
            hoverMode === 'title' ? 'scroll-title' : '',
            hoverMode === 'mixed' ? 'mixed-hover' : '',
        ].filter(Boolean).join(' ')
    }

    function getTitleContent () {
        const title = encodeInnerText()
        if (!['title', 'mixed'].includes(hoverMode)) return title
        return `<span class="title-track"><span class="title-primary">${title}</span><span class="title-repeat" aria-hidden="true">${title}</span></span>`
    }

    function encodeInnerText () {
        try {
            // eslint-disable-next-line no-undef
            return he.encode(page.title)
        } catch (e) {
            console.log(e, page)
            return page.title
        }
    }

    function getVideoPercent () {
        return ['0%', '100%', undefined].includes(page.video?.percent)
            ? ''
            : `<span class="percent video">${page.video?.percent}</span>`
    }

    function getScrollPercent () {
        return page.scroll.top
            ? `<span class="percent scroll">${page.scroll.percent}</span>`
            : ''
    }
}

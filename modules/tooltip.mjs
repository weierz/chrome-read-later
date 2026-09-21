const TOOLTIP_ID = 'project-tooltip'
const HOVER_DELAY = 400
const VIEWPORT_GAP = 8
let activeTrigger
let showTimer
let hideTimer
let tooltip
let initialized = false

export function setupTooltips () {
    if (initialized) return
    initialized = true
    tooltip = document.createElement('div')
    tooltip.id = TOOLTIP_ID
    tooltip.className = 'tooltip-popup'
    tooltip.setAttribute('role', 'tooltip')
    tooltip.tabIndex = 0
    document.body.append(tooltip)

    document.addEventListener('mouseover', onMouseOver)
    document.addEventListener('mouseout', onMouseOut)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    window.addEventListener('resize', hideTooltip)
    window.addEventListener('scroll', event => {
        if (!tooltip.contains(event.target)) hideTooltip()
    }, true)
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && activeTrigger) {
            event.preventDefault()
            hideTooltip()
        }
    })
}

function getTrigger (target) {
    return target.closest?.('[data-tooltip]')
}

function onMouseOver ({ target }) {
    if (tooltip.contains(target)) {
        clearTimeout(hideTimer)
        return
    }
    const trigger = getTrigger(target)
    if (trigger === activeTrigger) clearTimeout(hideTimer)
    if (trigger && trigger !== activeTrigger) showTooltip(trigger)
}

function onMouseOut ({ target, relatedTarget }) {
    const trigger = getTrigger(target)
    if (trigger?.contains(relatedTarget) || tooltip.contains(relatedTarget)) return
    if (trigger || tooltip.contains(target)) {
        // Allow the pointer to cross the gap between the trigger and tooltip.
        hideTimer = setTimeout(() => {
            if (!activeTrigger?.contains(document.activeElement)
                && !tooltip.contains(document.activeElement)) hideTooltip()
        }, 200)
    }
}

function onFocusIn ({ target }) {
    if (tooltip.contains(target)) {
        clearTimeout(hideTimer)
        return
    }
    const trigger = getTrigger(target)
    if (trigger) showTooltip(trigger, true)
}

function onFocusOut ({ target, relatedTarget }) {
    const trigger = getTrigger(target)
    if (trigger?.contains(relatedTarget) || tooltip.contains(relatedTarget)) return
    if (trigger || tooltip.contains(target)) hideTooltip()
}

function showTooltip (trigger, immediately = false) {
    hideTooltip()
    activeTrigger = trigger
    tooltip.textContent = trigger.dataset.tooltip
    tooltip.scrollTop = 0
    trigger.setAttribute('aria-describedby', TOOLTIP_ID)
    showTimer = setTimeout(() => positionTooltip(trigger),
        immediately ? 0 : getTooltipDelay(trigger))
}

export function getTooltipDelay (trigger) {
    const requestedDelay = Number(trigger.dataset.tooltipDelay)
    return Number.isFinite(requestedDelay) && requestedDelay >= 0
        ? requestedDelay
        : HOVER_DELAY
}

function positionTooltip (trigger) {
    if (trigger !== activeTrigger || !trigger.isConnected) return

    tooltip.style.visibility = 'hidden'
    const triggerRect = trigger.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    const { top, left, placement } = calculateTooltipPosition(
        triggerRect,
        tooltipRect,
        { width: window.innerWidth, height: window.innerHeight }
    )

    tooltip.style.top = `${top}px`
    tooltip.style.left = `${left}px`
    tooltip.dataset.placement = placement
    tooltip.style.visibility = ''
    tooltip.classList.add('visible')
}

export function calculateTooltipPosition (
    triggerRect,
    tooltipRect,
    viewport
) {
    const topPosition = triggerRect.top
        - tooltipRect.height - VIEWPORT_GAP
    const bottomPosition = triggerRect.bottom + VIEWPORT_GAP
    const fitsAbove = topPosition >= VIEWPORT_GAP
    const fitsBelow = bottomPosition + tooltipRect.height
        <= viewport.height - VIEWPORT_GAP
    const spaceAbove = triggerRect.top - VIEWPORT_GAP
    const spaceBelow = viewport.height - triggerRect.bottom - VIEWPORT_GAP
    const placement = fitsAbove || (!fitsBelow && spaceAbove >= spaceBelow)
        ? 'top'
        : 'bottom'
    const preferredTop = placement === 'top' ? topPosition : bottomPosition
    const maximumTop = Math.max(
        VIEWPORT_GAP,
        viewport.height - tooltipRect.height - VIEWPORT_GAP
    )
    const top = Math.min(
        Math.max(VIEWPORT_GAP, preferredTop),
        maximumTop
    )
    const centeredLeft = triggerRect.left
        + (triggerRect.width - tooltipRect.width) / 2
    const maximumLeft = Math.max(
        VIEWPORT_GAP,
        viewport.width - tooltipRect.width - VIEWPORT_GAP
    )
    const left = Math.min(
        Math.max(VIEWPORT_GAP, centeredLeft),
        maximumLeft
    )

    return { top, left, placement }
}

export function hideTooltip () {
    clearTimeout(showTimer)
    clearTimeout(hideTimer)
    tooltip?.classList.remove('visible')
    if (activeTrigger?.getAttribute('aria-describedby') === TOOLTIP_ID) {
        activeTrigger.removeAttribute('aria-describedby')
    }
    activeTrigger = undefined
}

export function hideTooltipWithin (container) {
    if (activeTrigger && container?.contains(activeTrigger)) hideTooltip()
}

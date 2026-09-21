const fontFamilies = {
    system:    'system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif',
    avenir:    '\'Avenir Next\', Avenir, system-ui, sans-serif',
    serif:     'Georgia, \'Times New Roman\', serif',
    monospace: 'ui-monospace, \'SFMono-Regular\', Menlo, Consolas, monospace',
}

export function normalizeFontFamily (value) {
    return typeof value === 'string' && Object.hasOwn(fontFamilies, value)
        ? value
        : 'system'
}

export function applyFontPreference (options, root = document.documentElement) {
    root.style.setProperty(
        '--font-ui',
        fontFamilies[normalizeFontFamily(options?.fontFamily)]
    )
}

// Stands in for Chrome's extension APIs so the real popup can run on the
// landing page with example pages. Nothing is read from or written to any
// installed extension; actions are reported to the landing page instead.
(() => {
    const examples = [
        ['CSS grid layout · MDN', 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout', 42],
        ['Human Interface Guidelines · Apple', 'https://developer.apple.com/design/human-interface-guidelines/', 21],
        ['Read Later · GitHub', 'https://github.com/willbchang/chrome-read-later', 0],
        ['Learn accessibility · web.dev', 'https://web.dev/learn/accessibility', 68],
        ['Read Later — a quick walkthrough', 'https://www.youtube.com/watch?v=fnaFiMabPq8', 0, 35],
        ['A Complete Guide to Flexbox', 'https://css-tricks.com/snippets/css/a-guide-to-flexbox/', 56],
        ['Web platform documentation · MDN', 'https://developer.mozilla.org/en-US/docs/Web', 0],
        ['Chrome for Developers', 'https://developer.chrome.com/docs/extensions', 79],
        ['The Read Later changelog', 'https://github.com/willbchang/chrome-read-later/releases', 0],
        ['Designing for the web · web.dev', 'https://web.dev/learn/design', 14],
    ]
    // Chrome supplies stored favicons; here a letter icon shows until the
    // popup's site icon request finishes, as for sites without an icon.
    const letterIcon = url => {
        const letter = new URL(url).hostname.replace(/^www\./, '')[0].toUpperCase()
        return 'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">' +
            '<rect width="32" height="32" rx="6" fill="#e8eaed"/>' +
            '<text x="16" y="22" text-anchor="middle" font-family="Arial,sans-serif" ' +
            `font-size="18" font-weight="600" fill="#5f6368">${letter}</text></svg>`)
    }
    const pages = Object.fromEntries(examples.map(([title, url, read, video], index) => [url, {
        title,
        url,
        favIconUrl: letterIcon(url),
        date:   Date.now() - index * 60000,
        scroll: { top: read ? 400 : 0, percent: `${read}%` },
        video:  video ? { percent: `${video}%` } : {},
    }]))
    const titleOf = url => pages[url]?.title || url

    const report = text => parent.postMessage({ readLaterDemo: text }, parent.location.origin)

    const area = initial => {
        const data = structuredClone(initial)
        return {
            QUOTA_BYTES: 102400,
            MAX_ITEMS:   512,
            get (key, callback) {
                callback(structuredClone(key == null
                    ? data
                    : (key in data ? { [key]: data[key] } : {})))
            },
            set (value, callback) {
                Object.assign(data, structuredClone(value))
                callback?.()
            },
            remove (keys, callback) {
                for (const key of [].concat(keys)) delete data[key]
                callback?.()
            },
            getBytesInUse (key, callback) { callback(0) },
        }
    }

    window.chrome = {
        runtime: {
            id:          '',
            getURL:      path => new URL('/' + path, document.baseURI).href,
            connect:     () => ({}),
            sendMessage: ({ message, data }) => {
                if (message === 'open') {
                    report(`Opens “${titleOf(data.url)}”${data.active === false ? ' in a background tab' : ''}.`)
                } else if (message === 'dele') {
                    // The background page normally records this for undo.
                    import('../modules/localStore/localStore.mjs')
                        .then(store => store.pushToArray(data.key, data.url))
                    report(`Removed “${titleOf(data.url)}”. Press u to undo.`)
                }
            },
        },
        storage: {
            sync:      area(pages),
            local:     area({ options: { selectedItemIconMode: 'always', archiveMode: true } }),
            session:   area({}),
            onChanged: { addListener () {} },
        },
        tabs: {
            create: ({ url }, callback) => {
                report(url.includes('archive') ? 'Opens the Archive.' : 'Opens Options.')
                callback?.({ id: 1 })
            },
        },
    }

    // Links would navigate the frame; report them instead.
    window.open = url => report(`Opens ${url}`)
    window.close = () => {}
})()

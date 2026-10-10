// Runs the real popup (popup/popup.html with its own CSS and scripts) inside
// the hero, with demo-chrome.js standing in for Chrome's extension APIs.
const frame = document.querySelector('#demo')
const notice = document.querySelector('#demoNotice')
const reset = document.querySelector('#demoReset')
const initialNotice = notice.innerHTML
const popupUrl = new URL('popup/popup.html', document.baseURI)
// Carry this release's version (?v=…) to the files the demo loads.
const version = new URL(import.meta.url).search
const shimUrl = new URL(`landing/demo-chrome.js${version}`, document.baseURI)
let popupHtml

async function loadDemo () {
    popupHtml ??= (await (await fetch(popupUrl)).text())
        .replace('"popup.css"', `"popup.css${version}"`)
        .replace('"popup.js"', `"popup.js${version}"`)
    frame.srcdoc = popupHtml.replace('<head>',
        `<head><base href="${new URL('.', popupUrl)}"><script src="${shimUrl}"></script>`)
    await new Promise(resolve => frame.addEventListener('load', resolve, { once: true }))

    // Size the frame to the popup, as Chrome sizes the real one.
    const body = frame.contentDocument.body
    new ResizeObserver(() => {
        frame.style.height = `${Math.ceil(body.getBoundingClientRect().height)}px`
    }).observe(body)
}

addEventListener('message', event => {
    if (event.origin !== location.origin || !event.data?.readLaterDemo) return
    notice.textContent = event.data.readLaterDemo
    reset.hidden = false
})

reset.addEventListener('click', async () => {
    reset.hidden = true
    notice.innerHTML = initialNotice
    await loadDemo()
    frame.contentWindow.focus()
})

loadDemo().catch(error => {
    console.error('Read Later: unable to load the popup demo.', error)
    frame.hidden = true
    notice.textContent = 'The popup preview could not be loaded.'
})

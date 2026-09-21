# Product screenshots

`read-later-light.png` and `read-later-dark.png` are browser captures of the
actual `popup/popup.html` UI, rendered by `tests/product-preview.html` with
example saved pages and isolated Chrome storage. They contain no personal
reading-list data. The fixture loads the real popup HTML, CSS, and scripts.

To refresh them, serve the repository root, open `/tests/product-preview.html`,
and capture a 400 × 440 viewport at 2× device pixel ratio with the browser’s
color scheme set to light and then dark. Verify all icons have loaded and the
whole popup fits before capturing. If the sample content or popup dimensions
change, update the viewport and the image dimensions in `index.html` too.

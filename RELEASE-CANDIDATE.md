# Read Later 9.3.0

Source: `master`, merged from `codex/05-reading-list-ui` on 2026-10-01.

Reading list presentation, appearance, accessibility, and import safety. Highlights:

- Shared light/dark theme across the popup, Archive, and Options, plus a local interface font preference.
- Popup favicons show Chrome's cached icon immediately and switch to the site icon once it loads; Archive falls back to local letter icons.
- Status-bar controls are native buttons; tooltips fit the viewport, scroll, and dismiss with Escape.
- Options save without locking the form, and rapid edits persist in order.
- Imports reject invalid, unsupported, or reserved URLs without overwriting settings.
- `release.sh` produces a Chrome Web Store ZIP with `manifest.json` at its root.

## Version policy

This is a minor increment. New compatible user capabilities use minor; fixes and performance improvements use patch. No incompatible public API or saved-data migration requires a major increment. Earlier local draft numbers were never published.

## Validate and package

```sh
bun test
CHROME_READ_LATER_RELEASE_DIR=/tmp/read-later-release sh release.sh
```

The ZIP has `manifest.json` at its root and includes all applicable extension entry points. Extract it and load that directory as an unpacked extension in Chrome for acceptance testing. Browser regression pages in `tests/` run from a static server at the repository root.

Merged locally only. No remote push, store upload, or publication has been performed. Real remote sync and Internet Archive services require the user's configured credentials and are not exercised by the automated suite.

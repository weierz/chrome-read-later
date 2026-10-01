# Chrome Web Store Listing — Read Later

Last updated: 2026-10-01

## Store listing

- Name: Read Later
- Item: `fbmfcfkokefgbmfcjahdmomlifclekib`
- Publisher: will.b.chang
- Category: Workflow & Planning
- Language: English (United States)
- Visibility: Public; existing distribution settings retained.
- Short description: A temporary bookmark focuses on reading later, rather than closing and removing, with several Vim keybindings!
- Single purpose: Save pages for later reading and resume reading or video playback where you left off.
- Homepage: https://github.com/willbchang/chrome-read-later
- Support: https://github.com/willbchang/chrome-read-later/issues

The existing detailed description is retained with this introduction:

> New in 9.3.0: A refreshed light and dark theme, a choice of interface font, faster site icons, keyboard-accessible status bar buttons, scrollable tooltips, and safer imports that skip invalid URLs.

## Current release candidate

- Version: `9.3.0`
- Source: `master`, merged from `codex/05-reading-list-ui`.
- State: merged and packaged locally; not pushed, uploaded, or published.
- Before submission, replace the dashboard's "New in" introduction with the 9.3.0 text above. No permission changes are required; review the favicon disclosure under Privacy and data use.

## Graphics

The dashboard already contains a store icon and two screenshots. These existing assets are retained for this update. Packaged icons were verified at 16, 32, 48, and 128 pixels.

## Permissions justification

No permissions were added in 9.2.0 or 9.3.0.

| Permission or access | Purpose |
| --- | --- |
| `tabs` | Read the selected page's URL and title, open saved pages, and close tabs after saving when configured. |
| `storage` | Store saved pages, preferences, reading progress, local history, and local overflow. |
| `contextMenus` | Let users save the current page or a link from its context menu. |
| `favicon` | Display site icons in the reading list. |
| Content script on `<all_urls>` | Read and restore scroll and video positions on the pages users save and reopen. |

## Privacy and data use

Saved URLs, page titles, scroll positions, and video playback positions are stored for the reading-list feature. Synced entries and preferences use Chrome Sync; history, overflow, and the interface font preference remain local. The extension may fetch a saved page to obtain its title. To display site icons, the origin (scheme and domain, not the full URL) of saved http and https pages is requested from Google's favicon service; Chrome's built-in favicon cache is shown first. No developer-operated collection endpoint or analytics was added by this release.

The dashboard discloses Web history, User activity, and Website content; remote code is marked No. Those disclosures and the existing certifications were retained. The policy URL was verified accessible: https://github.com/willbchang/chrome-read-later/blob/master/.github/policy-privacy.md. It describes local storage, Chrome Sync, and the favicon service. Publisher contact details and regional distribution remain as configured in the dashboard.

## Version history

| Version | Date | Changes | Status |
| --- | --- | --- | --- |
| 9.3.0 | 2026-10-01 | Shared light/dark theme and local interface font preference. Popup shows Chrome's cached favicon immediately, then the site icon; Archive falls back to local letter icons. Status-bar controls are native buttons (Enter/Space) and the count is not focusable. Tooltips fit the viewport, scroll, accept pointer and focus, and dismiss with Escape. Options save without locking the form and apply rapid edits in order. Imports reject invalid or reserved URLs without overwriting settings. Release ZIP places `manifest.json` at its root. | Merged to master; packaged locally; not uploaded |
| 9.2.0 | 2026-09-10 | Hybrid sync/local overflow, combined reading list and export, automatic promotion, storage settings, and quota regression tests. | Submitted for review; automatic publication after approval enabled |
| 9.1.0 | 2025-12-12 | Previous store release; date from dashboard. | Published |

## Release validation

### 9.3.0

- 78 automated tests passed, including import URL validation and release package structure.
- Isolated browser regressions: `tests/options-save.html` and `tests/tooltip-controls.html`.
- `release.sh` ZIP contains 54 runtime files with `manifest.json` at its root; excludes tests, the landing page, fixtures, local test data, and documentation.

### 9.2.0

- Dashboard confirmed: "Your extension was submitted for review." Version 9.2.0 is not yet confirmed publicly available.
- 21 automated tests passed.
- Live Chrome test: 50 synthetic items plus two existing items; 34 synthetic items synced and 16 overflowed locally.
- Combined list displayed all 52 items without duplicates and highlighted overflow.
- Disabling hybrid mode was rejected while overflow could not fit.
- Deleting three synced test items automatically promoted three overflow items; test items were restored afterward.
- ZIP contains 49 runtime files; excludes tests, fixtures, local test data, and this document.
- ZIP SHA-256: `ff7ffa850b38a429ed9f7f8fcace1cb2fc0284b0b7e1a7778b74f6880f358731`.

## Known limitations

- Failed saves from before the 9.2.0 upgrade are not automatically restored from local history, which also contains intentionally removed items.
- The deletion/promotion overlap identified during review remains deferred.
- Local overflow does not appear on other devices until it is successfully synced.
- The popup no longer shows a local letter icon when both Chrome's cache and the site icon service have no icon; Chrome's default icon is shown instead.

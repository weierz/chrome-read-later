# Chrome Web Store Listing — Read Later

Last updated: 2026-09-11

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

> New in 9.2.0: Keep saving when Chrome Sync is full. Extra items stay on this computer, appear alongside synced items, and retry syncing when space is available. Local overflow items are highlighted and included in exports.

## Graphics

The dashboard already contains a store icon and two screenshots. These existing assets are retained for this update. Packaged icons were verified at 16, 32, 48, and 128 pixels.

## Permissions justification

No permissions were added in 9.2.0.

| Permission or access | Purpose |
| --- | --- |
| `tabs` | Read the selected page's URL and title, open saved pages, and close tabs after saving when configured. |
| `storage` | Store saved pages, preferences, reading progress, local history, and local overflow. |
| `contextMenus` | Let users save the current page or a link from its context menu. |
| `favicon` | Display site icons in the reading list. |
| Content script on `<all_urls>` | Read and restore scroll and video positions on the pages users save and reopen. |

## Privacy and data use

Saved URLs, page titles, scroll positions, and video playback positions are stored for the reading-list feature. Synced entries and preferences use Chrome Sync; history and overflow remain local. The extension may fetch a saved page to obtain its title. No developer-operated collection endpoint or analytics was added by this release.

The dashboard discloses Web history, User activity, and Website content; remote code is marked No. Those disclosures and the existing certifications were retained. The policy URL was verified accessible: https://github.com/willbchang/chrome-read-later/blob/master/.github/policy-privacy.md. It describes local storage and Chrome Sync. Publisher contact details and regional distribution remain as configured in the dashboard.

## Version history

| Version | Date | Changes | Status |
| --- | --- | --- | --- |
| Unreleased | 2026-09-11 | Status-bar buttons support Enter and Space without opening the selected article. Long tooltips fit the viewport, support scrolling and pointer/focus transfer, and dismiss with Escape. | Local changes; 65 unit tests and 9 isolated browser regression checks passed; native Enter/Space activation verified. |
| 9.2.0 | 2026-09-10 | Hybrid sync/local overflow, combined reading list and export, automatic promotion, storage settings, and quota regression tests. | Submitted for review; automatic publication after approval enabled |
| 9.1.0 | 2025-12-12 | Previous store release; date from dashboard. | Published |

## Release validation

- Dashboard confirmed: "Your extension was submitted for review." Version 9.2.0 is not yet confirmed publicly available.
- 21 automated tests passed.
- Live Chrome test: 50 synthetic items plus two existing items; 34 synthetic items synced and 16 overflowed locally.
- Combined list displayed all 52 items without duplicates and highlighted overflow.
- Disabling hybrid mode was rejected while overflow could not fit.
- Deleting three synced test items automatically promoted three overflow items; test items were restored afterward.
- ZIP contains 49 runtime files; excludes tests, fixtures, local test data, and this document.
- ZIP SHA-256: `ff7ffa850b38a429ed9f7f8fcace1cb2fc0284b0b7e1a7778b74f6880f358731`.

## Known limitations

- Failed saves from before this upgrade are not automatically restored from local history, which also contains intentionally removed items.
- The deletion/promotion overlap identified during review remains deferred.
- Local overflow does not appear on other devices until it is successfully synced.

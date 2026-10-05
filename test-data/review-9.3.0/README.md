# 9.3.0 review: tests and data

Tests and sample data for the five "review closely" areas of 9.3.0 (changes since 9.2.0, `origin/master`).

Use a **separate Chrome profile** for the manual steps. Imports write to Chrome Sync, and every sample item's title starts with `[9.3.0 REVIEW]` or `[9.3.0 FAVICON]` so you can find and delete them afterwards.

## Automated

```bash
bun test
```

| Area | Test file | Covers |
| --- | --- | --- |
| 1. Import URL checks | `options/importValidation.test.mjs` | Both sample files below: 8 entries imported; 11 (JSON) or 12 (JSONL) rejected; settings unchanged; reading progress, video progress and date kept |
| 3. Font in storage | `modules/chrome/storage.test.mjs` | Saving the font keeps other synced options and saved pages; font stays local when Chrome Sync rejects the write |

Browser pages: start a static server at the repository root, then open each page in a **focused, visible** window. Each page shows `All tests passed.` or the first failure.

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

| Area | Page | Covers |
| --- | --- | --- |
| 2. Options saving | http://127.0.0.1:8765/tests/options-save.html | Older failed save while a newer edit is queued; newest save failing; controls stay enabled; storage-mode status text |
| 4. Popup site icons | http://127.0.0.1:8765/tests/popup-favicons.html | Chrome icon first; site icon swap while the delete icon is shown, before and after deselecting; failed site icon; local files skip the service; Keep favicon mode |
| 5. Status bar and tooltips | http://127.0.0.1:8765/tests/tooltip-controls.html | Escape not blocked without a tooltip; Archive and Help buttons; typing inside a tooltip ignored |

`tooltip-controls.html` relies on real keyboard focus. In a hidden or unfocused tab it fails at "Long tooltip stays inside viewport" or "Long tooltip content can overflow internally"; that failure does not mean the code is broken.

## Manual

Load the extension unpacked from this checkout (or from the `release.sh` ZIP) in the test profile.

### 1. Import URL checks

1. In Options, turn on **Open reading list items in a new tab** and turn off **Store overflow items locally**.
2. Import [`import-mixed.json`](import-mixed.json).
   - Expect "Imported 8 items. 11 skipped.", with each skipped entry and its reason under "Show skipped entries". The text box clears.
   - Settings are unchanged. The `options` entry tries to switch new-tab opening off, the archive off, and local overflow on; none of that may happen.
   - "Valid URL with surrounding spaces" is saved as `https://example.com/review/padded` with no spaces.
   - The video row shows 35%, and the article row shows 40%.
3. Delete the `[9.3.0 REVIEW]` items, then import [`import-mixed.jsonl`](import-mixed.jsonl). Expect "Imported 8 items. 12 skipped." (the extra one is a broken line shown as "Not valid JSON"; the blank line is ignored).
4. Export, then re-import that export into a clean profile. Nothing should fail.

### 2. Options saving

1. Toggle three checkboxes as fast as you can, then reload Options. The last state you saw must be the one saved.
2. Switch **Store overflow items locally** on and off. The status line reads "Using Chrome Sync with local overflow." or "Using Chrome Sync only.", and the form never greys out.
3. With Chrome Sync full (import `test-data/read-later-sync-full.jsonl`), try to switch overflow off. It is refused with "Other changes were saved, but the storage mode could not be changed."

### 3. Font preference

1. Pick each font in Options. The popup, Archive and Options all change.
2. Sign the same Google account into a second profile. The font there stays System default, while other options (such as new-tab opening) sync.

### 4. Popup site icons

Import [`favicons.jsonl`](favicons.jsonl) and open the popup.

| Row | Expected icon |
| --- | --- |
| GitHub, MDN, Wikipedia, Hacker News, YouTube | Chrome's icon at once, then the site icon with no flicker |
| example.com (no favicon) | Watch for a generic globe from Google replacing Chrome's icon (a regression if it looks worse than before) |
| `.invalid` domain, localhost, intranet host | Chrome's default icon stays; no broken image |
| Local file, `chrome://extensions/` | Chrome's icon only; no site icon request (check DevTools > Network) |

Then, with **Show delete icon for selected item** set to Mouse and keyboard:

- Open the popup and immediately press ↓ a few times. The delete icon follows the selection, and each row you leave shows its correct icon.
- Repeat offline (DevTools > Network > Offline). Chrome's icons stay.
- Compare with the Archive, which still shows a local letter icon when no icon loads.

### 5. Status bar and tooltips

1. Open the popup and press <kbd>Tab</kbd> to reach Archive, Options and Help. <kbd>Enter</kbd> and <kbd>Space</kbd> open the right page, and the selected article is never opened or deleted.
2. While a status-bar button is focused, press <kbd>d</kbd> <kbd>d</kbd>, <kbd>Delete</kbd> and the arrow keys. Nothing in the list changes.
3. Hover Options until its tooltip shows, move the pointer into the tooltip, then press <kbd>Esc</kbd>. Only the tooltip closes.
4. With no tooltip showing, press <kbd>Esc</kbd>. The popup closes, as it did in 9.2.0.

## Cleanup

Search for `[9.3.0 REVIEW]` and `[9.3.0 FAVICON]` in the Archive or popup and delete them, or remove the test profile.

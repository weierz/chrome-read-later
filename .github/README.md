<p align="center">
  <img src="images/logotype.png" alt="Read Later Logo" height="150px"><br>
  <sub>Dedicated to my fiancee Yang Yang</a></sub><br>
  A temporary bookmark focused on reading later, rather than closing and removing.
</p>




## Installation
**Click the image** below to install:

<a href="https://chrome.google.com/webstore/detail/fbmfcfkokefgbmfcjahdmomlifclekib/">
  <img src="images/chrome-store-logo.png" width="250px" alt="chrome-store-logo">
</a>

Please rate it on [chrome web store](https://chrome.google.com/webstore/detail/fbmfcfkokefgbmfcjahdmomlifclekib/) or star it on github if you like it. Your encouragement will help me make it better, thanks!

<details>
<summary>Manual Installation</summary>

1. Download [chrome-read-later.zip](https://github.com/willbchang/chrome-read-later/releases/latest).
2. Unzip it and move it to the safe path(you won't delete it accidentally).
3. Go to `chrome://extensions/`
4. Open `Developer mode`.
5. Drag the folder to chrome or Click `Load unpacked` and select the folder.

</details>

## Features

![Chrome Read Later 1168x364=2560x1600](images/sample-white.png#gh-light-mode-only)
![Chrome Read Later 1168x364=2560x1600](images/sample-dark.png#gh-dark-mode-only)

### Reading List
- **Reading Progress**(Orange %): It gets and sets the scroll position of current page.
- **Video Progress**(Blue %): It gets and sets the current time and the playback rate of the first video.
- **Sync in Cloud**: Sync across Chrome browsers with one google account.
- **Local Archive**: Keep an archive of reading list items locally.

### Hybrid Storage
- When Chrome Sync fills up, local overflow turns on automatically so new items can still be saved on this computer.
- Synced and local items appear together; local overflow items use a different text color and are included in exports.
- Overflow items automatically retry syncing when space becomes available. Turn off **Store overflow items locally** in Options only when all overflow items fit in sync.

### Status Bar
- **Row Number : Total Count**
- **Archive Icon**: Open the full-page reading list archive.
- **Options Icon**: Open the unified options page.
- **Question Icon**: Click to open the documentation & feedback page.

## Usages

<p align="center">  
  <a href="https://youtu.be/fnaFiMabPq8">
    <img src="images/youtube-logo.png" width="200px" alt="youtube-logo">
  </a>

  <a href="https://www.bilibili.com/video/BV1Ag411M7W1">
    <img src="images/bilibili-logo.png" width="200px" alt="bilibili-logo">
  </a>
</p>

**Windows and Mac Keyboard Differences**

| Mac Key  | Windows Key |
|:--------:|:-----------:|
| Control  | Ctrl        |
| Option   | Alt         |
| Command  | Windows     |
| Delete   | Backspace   |

### Website
- `Right Click` a *link* and select **Save to Read Later** in context menus to save the target link info.
- `Right Click` *current page* and select **Save to Read Later** in context menus to save page info and close current tab.
- `Click` the read later icon to open the **Reading List**(Popup Window).
- <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>: **Save** to reading list.
- <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>: **Zoom In/Out** reading list.

If you pressed the shortcuts and it didn't work, please enter `chrome://extensions/shortcuts` in your address bar.
Find **Read Later** and set the shortcuts(resolve the keyboard shortcuts conflicts)
![chrome://extensions/shortcuts](images/chrome-extensions-shortcuts.png)

### Popup

| Actions                                  | Mouse                                      | Keyboard                                         | VIM                           |
|-------------------------------------------|--------------------------------------------|--------------------------------------------------|-------------------------------|
| Open reading list                         | `Click` extension icon                     | <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>z</kbd> | \                             |
| Close reading list                        | `Click` extension icon                     | <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>z</kbd> | <kbd>Esc</kbd>                |
| Open in Current tab                       | `Click`                                    | <kbd>Enter</kbd>                                 | <kbd>o</kbd>                  |
| Open in a New tab and Stay in Current tab | <kbd>Command</kbd> + `Click`               | <kbd>Command</kbd> + <kbd>Enter</kbd>            | <kbd>O</kbd>                  |
| Open in a New tab                         | <kbd>Alt</kbd> + `Click`                   | <kbd>Alt</kbd> + <kbd>Enter</kbd>                | <kbd>alt</kbd> + <kbd>o</kbd> |
| Delete                                    | `Hover` favicon and `Click`                | <kbd>Delete</kbd>                                | <kbd>dd</kbd>                 |
| Move to Next                              | Move Down                                  | <kbd>↓</kbd>                                     | <kbd>j</kbd>                  |
| Move to Previous                          | Move Up                                    | <kbd>↑</kbd>                                     | <kbd>k</kbd>                  |
| Move to Top                               | Scroll to Top                              | <kbd>Command</kbd> + <kbd>↑</kbd>                | <kbd>gg</kbd>                 |
| Move to Bottom                            | Scroll to End                              | <kbd>Command</kbd> + <kbd>↓</kbd>                | <kbd>G</kbd>                  |
| Restore a deletion                        | \                                          | <kbd>Command</kbd> + <kbd>z</kbd>                | <kbd>u</kbd>                  |
| Copy link address                         | `Right Click` and select copy link address | \                                                | <kbd>yy</kbd>                 |
| Open archive                              | Click Archive icon                         | \                                                | <kbd>A</kbd>                  |
| Open settings page        | Click Settings icon                        | \                                                | <kbd>,</kbd>                  |
| Open documentation & feedback site        | Click Question icon                        | \                                                | <kbd>?</kbd>                  |
| Run the configured item hover behavior   | `Hover` text                               | \                                                | \                             |


## Note
- Get/Set reading progress works on most pages, it may change based on current window size.
- Only get/set the first HTML video's information.
- Removing the extension will delete the reading list in the cloud, **it cannot be restored**.
- Chrome Sync capacity depends on item size; items that exceed its limits remain local while hybrid storage is enabled.
- At most 10,000 reading list items are kept in the archive.

## Contribution
Suggestion & PR are welcome. Please open an issue to discussion first.
- UI
- UX
- Refactoring / Code Quality
- New Features
- Documentation

### TODO
- [ ] Get/Set PDF page number(with pdf.js extension).
- [ ] Integrate with vimium(C), use <kbd>s</kbd> and <kbd>S</kbd>.
- [ ] Cache the reading list to instantly open.
- [ ] Improve the vim code logic(more dynamic).


## Credits
- Logo is designed by [Yasujizr](https://github.com/Yasujizr).
- Delete icon is made by [Freepik](https://www.flaticon.com/authors/freepik)
- Icons in status bar are [Octicons](https://primer.style/octicons/).
- I use [RubyMine](https://www.jetbrains.com/ruby/) to make this extension, it improves my productivity a lot!
- Special thanks to my fiancee YangYang, she gave me a lot of helpful suggestions, feedback and encouragement.

## Policy Privacy
[policy-privacy.md]

## LICENSE
[AGPL-3.0](LICENSE)

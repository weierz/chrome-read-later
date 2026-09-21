// This sample stays on the page and never reads or changes the extension's data.
const saveButton = document.querySelector('#preview-save');
const savedSample = document.querySelector('#saved-sample');
const itemCount = document.querySelector('#item-count');
const previewStatus = document.querySelector('#preview-status');
const saveLabel = saveButton.querySelector('span');
const saveIcon = saveButton.querySelector('use');

saveButton.hidden = false;
document.querySelector('#try-hint').hidden = false;

saveButton.addEventListener('click', () => {
  const isSaved = savedSample.hidden;
  savedSample.hidden = !isSaved;
  itemCount.textContent = isSaved ? '5 items' : '4 items';
  saveLabel.textContent = isSaved ? 'Saved! Reset preview' : 'Try saving a page';
  saveIcon.setAttribute('href', isSaved ? '#icon-check' : '#icon-plus');
  previewStatus.textContent = isSaved
    ? 'Sample page saved. Your preview reading list now has 5 items. No real pages or extension data were changed.'
    : 'Preview reset. Your sample reading list has 4 items.';
});

const screenshot = document.querySelector('#product-screenshot');
const fullScreenshot = document.querySelector('#full-screenshot');
const themeControls = document.querySelector('.screenshot-themes');
const themeButtons = themeControls.querySelectorAll('button');

const screenshots = {
  light: 'landing/images/read-later-light.png',
  dark: 'landing/images/read-later-dark.png',
};

themeControls.hidden = false;

for (const button of themeButtons) {
  button.addEventListener('click', () => {
    const theme = button.dataset.screenshotTheme;
    screenshot.src = screenshots[theme];
    screenshot.alt = `Read Later in ${theme} appearance, showing saved pages, orange reading progress, blue video progress, and Archive, Options, and Help controls.`;
    fullScreenshot.href = screenshots[theme];

    for (const themeButton of themeButtons) {
      themeButton.setAttribute('aria-pressed', String(themeButton === button));
    }
  });
}

# TabScroll Extension

Load the `extension/` directory as an unpacked Chromium extension.

What it does:

- Opens a full-screen TabScroll overlay from the toolbar button or the `Ctrl+Shift+K` / `Command+Shift+K` shortcut.
- Pulls the real tabs from the current browser window.
- Uses scroll or arrow keys to move through the session one tab at a time.
- Activates the selected tab with `Enter` or by clicking the centered card.
- Closes with `Esc`.

Notes:

- TabScroll captures the active tab preview as soon as you open the overlay.
- When you open the overlay, TabScroll also tries to capture previews for the other tabs in the current window from the background and streams them into the existing cards.
- Chrome shows its own native debugging banner while those background previews are captured because TabScroll uses the `chrome.debugger` API for that step.
- Chrome internal pages such as `chrome://` and some store pages do not allow content-script overlays, so TabScroll will not open there.
- Protected pages and non-web URLs can still fall back to the visual placeholder.

Permissions:

- `tabs`: reads the tabs in the current browser window so TabScroll can show each tab's title, URL, favicon, order, and active state inside the switcher. This is the core feature of the extension.
- `activeTab`: is used only when you explicitly open TabScroll. It gives temporary access to the page you invoked the extension on so TabScroll can inject the overlay and capture a preview of the tab you are currently viewing.
- `scripting`: injects the overlay host script into the current tab after you explicitly invoke the extension.
- `debugger`: is used only to capture preview screenshots of the other tabs in the same current window without visibly switching to them. Those previews are used only to render the visual tab switcher locally in the browser.

Privacy:

- TabScroll does not send browsing data, screenshots, or analytics to any remote service.
- Tab data is used locally in the browser to render the tab switcher UI.
- Preview capture for background tabs happens locally and is only used to help you recognize and switch to the correct tab.
- See `PRIVACY.md` for the publishable policy text.

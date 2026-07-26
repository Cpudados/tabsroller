# TabScroll Extension

Load the `extension/` directory as an unpacked Chromium extension.

What it does:

- Opens a full-screen TabScroll overlay from the toolbar button or the `Ctrl+Shift+K` / `Command+Shift+K` shortcut.
- Pulls the real tabs from normal browser windows, with a toggle between the current window and all windows.
- Filters tabs immediately by title, domain, or URL when you type.
- Uses scroll, arrow keys, or neighboring-card clicks to move through a single three-slot carousel.
- Suggests the most recently active tab as a one-click "Jump back" action (`R`).
- Closes, pins, or mutes the selected tab with `Delete`, `P`, or `M`.
- Marks duplicate, pinned, audible, muted, and discarded tabs with status badges.
- Activates the selected tab with `Enter` or by clicking the centered card.
- Closes with `Esc`.

Notes:

- `T`, `R`, `P`, and `M` remain shortcuts while search is idle. Click the search field or press `/` first when a query begins with one of those letters.
- TabScroll captures the active tab preview as soon as you open the overlay.
- TabScroll captures inactive-tab previews in a small parallel batch. Chrome shows its native debugging banner only while that refresh is active.
- Downscaled previews are cached for the browser session and invalidated when a tab navigates, so reopening TabScroll can reuse unchanged previews without another capture.
- Chrome internal pages, browser store pages, and other extension pages do not allow content-script overlays. TabScroll opens its standalone tab view on those pages instead.
- Tab-stashing extension pages such as OneTab are detected as saved-tab collections and shown with a dedicated collection card. Chrome keeps their saved links private, so TabScroll opens the collection page instead of trying to inspect its contents.
- Protected pages and non-web URLs can still fall back to the visual placeholder.
- The carousel renders only the previous, focused, and next tab, keeping one clear visual layer regardless of tab count.

Permissions:

- `tabs`: reads tabs in normal browser windows so TabScroll can search and show each tab's title, URL, favicon, window, order, active state, recent access time, pin, audio, mute, and discarded status. It also lets TabScroll activate, close, pin, and mute only the tab you choose.
- `activeTab`: is used only when you explicitly open TabScroll. It gives temporary access to the page you invoked the extension on so TabScroll can inject the overlay and capture a preview of the tab you are currently viewing.
- `scripting`: injects the overlay host script into the current tab after you explicitly invoke the extension.
- `storage`: keeps downscaled preview images in session-only extension storage so unchanged tabs do not need to be recaptured every time TabScroll opens.
- `debugger`: captures previews of inactive eligible tabs without visibly switching to them. Chrome displays its native debugging banner while this short capture batch runs.

Privacy:

- TabScroll does not send browsing data, screenshots, or analytics to any remote service.
- Tab data is used locally in the browser to render, search, and update the tab switcher UI.
- Preview images are processed locally and cached only for the current browser session.
- See `PRIVACY.md` for the publishable policy text.

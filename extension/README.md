# TabScroll Extension

Load the `extension/` directory as an unpacked Chromium extension.

What it does:

- Opens a full-screen TabScroll overlay from the toolbar button or the `Ctrl+Shift+K` / `Command+Shift+K` shortcut.
- Pulls the tabs from the current browser window.
- Uses scroll or arrow keys to move through the window, with wraparound at either end.
- Activates the centered tab with `Enter` or any visible tab with one click.
- Closes with `Esc`.

Onboarding and permissions:

- On first use, TabScroll explains its controls before asking for any optional access.
- The optional `tabs` permission makes every card recognizable with its title, site address, and favicon.
- If the user declines, the switcher still works with tab order, generic cards, and details for the explicitly activated current tab.
- The optional permission can be enabled later from the switcher's **Show tab details** button.

Notes:

- TabScroll captures one temporary preview: the currently visible tab from which the user explicitly opens the switcher.
- It does not use Chrome's debugger interface or capture background-tab screenshots.
- Chrome internal pages such as `chrome://` and some store pages do not allow content-script overlays, so TabScroll will not open there.

Required permissions:

- `activeTab`: gives temporary access only after the user explicitly opens TabScroll, allowing capture of the currently visible tab and injection on that page.
- `scripting`: injects the overlay host script into the current tab after explicit invocation.

Optional permission:

- `tabs`: reads titles, addresses, favicons, order, and active state for tabs in the current window so the switcher can identify them. Chrome may describe this as reading browsing history because open-tab addresses are visible. TabScroll does not read stored history.

Privacy:

- TabScroll has no backend, analytics, advertising, or telemetry.
- Open-tab details and the current-tab preview stay in the browser and are used only for the active switcher session.
- See `PRIVACY.md` for the publishable policy text.

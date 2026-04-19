# TabScroll Privacy Policy

Last updated: 2026-04-19

TabScroll is a browser extension that shows a full-screen switcher for the tabs in your current browser window.

What TabScroll processes:

- The list of tabs in the current browser window, including tab title, URL, favicon, and tab position.
- A screenshot preview of the currently active tab when you explicitly open TabScroll from the toolbar button or keyboard shortcut.
- When you explicitly open TabScroll, screenshot previews of the other tabs in the current window while TabScroll captures them in the background.

How TabScroll uses that data:

- To render the tab switcher UI.
- To let you move through tabs and activate the one you choose.
- To help you recognize tabs more quickly by showing a preview of the active tab and, when available, previews of other tabs in the same current window.
- To support the extension's single purpose: visually switching between tabs in the current browser window.

What TabScroll does not do:

- It does not send browsing data, screenshots, or personal information to external servers.
- It does not use analytics, advertising, tracking pixels, or third-party telemetry.
- It does not sell, transfer, or share your browsing data with third parties.

Storage and retention:

- TabScroll processes tab metadata and the active-tab preview locally in the browser.
- The extension does not intentionally persist screenshots or browsing history in extension storage for later use.
- Data is kept only as long as needed to render the current overlay session in memory.

Permissions used:

- `tabs`: used to read the tabs in the current browser window so TabScroll can show the tab list, including title, URL, favicon, order, and active state, and then activate the tab you choose.
- `activeTab`: used only when you explicitly open TabScroll so the extension can access the current page and capture a preview of the tab you invoked it on.
- `scripting`: used to inject the overlay into the tab where you explicitly opened TabScroll.
- `debugger`: used only to capture preview screenshots of the other tabs in the same current window without visibly switching to them. Those previews are processed locally in the browser and used only to render the visual switcher UI.

Changes to this policy:

- If TabScroll's data handling changes, this policy should be updated before a new version is published.

# TabScroll Privacy Policy

Last updated: 2026-04-21

TabScroll is a browser extension that opens a full-screen tab switcher for the current browser window.

Data TabScroll processes:

- Current-window tab metadata needed to render the switcher, including each tab's title, URL or pending URL, favicon, position, and active state.
- A screenshot preview of the currently active tab when you explicitly open TabScroll from the toolbar button or keyboard shortcut.
- While the overlay is open, TabScroll may also try to capture screenshot previews of other eligible tabs in the same current window so you can recognize them more quickly.
- A local visual theme preference (`night` or `white`) may be stored on your device so the overlay can reopen with your last selected theme.

How TabScroll uses that data:

- To show the tabs in the current browser window inside the TabScroll interface.
- To let you move through those tabs and activate the tab you choose.
- To show visual previews that help you identify tabs more quickly.
- To remember your local theme choice for the overlay.

What TabScroll does not do:

- It does not send tab metadata, URLs, screenshots, or theme preference to external servers.
- It does not use analytics, advertising, tracking pixels, or third-party telemetry.
- It does not sell, transfer, or share browsing data or screenshot previews with third parties.
- It does not use browsing data or screenshots for any purpose unrelated to the tab switcher.

Storage and retention:

- Tab metadata and screenshot previews are processed locally in the browser for the current overlay session.
- Screenshot previews are kept only in memory as long as needed to render the current session.
- TabScroll does not intentionally save screenshots or browsing history to extension storage for later use.
- The theme preference may be stored locally on your device until you change it or clear extension or site data.

Permissions used:

- `tabs`: used to read the tabs in the current browser window so TabScroll can show the list of tabs, including title, URL, favicon, order, and active state, and activate the selected tab.
- `activeTab`: used only after explicit user invocation so TabScroll can access the current page, inject the overlay, and capture the currently visible tab preview.
- `scripting`: used to inject the TabScroll overlay into the tab where you explicitly opened it.
- `debugger`: used only while you explicitly use TabScroll to capture previews of other eligible tabs in the same window without visibly switching to them. Those previews are processed locally in the browser and used only to render the visual switcher.

Chrome Web Store limited use statement:

- TabScroll accesses browsing activity and tab preview data only to provide the user-facing tab switcher described in the Chrome Web Store listing and in the extension UI.
- TabScroll does not use that data for advertising, profiling, analytics, or any unrelated purpose.
- TabScroll does not transfer that data to third parties.

Changes to this policy:

- If TabScroll's permissions, features, or data handling change, this policy should be updated before a new version is published.

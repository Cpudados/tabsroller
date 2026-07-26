# TabScroll Privacy Policy

Last updated: 2026-07-26

TabScroll is a browser extension that opens a full-screen tab switcher for the current browser window or all normal browser windows.

Data TabScroll processes:

- Tab metadata from normal browser windows needed to render and search the switcher, including each tab's title, URL or pending URL, favicon, window, position, active state, recent access time, pin state, audio state, mute state, and discarded state.
- A screenshot preview of the currently active tab when you explicitly open TabScroll from the toolbar button or keyboard shortcut.
- Screenshot previews of other eligible open tabs captured while you explicitly use TabScroll, so their content can be recognized without switching to each tab.
- A local visual theme preference (`night` or `white`) may be stored on your device so the overlay can reopen with your last selected theme.

How TabScroll uses that data:

- To show and search tabs from the current browser window or all normal browser windows inside the TabScroll interface.
- To suggest the most recently active tab as a local "Jump back" shortcut.
- To let you move through those tabs and activate the tab you choose.
- To let you close, pin, unpin, mute, or unmute the selected tab.
- To identify duplicate URLs and show pin, audio, mute, and discarded status locally.
- To show visual previews that help you identify tabs more quickly.
- To remember your local theme choice for the overlay.
- To update the locally rendered three-slot carousel when the selected tab changes.

What TabScroll does not do:

- It does not send tab metadata, URLs, screenshots, or theme preference to external servers.
- It does not use analytics, advertising, tracking pixels, or third-party telemetry.
- It does not load remote scripts, fonts, textures, models, or other visual assets for the interface.
- It does not sell, transfer, or share browsing data or screenshot previews with third parties.
- It does not use browsing data or screenshots for any purpose unrelated to the tab switcher.

Storage and retention:

- Tab metadata and screenshot previews are processed locally in the browser.
- Downscaled screenshot previews may be kept in Chrome's extension session storage. Cached previews are reused for up to ten minutes, and session storage is cleared when the browser session or extension session ends.
- TabScroll does not intentionally save screenshots or browsing history to extension storage for later use.
- The theme preference may be stored locally on your device until you change it or clear extension or site data.

Permissions used:

- `tabs`: used to read tabs in normal browser windows so TabScroll can show and search them, including title, URL, favicon, window, order, active state, recent access time, pin, audio, mute, and discarded status; suggest a tab to jump back to; and activate, close, pin, or mute only the selected tab.
- `activeTab`: used only after explicit user invocation so TabScroll can access the current page, inject the overlay, and capture the currently visible tab preview.
- `scripting`: used to inject the TabScroll overlay into the tab where you explicitly opened it.
- `storage`: used for session-only caching of downscaled previews so unchanged tabs can reuse an existing preview.
- `debugger`: used while you explicitly use TabScroll to capture previews of other eligible open tabs without visibly switching to them. Chrome shows its native debugging banner while this capture is active.

Chrome Web Store limited use statement:

- TabScroll accesses browsing activity and tab preview data only to provide the user-facing tab switcher described in the Chrome Web Store listing and in the extension UI.
- TabScroll does not use that data for advertising, profiling, analytics, or any unrelated purpose.
- TabScroll does not transfer that data to third parties.

Changes to this policy:

- If TabScroll's permissions, features, or data handling change, this policy should be updated before a new version is published.

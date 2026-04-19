# TabScroll Chrome Web Store Notes

Last updated: 2026-04-19

Use this file as the source of truth when filling out the Chrome Web Store listing and privacy fields.

Single purpose:

- TabScroll is a full-screen tab switcher for the current browser window.

Suggested short description:

- A full-screen tab switcher for browsing crowded Chrome windows with keyboard, scroll, and click controls.

Suggested detailed description:

- TabScroll opens a full-screen overlay over the current page and shows the tabs from your current browser window in a focused, visual switcher. Use the mouse wheel or arrow keys to move between tabs, then press Enter or click the centered card to activate it.
- The extension reads the tabs in the current browser window so it can show each tab's title, URL, favicon, order, and active state inside the switcher. This is the core functionality of the product.
- When you explicitly open TabScroll, it captures a preview of the active tab and then tries to capture preview screenshots of the other tabs in the same window so you can recognize and switch to the right tab more quickly.
- TabScroll processes this data locally in the browser only to render the tab switcher and activate the tab you choose. It does not send browsing data or screenshots to any remote service.

Permissions justification:

- `tabs`: required to read the tabs in the current browser window so TabScroll can show the tab list, including title, URL, favicon, order, and active state, and activate the selected tab.
- `activeTab`: required only after explicit user invocation so TabScroll can access the current page, inject the overlay, and capture a preview of the active tab.
- `scripting`: required to inject the overlay host script into the tab where the user explicitly opened TabScroll.
- `debugger`: required only to capture preview screenshots of the other tabs in the same current window without visibly switching tabs. Those previews are used only to render the visual tab switcher locally in the browser.

Ready-to-paste store explanation:

- TabScroll reads the current window's tabs to show a visual tab switcher, including each tab's title, URL, favicon, order, and active state. This is the core function of the extension.
- When the user explicitly opens TabScroll, the extension captures preview images so the user can recognize and switch to the right tab quickly. The active tab is captured from the explicit invocation, and the other tabs in the same window are captured in the background so the switcher can stay visual without visibly changing tabs.
- TabScroll uses this data only locally in the browser to render the switcher and activate the selected tab. It does not send browsing data, tab contents, or screenshots to any remote service, and it does not use this data for analytics, advertising, or tracking.

Privacy disclosures:

- Handles browsing activity only as required to show the current window's tabs inside the extension UI.
- Captures the active tab's screenshot preview on explicit user invocation.
- Also captures other open tabs in the current window in the background when the user explicitly opens the overlay.
- No remote transmission, analytics, sale, or sharing of browsing data.
- Privacy policy file: `PRIVACY.md`

Submission checklist:

- Replace the Chrome Web Store privacy policy URL with a public URL that serves the contents of `PRIVACY.md`.
- Ensure the store listing description matches the current behavior exactly.
- Answer the dashboard privacy questions consistently with the privacy policy.
- Add a support email or website in the developer dashboard.
- Test on regular `http` and `https` pages before upload.

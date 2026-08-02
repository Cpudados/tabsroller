# TabScroll Chrome Web Store Notes

Last updated: 2026-07-26

Use this file as the source of truth when filling out the Chrome Web Store listing and privacy fields.

Single purpose:

- TabScroll is a full-screen tab switcher for searching and managing open browser tabs.

Suggested short description:

- A full-screen tab switcher for searching and managing crowded Chrome windows with keyboard, scroll, and click controls.

Suggested detailed description:

- TabScroll opens a full-screen overlay over the current page and shows tabs from the current browser window or all normal browser windows in a focused, visual switcher. Start typing to filter by title, domain, or URL; use the mouse wheel or arrow keys to move between results; press `R` to jump back; or press Enter to activate a selection. The selected tab can also be closed, pinned, or muted with `Delete`, `P`, or `M`.
- A single three-slot carousel shows the previous, focused, and next tab without loading remote visual assets or transmitting tab data.
- The extension reads open tabs in normal browser windows so it can search and show each tab's title, URL, favicon, window, order, active state, recent access time, pin, audio, mute, and discarded status inside the switcher. This is the core functionality of the product.
- When you explicitly open TabScroll, it captures a preview of the active tab and refreshes nearby missing inactive-tab previews on demand in small, session-scoped batches. Downscaled previews are cached for the browser session and invalidated when a tab navigates.
- TabScroll processes this data locally in the browser only to render the tab switcher and activate the tab you choose. It does not send browsing data or screenshots to any remote service.

Permissions justification:

- `tabs`: required to read tabs in normal browser windows so TabScroll can search and show the tab list, including title, URL, favicon, window, order, active state, recent access time, pin, audio, mute, and discarded status; suggest a tab to jump back to; and activate, close, pin, or mute only the selected tab.
- `activeTab`: required only after explicit user invocation so TabScroll can access the current page, inject the overlay, and capture a preview of the active tab.
- `scripting`: required to inject the overlay host script into the tab where the user explicitly opened TabScroll.
- `storage`: required to keep downscaled previews in session-only storage so unchanged tabs can reuse a preview without another debugger attachment.
- `debugger`: required to capture preview screenshots of inactive eligible tabs without visibly switching tabs. Chrome shows its native debugging banner only while the capture batch is active.

Ready-to-paste store explanation:

- TabScroll reads tabs from normal browser windows to show and search a visual tab switcher, including each tab's title, URL, favicon, window, order, active state, recent access time, pin, audio, mute, and discarded status. The recent access time is used locally to offer a "Jump back" shortcut. This is the core function of the extension.
- When the user explicitly opens TabScroll, the extension captures preview images so the user can recognize and switch to the right tab quickly. Nearby missing inactive-tab previews are captured on demand in limited, session-scoped batches, downscaled during capture, and cached only for the browser session.
- TabScroll uses this data only locally in the browser to render the switcher and activate the selected tab. It does not send browsing data, tab contents, or screenshots to any remote service, and it does not use this data for analytics, advertising, or tracking.

Privacy disclosures:

- Handles browsing activity only as required to show, search, and update open tabs inside the extension UI.
- Captures the active tab's screenshot preview on explicit user invocation.
- Captures missing inactive-tab previews while TabScroll is open and keeps downscaled copies in session-only storage. Cached previews are reused for up to ten minutes.
- No remote transmission, analytics, sale, or sharing of browsing data.
- No remote fonts, scripts, textures, models, or other visual assets are loaded by the interface.
- Privacy policy file: `PRIVACY.md`

Submission checklist:

- Replace the Chrome Web Store privacy policy URL with a public URL that serves the contents of `PRIVACY.md`.
- Ensure the store listing description matches the current behavior exactly.
- Answer the dashboard privacy questions consistently with the privacy policy.
- Add a support email or website in the developer dashboard.
- Test on regular `http` and `https` pages before upload.

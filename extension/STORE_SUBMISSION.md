# TabScroll Chrome Web Store submission

Last updated: 2026-07-19

Use `marketing/STORE_LISTING.md` as the copy-and-paste source for the public listing. This file contains the technical declarations used in the Chrome Web Store dashboard.

## Single purpose

TabScroll is a full-screen visual switcher for tabs in the user's current Chrome window.

## Permission justifications

- `tabs`: reads the current window's tabs so the switcher can display titles, URLs, favicons, order, and active state, then activate the tab selected by the user.
- `activeTab`: gives temporary access only after the user invokes TabScroll, allowing it to inject the overlay and capture the currently visible tab.
- `scripting`: injects the overlay host script into the page where the user explicitly opened TabScroll.
- `debugger`: captures preview screenshots of other eligible tabs in the same window without visibly switching to them. The extension attaches only for the capture, detaches immediately afterward, and uses the images locally for the current overlay session.

## Data-use statement

TabScroll processes current-window tab metadata and temporary screenshot previews only to render its user-facing switcher and activate the tab selected by the user. It does not send browsing data, tab contents, screenshots, or preferences to a remote service. It has no analytics, advertising, tracking, profiling, sale, or sharing of user data.

## Dashboard checklist

- Detailed description matches `marketing/STORE_LISTING.md`.
- Category: **Productivity > Tools**.
- Privacy policy: `https://cpudados.github.io/tabsroller/privacy/` after GitHub Pages is enabled from `/docs` on `main`.
- Support page: `https://github.com/Cpudados/tabsroller/issues`.
- Homepage: `https://cpudados.github.io/tabsroller/` after GitHub Pages is enabled.
- Upload all five 1280×800 screenshots from `marketing/store-assets/output/`.
- Upload the 440×280 small promotional tile and 1400×560 marquee tile from the same folder.
- Confirm that tab metadata and screenshot previews are handled but not collected or transmitted.
- Test the release package on regular `http` and `https` pages.
- Confirm the version in `manifest.json` is higher than the currently published version.

## Important conversion note

Chrome displays these warnings because of the required `debugger` permission:

- “Access the page debugger backend.”
- “Read and change all your data on all websites.”

Do not hide this. Explain clearly that the permission is used only to capture background-tab previews locally and that Chrome displays a native banner while capture is active.

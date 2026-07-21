# TabScroll Chrome Web Store submission

Last updated: 2026-07-19

Use `marketing/STORE_LISTING.md` as the copy-and-paste source for the public listing. This file contains the technical declarations used in the Chrome Web Store dashboard.

## Single purpose

TabScroll is a full-screen visual switcher for tabs in the user's current Chrome window.

## Permission justifications

Required permissions:

- `activeTab`: gives temporary access only after the user invokes TabScroll, allowing capture of the currently visible tab and injection of the switcher on that page.
- `scripting`: injects the TabScroll overlay host script into the page where the user explicitly opened it.

Optional permission:

- `tabs`: after a separate in-product explanation and user choice, reads titles, addresses, favicons, order, and active state for tabs currently open in the window. It is used only to make the switcher cards recognizable and activate the selected tab. The core switcher remains usable if the user declines.

TabScroll does not request `debugger`, host permissions, or access to Chrome's stored history.

## Data-use statement

TabScroll processes current-window tab state, optional open-tab details, and one temporary screenshot of the currently visible tab only to render its switcher and activate the user's selection. It does not send browsing data, tab contents, screenshots, or preferences to a remote service. It has no analytics, advertising, tracking, profiling, sale, or sharing of user data.

## Dashboard checklist

- Detailed description matches `marketing/STORE_LISTING.md`.
- Category: **Productivity > Tools**.
- Privacy policy: `https://cpudados.github.io/tabsroller/privacy/` after GitHub Pages is enabled from `/docs` on `main`.
- Support page: `https://github.com/Cpudados/tabsroller/issues`.
- Homepage: `https://cpudados.github.io/tabsroller/` after GitHub Pages is enabled.
- Upload all five current 1280×800 screenshots from `marketing/store-assets/output/` in the documented order.
- Upload the 440×280 small promotional tile and 1400×560 marquee tile from the same folder if promotional placement is planned.
- Declare open-tab details and the active-tab screenshot accurately in the privacy questionnaire.
- Confirm that the optional `tabs` permission is explained before it is requested.
- Test both permission paths: **Allow tab details** and **Continue with limited view**.
- Test toolbar, shortcut, wheel, arrows, Enter, direct card click, wraparound, and Escape on regular `http` and `https` pages.
- Confirm version `0.2.0` is higher than the currently published version.

## Trust check before traffic

- Install should not request debugger access or all-site host access.
- The first listing screenshot must show the real current interface at a readable scale.
- Public copy must distinguish the current-tab preview from background-tab identity cards.
- Permission language must explain Chrome's browsing-history label without claiming access to stored history.

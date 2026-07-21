# TabScroll Privacy Policy

Last updated: 2026-07-19

TabScroll is a browser extension that opens a full-screen tab switcher for the current browser window.

## Data TabScroll processes

- Basic current-window tab state needed for switching, including tab identifiers, positions, and active state.
- If the user enables the optional **tab details** permission: the title, URL or pending URL, and favicon of tabs currently open in that window.
- A screenshot preview of the currently visible tab when the user explicitly opens TabScroll from the toolbar button or keyboard shortcut.
- A local visual theme preference and a flag recording whether first-use onboarding has been completed.

## How TabScroll uses that data

- To show the current window's tabs in the TabScroll interface.
- To help the user recognize tabs and activate the one they choose.
- To remember the local theme and avoid repeating onboarding.

## What TabScroll does not do

- It does not send tab details, URLs, screenshots, or preferences to external servers.
- It does not capture screenshots of background tabs.
- It does not request or use Chrome's debugger permission.
- It does not use analytics, advertising, tracking pixels, profiling, or third-party telemetry.
- It does not sell, transfer, or share browsing data with third parties.

## Storage and retention

- Tab details and the current-tab screenshot are processed locally for the active overlay session.
- The screenshot is kept only in memory as long as needed to render that session and is not intentionally saved to extension storage.
- The theme and onboarding-complete preferences remain in local extension storage until the user changes them or clears extension data.
- TabScroll does not create or retain a database of browsing history.

## Permissions used

- `activeTab` (required): temporary access after explicit user invocation so TabScroll can capture the currently visible tab and inject the overlay on that page.
- `scripting` (required): injects the TabScroll overlay host script after explicit user invocation.
- `tabs` (optional): reads the titles, addresses, favicons, order, and active state of tabs currently open in the window. Chrome may label this capability as reading browsing history because it exposes open-tab addresses. TabScroll does not access Chrome's stored history.

The switcher remains usable when the optional `tabs` permission is declined. Background tabs then use limited, generic labels.

## Chrome Web Store limited use statement

TabScroll accesses open-tab details and the active-tab preview only to provide the user-facing tab switcher described in the Chrome Web Store listing and extension UI. TabScroll does not use that data for advertising, profiling, analytics, or any unrelated purpose, and it does not transfer that data to third parties.

## Changes

If TabScroll's permissions, features, or data handling change, this policy will be updated before the related release is published.

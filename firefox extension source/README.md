# TabScroll — Source Code

This extension requires **no build step**. The source files are the extension files.

## Requirements

- Firefox 140+
- No Node.js, npm, or any build tools required

## How to load temporarily (for review)

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json` from this folder.

## How to build the signed package

The submitted `.xpi` is produced by zipping the contents of this folder directly:

```
zip -r tabscroll.zip . --exclude "*.zip"
```

Or use the [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) tool:

```
npx web-ext build
```

The resulting ZIP is identical to the submitted extension — no compilation, transpilation, or minification occurs.

## File overview

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `background.js` | Service worker — tab state, preview capture, message routing |
| `tab-classifier.js` | Classifies tabs (collection detection, deduplication) |
| `content-script.js` | Injects the overlay host into the active tab |
| `overlay.html` | Full-screen overlay page |
| `overlay.js` | Overlay UI logic (rendering, keyboard handling, search) |
| `overlay.css` | Overlay styles |
| `tokens.css` | Design tokens (colors, typography) |
| `icons/` | Extension icons |
| `vendor/` | Bundled third-party libraries (Three.js — MIT license) |

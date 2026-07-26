# TabScroll Three.js graphics pass

## Direction

- Scene role: support surface behind the real tab preview, never a competing hero.
- Visual language: carbon lacquer, warm bone, and one vermilion selection signal.
- Signature form: an authored browser-tab silhouette repeated as an elliptical session current.
- State link: the current rotates only when `activeIndex` changes; the highlighted slab and rendered count follow the live tab session.
- Motion rule: request frames while easing to a new selection, then stop. Reduced motion snaps immediately.

## Reference ledger

- User screenshot: baseline for the grid-heavy treatment to remove.
- Hallmark `Map / Diagram`: chosen macrostructure because tab relationships are spatial and navigable.
- Three.js graphics-builder references: implementation blueprint, model recipes, render recipes, technical art, shader cookbook, and visual scorecard.
- No visual site was copied or closely reproduced.

## Asset ledger

| Need | Decision | Source / status | Reason |
| --- | --- | --- | --- |
| 3D backdrop | Procedural, repo-native Three.js | `extension/tab-scene.js` | Live selection state is the value; a still would not earn WebGL. |
| Runtime | Vendored Three.js 0.185.1 | npm package, MIT license | Chrome extension CSP and offline/privacy requirements rule out a CDN. |
| Raster artwork | None | Image-generator credential probe timed out and was terminated | A static image would add weight and could not respond to tab navigation. |
| External 3D model | None | Not required | The repeated tab slab is a support prop, not a complex hero asset. |

## Material kit

- `bodyPrimary`: medium-metal, semi-rough lacquer for instanced tab shells.
- `bodySecondary`: high-roughness inset faces.
- `trim`: warm-bone rail and index ticks.
- `emissiveSignal`: low-emission vermilion active tab; no bloom.
- `groundContact`: transparent contact plate that anchors the orbit.

## Render recipe

- Vanilla Three.js, local ES module.
- `SRGBColorSpace`, ACES filmic tone mapping, exposure `1.04`.
- One hemisphere light and two directional lights.
- No shadows, textures, environment map, shaders, particles, bloom, or post-processing.
- Instanced meshes for tab bodies, faces, and ticks.
- Pixel ratio cap: `1.5` desktop, `1.25` narrow viewports.
- Static CSS tab composition remains when WebGL cannot initialize.

## Budget

| Metric | Ceiling |
| --- | ---: |
| Draw calls | 20 |
| Triangles | 30,000 |
| Geometries | 10 |
| Textures | 0 |
| Materials | 5 |
| Post passes | 0 |
| Render loop at rest | stopped |

Runtime inspection is exposed through `window.TabScrollBackdrop.getDiagnostics()`.

## Visual scorecard status

No premium, AAA, or showcase score is claimed. The connected browser surface was unavailable, so there is no honest active screenshot or post-change renderer capture to score against the packaged anchors. Source-level budget tests and the diagnostics hook pass; the remaining release check is to reload the unpacked extension, navigate once, and inspect `getDiagnostics()` plus desktop/narrow screenshots.

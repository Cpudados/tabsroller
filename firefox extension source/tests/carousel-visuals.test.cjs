const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.join(__dirname, "..");
const overlayCss = fs.readFileSync(path.join(extensionRoot, "overlay.css"), "utf8");
const overlaySource = fs.readFileSync(path.join(extensionRoot, "overlay.js"), "utf8");
const tokensCss = fs.readFileSync(path.join(extensionRoot, "tokens.css"), "utf8");

test("keeps preview cards carbon-black in both application themes", () => {
  assert.match(tokensCss, /--color-carousel-paper:\s*oklch\(0\.125 0\.012 70\)/);
  assert.match(overlayCss, /\.ts-card\s*\{[\s\S]*--color-surface:\s*var\(--color-carousel-paper\)/);
  assert.match(
    overlayCss,
    /\.ts-card-wrap:not\(\[data-position="center"\]\) \.ts-preview > img\s*\{[\s\S]*opacity:\s*0\.42/
  );
});

test("uses a kinetic three-slot rail without a WebGL or 3D depth system", () => {
  assert.match(
    overlayCss,
    /\.ts-cards\s*\{[\s\S]*--carousel-side-width:\s*min\(21rem, 21vw\)[\s\S]*--carousel-spread:\s*min\(34rem, 42vw\)[\s\S]*--carousel-drag-x:\s*0rem/
  );
  assert.match(
    overlayCss,
    /\.ts-card-wrap\[data-position="left"\]\s*\{[\s\S]*--carousel-slot-x:\s*calc\(0rem - var\(--carousel-spread\)\)[\s\S]*--carousel-slot-rotate:\s*1\.5deg/
  );
  assert.match(
    overlayCss,
    /\.ts-card-wrap\[data-position="right"\]\s*\{[\s\S]*--carousel-slot-x:\s*var\(--carousel-spread\)[\s\S]*--carousel-slot-rotate:\s*-1\.5deg/
  );
  assert.match(overlayCss, /@keyframes ts-carousel-card-shift[\s\S]*58%/);
  assert.match(overlayCss, /@keyframes ts-focus-sweep/);
  assert.match(overlayCss, /\.ts-cards\.is-dragging \.ts-card-wrap\s*\{[\s\S]*transition:\s*none/);
  assert.match(tokensCss, /--dur-carousel:\s*440ms/);
  assert.match(overlayCss, /@media \(min-width: 52rem\)/);
  assert.doesNotMatch(overlayCss, /perspective|translateZ|rotateY|left-far|right-far/);
  assert.match(overlayCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test("keeps side slots physically separate whenever they are visible", () => {
  for (const viewportWidth of [832, 960, 1280, 1920]) {
    const centerWidth =
      viewportWidth >= 960
        ? Math.min(576, viewportWidth - 64)
        : Math.min(512, viewportWidth - 48);
    const sideWidth = Math.min(336, viewportWidth * 0.21);
    const spread = Math.min(544, viewportWidth * 0.42);
    const gap = spread - centerWidth / 2 - sideWidth / 2;

    assert.ok(gap >= 0, `expected a non-overlapping gap at ${viewportWidth}px`);
  }
});

test("keeps the focused card inside the stage at Hallmark mobile widths", () => {
  for (const viewportWidth of [320, 375, 414, 768]) {
    const stageInset = viewportWidth >= 640 ? 48 : 16;
    const stageWidth = viewportWidth - stageInset;
    const cardWidth =
      viewportWidth >= 640
        ? Math.min(512, viewportWidth - 48)
        : viewportWidth - 16;

    assert.ok(
      cardWidth <= stageWidth,
      `expected focused card to fit the ${viewportWidth}px stage`
    );
  }

  assert.match(overlayCss, /html,\s*body\s*\{[\s\S]*overflow-x:\s*clip/);
});

test("renders the application surface without scene or fallback layers", () => {
  assert.match(overlayCss, /#app\s*\{[\s\S]*background:\s*var\(--color-paper\)/);
  assert.doesNotMatch(overlayCss, /#ts-scene|\.ts-scene-fallback|\.ts-fallback-tab/);
});

test("continues rapid navigation from the live transform and supports drag-to-snap", () => {
  assert.match(overlaySource, /function captureCarouselSnapshot\(\)/);
  assert.match(overlaySource, /function playCarouselTransition\(snapshot, step\)/);
  assert.match(overlaySource, /card\.animate\(/);
  assert.match(overlaySource, /document\.addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(overlaySource, /window\.addEventListener\("pointermove", handlePointerMove/);
  assert.match(overlaySource, /DRAG_COMMIT_DISTANCE\s*=\s*72/);
  assert.match(
    overlaySource,
    /window\.matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)\?\.matches/
  );
  assert.match(
    overlayCss,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*ts-carousel-card-fade var\(--dur-instant\) linear both/
  );
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.join(__dirname, "..");
const overlayCss = fs.readFileSync(path.join(extensionRoot, "overlay.css"), "utf8");
const tokensCss = fs.readFileSync(path.join(extensionRoot, "tokens.css"), "utf8");

test("keeps preview cards carbon-black in both application themes", () => {
  assert.match(tokensCss, /--color-carousel-paper:\s*oklch\(0\.125 0\.012 70\)/);
  assert.match(overlayCss, /\.ts-card\s*\{[\s\S]*--color-surface:\s*var\(--color-carousel-paper\)/);
  assert.match(
    overlayCss,
    /\.ts-card-wrap:not\(\[data-position="center"\]\) \.ts-preview > img\s*\{[\s\S]*opacity:\s*0\.28/
  );
});

test("uses one flat three-slot reel with no second depth system", () => {
  assert.match(
    overlayCss,
    /\.ts-cards\s*\{[\s\S]*--carousel-side-width:\s*min\(22rem, 22vw\)[\s\S]*--carousel-spread:\s*min\(33rem, 42vw\)/
  );
  assert.match(
    overlayCss,
    /\.ts-card-wrap\[data-position="left"\]\s*\{[\s\S]*translate\(calc\(-50% - var\(--carousel-spread\)\), -50%\)/
  );
  assert.match(
    overlayCss,
    /\.ts-card-wrap\[data-position="right"\]\s*\{[\s\S]*translate\(calc\(-50% \+ var\(--carousel-spread\)\), -50%\)/
  );
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
    const sideWidth = Math.min(352, viewportWidth * 0.22);
    const spread = Math.min(528, viewportWidth * 0.42);
    const gap = spread - centerWidth / 2 - sideWidth / 2;

    assert.ok(gap >= 0, `expected a non-overlapping gap at ${viewportWidth}px`);
  }
});

test("renders the application surface without scene or fallback layers", () => {
  assert.match(overlayCss, /#app\s*\{[\s\S]*background:\s*var\(--color-paper\)/);
  assert.doesNotMatch(overlayCss, /#ts-scene|\.ts-scene-fallback|\.ts-fallback-tab/);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.join(__dirname, "..");
const sceneSource = fs.readFileSync(path.join(extensionRoot, "tab-scene.js"), "utf8");
const manifest = JSON.parse(
  fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8")
);
const overlayHtml = fs.readFileSync(path.join(extensionRoot, "overlay.html"), "utf8");
const vendorSource = fs.readFileSync(
  path.join(extensionRoot, "vendor", "three.module.min.js"),
  "utf8"
);

test("ships the Three.js scene locally with a static fallback", () => {
  assert.match(sceneSource, /from "\.\/vendor\/three\.module\.min\.js"/);
  assert.doesNotMatch(sceneSource, /https?:\/\//);
  assert.match(overlayHtml, /id="ts-scene-fallback"/);
  assert.match(overlayHtml, /id="ts-scene"/);
  assert.match(overlayHtml, /type="module" src="tab-scene\.js"/);
  assert.ok(vendorSource.length > 300000);

  const resources = manifest.web_accessible_resources.flatMap(
    (entry) => entry.resources
  );
  assert.ok(resources.includes("tab-scene.js"));
  assert.ok(resources.includes("vendor/three.module.min.js"));
});

test("keeps the scene within its declared support-surface budget", () => {
  assert.match(sceneSource, /new THREE\.InstancedMesh/);
  assert.match(sceneSource, /THREE\.SRGBColorSpace/);
  assert.match(sceneSource, /THREE\.ACESFilmicToneMapping/);
  assert.match(sceneSource, /renderer\.shadowMap\.enabled = false/);
  assert.match(sceneSource, /DESKTOP_DPR_CAP = 1\.5/);
  assert.match(sceneSource, /NARROW_DPR_CAP = 1\.25/);
  assert.match(sceneSource, /postPasses: 0/);
  assert.match(sceneSource, /getDiagnostics/);
  assert.doesNotMatch(sceneSource, /EffectComposer|BloomPass|UnrealBloomPass/);
  assert.doesNotMatch(sceneSource, /TextureLoader|ImageLoader/);
});

test("ties motion to real tab state and stops scheduling at rest", () => {
  assert.match(sceneSource, /activeIndex/);
  assert.match(sceneSource, /totalTabs/);
  assert.match(sceneSource, /targetRotation/);
  assert.match(sceneSource, /Math\.abs\(difference\) <= 0\.0007/);
  assert.match(sceneSource, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(sceneSource, /setInterval/);
});

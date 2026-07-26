const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.join(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8")
);
const overlayHtml = fs.readFileSync(path.join(extensionRoot, "overlay.html"), "utf8");
const overlaySource = fs.readFileSync(path.join(extensionRoot, "overlay.js"), "utf8");

test("mounts only the DOM carousel and exposes no WebGL carousel resources", () => {
  assert.doesNotMatch(overlayHtml, /ts-scene|tab-scene\.js|<canvas/);
  assert.doesNotMatch(overlaySource, /TabScrollBackdrop|TabScrollSceneState|syncBackdrop/);

  const resources = manifest.web_accessible_resources.flatMap(
    (entry) => entry.resources
  );
  assert.equal(resources.some((resource) => resource === "tab-scene.js"), false);
  assert.equal(resources.some((resource) => resource.startsWith("vendor/three")), false);
});

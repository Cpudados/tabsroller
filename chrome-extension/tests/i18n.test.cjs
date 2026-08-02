const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const extensionRoot = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(extensionRoot, "i18n.js"), "utf8");
const overlaySource = fs.readFileSync(path.join(extensionRoot, "overlay.js"), "utf8");
const context = vm.createContext({ Intl });
context.globalThis = context;
vm.runInContext(source, context, { filename: "i18n.js" });

const i18n = context.TabScrollI18n;

test("every supported language has the complete English message catalog", () => {
  const englishKeys = Object.keys(i18n.messages.en).sort();

  assert.equal(i18n.LANGUAGE_OPTIONS.length, 6);

  const flagAssets = new Set();

  for (const { code, flagAsset } of i18n.LANGUAGE_OPTIONS) {
    assert.deepEqual(Object.keys(i18n.messages[code]).sort(), englishKeys, code);
    assert.match(flagAsset, /^icons\/flags\/[a-z]{2}\.svg$/, code);
    assert.ok(fs.existsSync(path.join(extensionRoot, flagAsset)), `${code}:${flagAsset}`);
    flagAssets.add(flagAsset);
  }

  assert.equal(flagAssets.size, i18n.LANGUAGE_OPTIONS.length);
});

test("language resolution supports browser locale variants and falls back safely", () => {
  assert.equal(i18n.resolvePreferredLanguage(["ja-JP", "pt-PT"]), "pt-BR");
  assert.equal(i18n.resolvePreferredLanguage("pt_BR"), "pt-BR");
  assert.equal(i18n.resolvePreferredLanguage("es-MX"), "es");
  assert.equal(i18n.resolvePreferredLanguage("fr-CA"), "fr");
  assert.equal(i18n.resolvePreferredLanguage("de-DE"), "de");
  assert.equal(i18n.resolvePreferredLanguage("tr-TR"), "tr");
  assert.equal(i18n.resolvePreferredLanguage("ja-JP"), "en");
  assert.equal(i18n.normalizeLanguage("unexpected"), "en");
});

test("translations interpolate values and use locale-aware plural forms", () => {
  assert.equal(i18n.translate("en", "tab_count", { count: 1 }), "1 tab");
  assert.equal(i18n.translate("en", "tab_count", { count: 3 }), "3 tabs");
  assert.equal(i18n.translate("pt-BR", "tab_count", { count: 2 }), "2 abas");
  assert.equal(
    i18n.translate("tr", "collection_open", { name: "Proje" }),
    "Göz atmak veya geri yüklemek için Proje koleksiyonunu açın."
  );
});

test("localized manifest catalogs contain every referenced message", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));
  const referencedKeys = JSON.stringify(manifest)
    .match(/__MSG_([A-Za-z0-9_]+)__/g)
    .map((token) => token.slice(6, -2));

  for (const locale of ["en", "pt_BR", "es", "fr", "de", "tr"]) {
    const catalog = JSON.parse(
      fs.readFileSync(path.join(extensionRoot, "_locales", locale, "messages.json"), "utf8")
    );

    for (const key of referencedKeys) {
      assert.equal(typeof catalog[key]?.message, "string", `${locale}:${key}`);
      assert.ok(catalog[key].message.length > 0, `${locale}:${key}`);
    }
  }
});

test("browser icon files match every PNG size declared by the manifest", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));

  for (const [declaredSize, iconPath] of Object.entries(manifest.icons)) {
    const png = fs.readFileSync(path.join(extensionRoot, iconPath));
    const expectedSize = Number(declaredSize);

    assert.equal(png.subarray(1, 4).toString("ascii"), "PNG", iconPath);
    assert.equal(png.readUInt32BE(16), expectedSize, `${iconPath}:width`);
    assert.equal(png.readUInt32BE(20), expectedSize, `${iconPath}:height`);
  }
});

test("language control uses a custom accessible popover instead of a native select", () => {
  assert.match(overlaySource, /class=\"ts-language-menu\"[^>]+popover=\"auto\"/);
  assert.match(overlaySource, /role=\"menuitemradio\"/);
  assert.match(overlaySource, /<img class=\"ts-language-flag\"/);
  assert.match(overlaySource, /handleLanguageMenuKeyDown/);
  assert.doesNotMatch(overlaySource, /ts-language-select/);
});

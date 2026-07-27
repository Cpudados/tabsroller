const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const backgroundSource = fs.readFileSync(
  path.join(__dirname, "..", "background.js"),
  "utf8"
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8")
);

function loadBackground(chromeOverrides = {}) {
  const chrome = {
    action: {
      onClicked: {
        addListener() {},
      },
    },
    commands: {
      onCommand: {
        addListener() {},
      },
    },
    runtime: {
      getURL(value) {
        return `chrome-extension://tabscroll/${value}`;
      },
      onMessage: {
        addListener() {},
      },
    },
    scripting: {
      async executeScript() {},
    },
    tabs: {},
    ...chromeOverrides,
  };
  const context = vm.createContext({
    URL,
    chrome,
    console,
    Map,
    Promise,
    setTimeout(callback) {
      callback();
      return 1;
    },
    globalThis: null,
  });

  context.globalThis = context;
  context.TabScrollTabClassifier = {
    TAB_COLLECTION_KIND: "tab-collection",
    classifyTab() {
      return {
        kind: "regular-tab",
        collectionName: "",
      };
    },
  };
  context.importScripts = () => {};

  vm.runInContext(backgroundSource, context, {
    filename: "background.js",
  });

  return context;
}

test("declares Firefox preview access and session storage without debugger permission", () => {
  assert.doesNotMatch(backgroundSource, /chrome\.debugger/);
  assert.equal(manifest.permissions.includes("debugger"), false);
  assert.equal(manifest.permissions.includes("storage"), true);
  assert.equal(manifest.host_permissions.includes("<all_urls>"), true);
  assert.deepEqual(manifest.background.scripts, [
    "tab-classifier.js",
    "background.js",
  ]);
});

test("uses Firefox captureTab for inactive-tab previews", async () => {
  let captureCount = 0;
  const context = loadBackground({
    tabs: {
      async captureTab(tabId, options) {
        captureCount += 1;
        assert.equal(tabId, 42);
        assert.equal(options.format, "jpeg");
        assert.equal(options.quality, 60);
        return "data:image/jpeg;base64,firefox-preview";
      },
    },
  });

  const preview = await context.captureTabPreview(42);

  assert.equal(preview, "data:image/jpeg;base64,firefox-preview");
  assert.equal(captureCount, 1);
});

test("stops immediately instead of retrying after capture is canceled", async () => {
  const captureState = {
    cancelled: false,
  };
  let captureCount = 0;
  const context = loadBackground({
    tabs: {
      async captureTab() {
        captureCount += 1;
        captureState.cancelled = true;
        throw new Error("canceled by user");
      },
    },
  });

  const preview = await context.captureTabPreview(42, captureState);

  assert.equal(preview, "");
  assert.equal(captureCount, 1);
});

test("retries the visible-tab preview after a transient failure", async () => {
  let captureCount = 0;
  const context = loadBackground({
    tabs: {
      async captureVisibleTab() {
        captureCount += 1;

        if (captureCount === 1) {
          throw new Error("capture rate limited");
        }

        return "data:image/jpeg;base64,visible-data";
      },
    },
  });

  const preview = await context.captureVisiblePreview(7);

  assert.equal(preview, "data:image/jpeg;base64,visible-data");
  assert.equal(captureCount, 2);
});

test("captures four tabs in parallel and streams batched updates", async () => {
  let activeCaptures = 0;
  let maxActiveCaptures = 0;
  const messages = [];
  const tabs = [
    {
      id: 1,
      index: 0,
      windowId: 7,
      active: true,
      url: "https://host.example/",
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      id: index + 2,
      index: index + 1,
      windowId: 7,
      url: `https://preview-${index + 1}.example/`,
    })),
  ];
  const context = loadBackground({
    tabs: {
      async get() {
        return tabs[0];
      },
      async query() {
        return tabs;
      },
      async sendMessage(_tabId, message) {
        messages.push(message);
        return { ok: true };
      },
      async captureTab(tabId) {
        activeCaptures += 1;
        maxActiveCaptures = Math.max(maxActiveCaptures, activeCaptures);
        await Promise.resolve();
        activeCaptures -= 1;
        return `data:image/jpeg;base64,preview-${tabId}`;
      },
    },
  });

  await context.captureAllPreviewsForSession(1);

  const previewMessages = messages.filter(
    (message) => message.type === "tabscroll:previews-updated"
  );
  const updates = previewMessages.flatMap((message) => message.previews);

  assert.equal(maxActiveCaptures, 4);
  assert.equal(activeCaptures, 0);
  assert.equal(updates.length, 5);
  assert.ok(previewMessages.every((message) => message.previews.length <= 4));
  assert.equal(messages.at(-1).type, "tabscroll:preview-capture-complete");
});

test("reuses session-cached previews without capturing the tab again", async () => {
  const sessionData = {};
  let captureCount = 0;
  const tabs = [
    {
      id: 1,
      index: 0,
      windowId: 7,
      active: true,
      url: "https://host.example/",
    },
    {
      id: 2,
      index: 1,
      windowId: 7,
      url: "https://cached.example/",
    },
  ];
  const chromeOverrides = {
    storage: {
      session: {
        async get(key) {
          return {
            [key]: sessionData[key],
          };
        },
        async set(values) {
          Object.assign(sessionData, values);
        },
      },
    },
    tabs: {
      async get() {
        return tabs[0];
      },
      async query() {
        return tabs;
      },
      async captureVisibleTab() {
        return "data:image/jpeg;base64,active-preview";
      },
      async captureTab() {
        captureCount += 1;
        return "data:image/jpeg;base64,cached-preview";
      },
      async sendMessage() {
        return { ok: true };
      },
    },
  };
  const firstContext = loadBackground(chromeOverrides);

  await firstContext.captureAllPreviewsForSession(1);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(captureCount, 1);
  assert.equal(sessionData["tabscroll:preview-cache"].length, 1);

  const secondContext = loadBackground(chromeOverrides);
  const payload = await secondContext.buildOverlayPayload(tabs[0]);

  assert.equal(payload.tabs[1].preview, "data:image/jpeg;base64,cached-preview");

  await secondContext.captureAllPreviewsForSession(1);
  assert.equal(captureCount, 1);

  tabs[1].url = "https://cached.example/after-navigation";
  const thirdContext = loadBackground(chromeOverrides);
  const navigatedPayload = await thirdContext.buildOverlayPayload(tabs[0]);

  assert.equal(navigatedPayload.tabs[1].preview, "");

  await thirdContext.captureAllPreviewsForSession(1);
  assert.equal(captureCount, 2);
});

test("suggests the most recently accessed inactive tab", async () => {
  const context = loadBackground({
    tabs: {
      async query() {
        return [
          {
            id: 1,
            index: 0,
            windowId: 7,
            title: "Current",
            url: "https://current.example/",
            lastAccessed: 300,
          },
          {
            id: 2,
            index: 1,
            windowId: 7,
            title: "Older",
            url: "https://older.example/",
            lastAccessed: 100,
          },
          {
            id: 3,
            index: 2,
            windowId: 7,
            title: "Recent",
            url: "https://recent.example/",
            lastAccessed: 250,
          },
        ];
      },
      async captureVisibleTab() {
        return "";
      },
    },
  });

  const payload = await context.buildOverlayPayload({
    id: 1,
    index: 0,
    windowId: 7,
    title: "Current",
    url: "https://current.example/",
  });

  assert.equal(payload.recentTabId, 3);
  assert.equal(payload.tabs[2].lastAccessed, 250);
});

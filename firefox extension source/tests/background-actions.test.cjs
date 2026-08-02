const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const backgroundSource = fs.readFileSync(
  path.join(__dirname, "..", "background.js"),
  "utf8"
);

function loadBackground(chromeOverrides = {}) {
  let messageListener;
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
      id: "tabscroll",
      getURL(value) {
        return `chrome-extension://tabscroll/${value}`;
      },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        },
      },
    },
    scripting: {
      async executeScript() {},
    },
    tabs: {},
    windows: {},
  };

  for (const [key, value] of Object.entries(chromeOverrides)) {
    chrome[key] = {
      ...chrome[key],
      ...value,
    };
  }

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
        kind: "tab",
        collectionName: "",
      };
    },
  };
  context.importScripts = () => {};

  vm.runInContext(backgroundSource, context, {
    filename: "background.js",
  });

  return {
    context,
    dispatch(message, sender = {}) {
      return new Promise((resolve) => {
        const keepsChannelOpen = messageListener(message, sender, resolve);
        assert.equal(keepsChannelOpen, true);
      });
    },
  };
}

test("builds one ordered payload for current-window and all-window views", async () => {
  const tabs = [
    {
      id: 5,
      windowId: 22,
      index: 1,
      title: "Duplicate in another window",
      url: "https://EXAMPLE.com/report?mode=full#second",
      lastAccessed: 1000,
      pinned: true,
    },
    {
      id: 4,
      windowId: 22,
      index: 0,
      title: "Settings copy",
      url: "chrome://settings/",
    },
    {
      id: 3,
      windowId: 11,
      index: 3,
      title: "Recent here",
      url: "https://recent.example/",
      lastAccessed: 900,
      audible: true,
      mutedInfo: { muted: true },
      discarded: true,
    },
    {
      id: 99,
      windowId: 11,
      index: 1,
      title: "TabScroll",
      url: "chrome-extension://tabscroll/overlay.html#standalone=1",
    },
    {
      id: 2,
      windowId: 11,
      index: 2,
      title: "Current",
      url: "https://example.com/report?mode=full#first",
      lastAccessed: 800,
    },
    {
      id: 1,
      windowId: 11,
      index: 0,
      title: "Settings",
      url: "chrome://settings/",
      lastAccessed: 100,
    },
  ];
  const { context } = loadBackground({
    tabs: {
      async query(queryInfo) {
        assert.equal(queryInfo.windowType, "normal");
        return tabs;
      },
      async captureVisibleTab() {
        return "data:image/jpeg;base64,current";
      },
    },
  });

  const payload = await context.buildOverlayPayload(tabs.find((tab) => tab.id === 2));
  const plainPayload = JSON.parse(JSON.stringify(payload));

  assert.equal(plainPayload.currentWindowId, 11);
  assert.deepEqual(
    plainPayload.tabs.map((tab) => tab.id),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    plainPayload.tabs.map((tab) => tab.windowLabel),
    ["Current Window", "Current Window", "Current Window", "Window 2", "Window 2"]
  );
  assert.equal(plainPayload.activeIndex, 1);
  assert.equal(plainPayload.recentTabId, 3);
  assert.equal(plainPayload.tabs[1].preview, "data:image/jpeg;base64,current");
  assert.equal(plainPayload.tabs[2].audible, true);
  assert.equal(plainPayload.tabs[2].muted, true);
  assert.equal(plainPayload.tabs[2].discarded, true);
  assert.equal(plainPayload.tabs[4].pinned, true);
  assert.equal(plainPayload.tabs[1].duplicate, true);
  assert.equal(plainPayload.tabs[4].duplicate, true);
  assert.equal(plainPayload.tabs[1].duplicateKey, "duplicate-1");
  assert.equal(plainPayload.tabs[4].duplicateKey, plainPayload.tabs[1].duplicateKey);
  assert.equal(plainPayload.tabs[0].duplicate, false);
  assert.equal(plainPayload.tabs[0].duplicateKey, "");
  assert.equal(plainPayload.tabs.some((tab) => tab.id === 99), false);
});

test("closes, pins, and mutes tabs through validated runtime actions", async () => {
  const removedTabIds = [];
  const updateCalls = [];
  const storedTabs = new Map([
    [
      7,
      {
        id: 7,
        windowId: 11,
        index: 2,
        title: "Target",
        url: "https://example.com/",
        pinned: false,
        audible: true,
        mutedInfo: { muted: false },
      },
    ],
  ]);
  const { dispatch } = loadBackground({
    tabs: {
      async get(tabId) {
        return storedTabs.get(tabId);
      },
      async remove(tabId) {
        removedTabIds.push(tabId);
      },
      async update(tabId, changes) {
        updateCalls.push([tabId, changes]);
        const current = storedTabs.get(tabId);
        const updated = {
          ...current,
          ...changes,
          mutedInfo:
            typeof changes.muted === "boolean"
              ? { muted: changes.muted }
              : current.mutedInfo,
        };
        storedTabs.set(tabId, updated);
        return updated;
      },
    },
  });

  const pinResponse = await dispatch({
    type: "tabscroll:toggle-pin",
    tabId: 7,
  });
  const muteResponse = await dispatch({
    type: "tabscroll:toggle-mute",
    tabId: 7,
  });
  const closeResponse = await dispatch({
    type: "tabscroll:close-tab",
    tabId: 7,
  });

  assert.equal(pinResponse.ok, true);
  assert.equal(pinResponse.tab.pinned, true);
  assert.equal(pinResponse.tab.muted, false);
  assert.equal(muteResponse.ok, true);
  assert.equal(muteResponse.tab.pinned, true);
  assert.equal(muteResponse.tab.muted, true);
  assert.deepEqual(JSON.parse(JSON.stringify(updateCalls)), [
    [7, { pinned: true }],
    [7, { muted: true }],
  ]);
  assert.deepEqual(removedTabIds, [7]);
  assert.equal(closeResponse.ok, true);
  assert.equal(Object.keys(closeResponse).length, 1);
});

test("rejects non-numeric and negative tab ids before calling Chrome", async () => {
  let apiCallCount = 0;
  const { dispatch } = loadBackground({
    tabs: {
      async get() {
        apiCallCount += 1;
      },
      async remove() {
        apiCallCount += 1;
      },
      async update() {
        apiCallCount += 1;
      },
    },
  });

  const stringIdResponse = await dispatch({
    type: "tabscroll:close-tab",
    tabId: "7",
  });
  const negativeIdResponse = await dispatch({
    type: "tabscroll:toggle-pin",
    tabId: -1,
  });

  assert.equal(stringIdResponse.ok, false);
  assert.match(stringIdResponse.error, /Invalid tab id/);
  assert.equal(negativeIdResponse.ok, false);
  assert.match(negativeIdResponse.error, /Invalid tab id/);
  assert.equal(apiCallCount, 0);
});

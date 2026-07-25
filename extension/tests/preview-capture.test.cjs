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
    debugger: {},
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

test("tries the next screenshot option when the first command fails", async () => {
  const screenshotOptions = [];
  let detachCount = 0;
  const context = loadBackground({
    debugger: {
      async attach() {},
      async detach() {
        detachCount += 1;
      },
      async sendCommand(_debuggee, command, options) {
        if (command === "Page.enable") {
          return {};
        }

        screenshotOptions.push(options);

        if (screenshotOptions.length === 1) {
          throw new Error("surface capture unavailable");
        }

        return { data: "preview-data" };
      },
    },
  });

  const preview = await context.captureTabPreviewWithDebugger(42);

  assert.equal(preview, "data:image/jpeg;base64,preview-data");
  assert.equal(screenshotOptions.length, 2);
  assert.equal(screenshotOptions[1].fromSurface, true);
  assert.equal(screenshotOptions[1].optimizeForSpeed, undefined);
  assert.equal(detachCount, 1);
});

test("retries a transient debugger attach failure", async () => {
  let attachCount = 0;
  const context = loadBackground({
    debugger: {
      async attach() {
        attachCount += 1;

        if (attachCount === 1) {
          throw new Error("target is navigating");
        }
      },
      async detach() {},
      async sendCommand(_debuggee, command) {
        return command === "Page.captureScreenshot" ? { data: "retry-data" } : {};
      },
    },
  });

  const preview = await context.captureTabPreviewWithDebugger(42);

  assert.equal(preview, "data:image/jpeg;base64,retry-data");
  assert.equal(attachCount, 2);
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

test("captures eligible tabs that are still loading", async () => {
  const messages = [];
  const context = loadBackground({
    tabs: {
      async get() {
        return {
          id: 1,
          index: 0,
          windowId: 7,
          url: "https://host.example/",
        };
      },
      async query() {
        return [
          {
            id: 1,
            index: 0,
            status: "complete",
            url: "https://host.example/",
          },
          {
            id: 2,
            index: 1,
            status: "loading",
            url: "https://loading.example/",
          },
        ];
      },
      async sendMessage(_tabId, message) {
        messages.push(message);
        return { ok: true };
      },
    },
    debugger: {
      async attach() {},
      async detach() {},
      async sendCommand(_debuggee, command) {
        return command === "Page.captureScreenshot" ? { data: "loading-data" } : {};
      },
    },
  });

  await context.captureAllPreviewsForSession(1);

  assert.deepEqual(
    messages.map((message) => message.type),
    [
      "tabscroll:preview-updated",
      "tabscroll:preview-capture-complete",
    ]
  );
  assert.equal(messages[0].tabId, 2);
});

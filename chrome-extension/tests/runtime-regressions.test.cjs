const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const extensionRoot = path.join(__dirname, "..");
const backgroundSource = fs.readFileSync(
  path.join(extensionRoot, "background.js"),
  "utf8"
);
const contentScriptSource = fs.readFileSync(
  path.join(extensionRoot, "content-script.js"),
  "utf8"
);

function loadBackground(overrides = {}) {
  let actionListener;
  let commandListener;
  let messageListener;
  const runtimeMessages = [];
  const chrome = {
    action: {
      onClicked: {
        addListener(listener) {
          actionListener = listener;
        },
      },
    },
    commands: {
      onCommand: {
        addListener(listener) {
          commandListener = listener;
        },
      },
    },
    debugger: {
      onDetach: {
        addListener() {},
      },
    },
    runtime: {
      id: "tabscroll-test",
      getURL(value) {
        return `chrome-extension://tabscroll-test/${value}`;
      },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        },
      },
      async sendMessage(message) {
        runtimeMessages.push(message);
        return { ok: true };
      },
    },
    scripting: {
      async executeScript() {},
    },
    storage: {
      session: {
        async get() {
          return {};
        },
        async set() {},
      },
    },
    tabs: {
      onRemoved: {
        addListener() {},
      },
      onUpdated: {
        addListener() {},
      },
    },
    windows: {},
  };

  for (const [area, values] of Object.entries(overrides)) {
    chrome[area] = {
      ...chrome[area],
      ...values,
    };
  }

  const context = vm.createContext({
    URL,
    chrome,
    console,
    Date,
    Map,
    Promise,
    Set,
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
      return { kind: "regular-tab", collectionName: "" };
    },
  };
  context.importScripts = () => {};

  vm.runInContext(backgroundSource, context, { filename: "background.js" });

  return {
    actionListener,
    commandListener,
    context,
    runtimeMessages,
    dispatch(message, sender = {}) {
      let responded = false;
      let responseValue;
      let resolveResponse;
      const response = new Promise((resolve) => {
        resolveResponse = resolve;
      });
      const keepsChannelOpen = messageListener(message, sender, (value) => {
        responded = true;
        responseValue = value;
        resolveResponse(value);
      });

      return {
        keepsChannelOpen,
        response,
        get responded() {
          return responded;
        },
        get responseValue() {
          return responseValue;
        },
      };
    },
  };
}

function makeTabs() {
  return [
    {
      id: 1,
      windowId: 7,
      index: 0,
      active: true,
      title: "Host",
      url: "https://host.example/",
    },
    {
      id: 2,
      windowId: 7,
      index: 1,
      title: "Near",
      url: "https://near.example/",
    },
    {
      id: 3,
      windowId: 7,
      index: 2,
      title: "Requested",
      url: "https://requested.example/",
    },
  ];
}

test("toolbar click and keyboard command use the same current overlay protocol", async () => {
  const tabs = makeTabs();
  const sentTabMessages = [];
  const harness = loadBackground({
    tabs: {
      async captureVisibleTab() {
        return "data:image/jpeg;base64,host";
      },
      async get() {
        return tabs[0];
      },
      async query(query) {
        return query?.active ? [tabs[0]] : tabs;
      },
      async sendMessage(_tabId, message) {
        sentTabMessages.push(message);

        if (message.type === "tabscroll:v2:ping") {
          return { ok: true, protocol: 2 };
        }

        return { ok: true };
      },
    },
  });

  harness.actionListener(tabs[0]);
  await new Promise((resolve) => setImmediate(resolve));
  harness.commandListener("toggle-tabscroll");
  await new Promise((resolve) => setImmediate(resolve));

  const toggles = sentTabMessages.filter((message) =>
    message.type.endsWith(":toggle-overlay")
  );

  assert.equal(toggles.length, 2);
  assert.deepEqual(
    toggles.map(({ type, protocol }) => ({ type, protocol })),
    [
      { type: "tabscroll:v2:toggle-overlay", protocol: 2 },
      { type: "tabscroll:v2:toggle-overlay", protocol: 2 },
    ]
  );
  assert.notEqual(toggles[0].sessionId, toggles[1].sessionId);
});

test("preview message keeps the service worker response open until capture completes", async () => {
  const tabs = makeTabs();
  let releaseScreenshot;
  const screenshotReady = new Promise((resolve) => {
    releaseScreenshot = resolve;
  });
  const harness = loadBackground({
    debugger: {
      onDetach: { addListener() {} },
      async attach() {},
      async detach() {},
      async sendCommand(_debuggee, command) {
        if (command === "Page.getLayoutMetrics") {
          return { cssVisualViewport: { clientWidth: 1280, clientHeight: 720 } };
        }

        await screenshotReady;
        return { data: "requested-preview" };
      },
    },
    tabs: {
      onRemoved: { addListener() {} },
      onUpdated: { addListener() {} },
      async get() {
        return tabs[0];
      },
      async query() {
        return tabs;
      },
    },
  });
  const pending = harness.dispatch({
    type: "tabscroll:request-all-previews",
    tabId: 1,
    sessionId: "session:one",
    requestId: "session:one:1",
    tabIds: [3],
  });

  assert.equal(pending.keepsChannelOpen, true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(pending.responded, false);

  releaseScreenshot();
  assert.equal((await pending.response).ok, true);
  assert.equal(pending.responded, true);
});

test("preview capture follows requested carousel tab ids and scopes updates to the session", async () => {
  const tabs = makeTabs();
  const attachedTabIds = [];
  const harness = loadBackground({
    debugger: {
      onDetach: { addListener() {} },
      async attach({ tabId }) {
        attachedTabIds.push(tabId);
      },
      async detach() {},
      async sendCommand(debuggee, command) {
        if (command === "Page.getLayoutMetrics") {
          return { cssVisualViewport: { clientWidth: 1280, clientHeight: 720 } };
        }

        return { data: `preview-${debuggee.tabId}` };
      },
    },
    tabs: {
      onRemoved: { addListener() {} },
      onUpdated: { addListener() {} },
      async get() {
        return tabs[0];
      },
      async query() {
        return tabs;
      },
    },
  });
  const captureState = {
    cancelled: false,
    sessionId: "session:two",
    requestId: "session:two:4",
  };

  await harness.context.captureAllPreviewsForSession(1, captureState, {
    tabIds: [3],
  });

  assert.equal(attachedTabIds.join(","), "3");
  const update = harness.runtimeMessages.find(
    (message) => message.type === "tabscroll:previews-updated"
  );
  const complete = harness.runtimeMessages.find(
    (message) => message.type === "tabscroll:preview-capture-complete"
  );
  assert.equal(update.sessionId, "session:two");
  assert.equal(update.requestId, "session:two:4");
  assert.equal(update.previews.map(({ tabId }) => tabId).join(","), "3");
  assert.equal(complete.sessionId, "session:two");
  assert.equal(complete.requestId, "session:two:4");
});

test("content script rejects the legacy toggle and removes a stale overlay frame", () => {
  let messageListener;
  let appendedFrame;
  let staleFrameRemoved = false;
  const staleFrame = {
    remove() {
      staleFrameRemoved = true;
    },
  };
  const document = {
    documentElement: {
      appendChild(frame) {
        appendedFrame = frame;
      },
    },
    getElementById(id) {
      return id === "tabscroll-extension-frame" ? staleFrame : null;
    },
    createElement() {
      return {
        addEventListener() {},
        contentWindow: { focus() {} },
        focus() {},
        remove() {},
        setAttribute() {},
        style: {},
      };
    },
  };
  const window = {
    addEventListener() {},
  };
  const chrome = {
    runtime: {
      getURL(value) {
        return `chrome-extension://tabscroll-test/${value}`;
      },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        },
      },
      async sendMessage() {},
    },
  };
  const context = vm.createContext({
    URL,
    chrome,
    document,
    encodeURIComponent,
    window,
  });

  vm.runInContext(contentScriptSource, context, { filename: "content-script.js" });

  let pingResponse;
  messageListener({ type: "tabscroll:v2:ping" }, {}, (value) => {
    pingResponse = value;
  });
  messageListener({ type: "tabscroll:toggle-overlay" }, {}, () => {});

  assert.equal(staleFrameRemoved, true);
  assert.equal(pingResponse.ok, true);
  assert.equal(pingResponse.protocol, 2);
  assert.equal(appendedFrame, undefined);

  messageListener(
    {
      type: "tabscroll:v2:toggle-overlay",
      protocol: 2,
      tabId: 7,
      sessionId: "session:new",
    },
    {},
    () => {}
  );

  assert.match(appendedFrame.src, /overlay\.html#tab=7&session=session%3Anew$/);
});

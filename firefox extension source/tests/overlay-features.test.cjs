const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const overlaySource = fs.readFileSync(
  path.join(__dirname, "..", "overlay.js"),
  "utf8"
);

class FakeElement {
  constructor(attributes = {}, value = "") {
    this.attributes = new Map(Object.entries(attributes));
    this.value = value;
    this.focused = false;
    this.selectionStart = value.length;
    this.selectionEnd = value.length;
  }

  closest(selector) {
    if (selector === "[data-action]" && this.attributes.has("data-action")) {
      return this;
    }

    if (selector === "[data-role='dot']" && this.getAttribute("data-role") === "dot") {
      return this;
    }

    if (selector === "[data-role='card']" && this.getAttribute("data-role") === "card") {
      return this;
    }

    if (selector === "[data-role='backdrop']" && this.getAttribute("data-role") === "backdrop") {
      return this;
    }

    return null;
  }

  focus() {
    this.focused = true;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setSelectionRange(start, end) {
    this.selection = [start, end];
    this.selectionStart = start;
    this.selectionEnd = end;
  }
}

class FakeImageElement {
  constructor({ role, tabId, src, currentSrc = src }) {
    this.dataset = {
      role,
      tabId: String(tabId),
    };
    this.src = src;
    this.currentSrc = currentSrc;
    this.removed = false;
  }

  remove() {
    this.removed = true;
  }
}

function makeTabs() {
  return [
    {
      id: 1,
      windowId: 11,
      index: 0,
      title: "Quarterly planning",
      url: "https://plans.example.com/roadmap",
      active: true,
      lastAccessed: Date.now(),
      kind: "regular-tab",
      windowLabel: "Current Window",
    },
    {
      id: 2,
      windowId: 11,
      index: 1,
      title: "Team handbook",
      url: "https://docs.example.net/guides/onboarding",
      active: false,
      lastAccessed: Date.now() - 60_000,
      kind: "regular-tab",
      windowLabel: "Current Window",
    },
    {
      id: 3,
      windowId: 11,
      index: 2,
      title: "Accounts",
      url: "https://billing.test/invoices/2026/open",
      active: false,
      lastAccessed: Date.now() - 120_000,
      kind: "regular-tab",
      windowLabel: "Current Window",
    },
    {
      id: 4,
      windowId: 22,
      index: 0,
      title: "Other-window dashboard",
      url: "https://outside.example/dashboard",
      active: false,
      lastAccessed: Date.now() - 180_000,
      kind: "regular-tab",
      windowLabel: "Window 2",
    },
  ];
}

function makeCarouselTabs(count = 6) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    windowId: 11,
    index,
    title: `Carousel tab ${index + 1}`,
    url: `https://carousel.example/tab-${index + 1}`,
    active: index === 0,
    lastAccessed: Date.now() - index * 60_000,
    kind: "regular-tab",
    windowLabel: "Current Window",
  }));
}

function createHarness(tabs = makeTabs(), options = {}) {
  const app = { innerHTML: "" };
  const documentListeners = new Map();
  const windowListeners = new Map();
  const runtimeMessages = [];
  const storedValues = new Map();
  const timers = new Map();
  let currentTime = Date.now();
  let nextTimerId = 1;
  const searchInput = new FakeElement({ "data-role": "search" });
  class HarnessDate extends Date {
    static now() {
      return currentTime;
    }
  }
  const body = {
    dataset: {},
    focus() {},
  };
  const document = {
    body,
    documentElement: {
      dataset: {},
      style: {},
    },
    addEventListener(type, listener) {
      documentListeners.set(type, listener);
    },
    getElementById(id) {
      return id === "app" ? app : null;
    },
    querySelector(selector) {
      if (selector !== "[data-role='search']") {
        return null;
      }

      const valueMatch = app.innerHTML.match(/data-role="search"[^>]*value="([^"]*)"/);
      searchInput.value = valueMatch?.[1] || "";
      return searchInput;
    },
  };
  const window = {
    innerWidth: 1280,
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    clearTimeout(timerId) {
      timers.delete(timerId);
    },
    focus() {},
    localStorage: {
      getItem(key) {
        return storedValues.get(key) || null;
      },
      setItem(key, value) {
        storedValues.set(key, value);
      },
    },
    location: {
      hash: options.locationHash || "#standalone=1",
    },
    matchMedia() {
      return {
        matches: true,
        addEventListener() {},
      };
    },
    parent: null,
    postMessage() {},
    requestAnimationFrame(callback) {
      callback();
    },
    setTimeout(callback, delay = 0) {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timers.set(timerId, {
        callback,
        dueAt: currentTime + Math.max(0, Number(delay) || 0),
      });
      return timerId;
    },
  };
  window.parent = window;

  const session = {
    currentWindowId: 11,
    activeIndex: 0,
    recentTabId: 2,
    tabs,
    ...options.session,
  };
  const chrome = {
    runtime: {
      id: "tabscroll-test",
      async sendMessage(message) {
        runtimeMessages.push({ ...message });

        if (message?.type === "tabscroll:get-session") {
          return {
            ok: true,
            payload: session,
          };
        }

        if (typeof options.respondToMessage === "function") {
          return options.respondToMessage(message);
        }

        if (message?.type === "tabscroll:toggle-pin") {
          return {
            ok: true,
            tab: {
              id: message.tabId,
              pinned: true,
            },
          };
        }

        if (message?.type === "tabscroll:toggle-mute") {
          return {
            ok: true,
            tab: {
              id: message.tabId,
              audible: true,
              muted: true,
            },
          };
        }

        return { ok: true };
      },
    },
  };

  const context = vm.createContext({
    chrome,
    Date: HarnessDate,
    Element: FakeElement,
    HTMLImageElement: FakeImageElement,
    Map,
    navigator: {
      platform: "Win32",
      userAgent: "TabScroll test",
    },
    URL,
    URLSearchParams,
    console,
    document,
    window,
  });

  vm.runInContext(overlaySource, context, {
    filename: "overlay.js",
  });

  return {
    app,
    runtimeMessages,
    advanceTime(milliseconds) {
      currentTime += milliseconds;

      while (true) {
        const dueTimer = [...timers.entries()]
          .filter(([, timer]) => timer.dueAt <= currentTime)
          .sort((left, right) => left[1].dueAt - right[1].dueAt)[0];

        if (!dueTimer) {
          break;
        }

        const [timerId, timer] = dueTimer;
        timers.delete(timerId);
        timer.callback();
      }
    },
    async ready() {
      await flushAsyncWork();
    },
    click(attributes) {
      const target = new FakeElement(attributes);
      documentListeners.get("click")({
        target,
        preventDefault() {},
        stopPropagation() {},
      });
    },
    drag(attributes, startX, endX, clientY = 400) {
      const target = new FakeElement(attributes);
      const pointerId = 7;
      documentListeners.get("pointerdown")({
        target,
        button: 0,
        pointerId,
        clientX: startX,
        clientY,
      });
      windowListeners.get("pointermove")({
        pointerId,
        clientX: endX,
        clientY,
        preventDefault() {},
      });
      windowListeners.get("pointerup")({
        pointerId,
      });
    },
    input(value, selectionStart = value.length, selectionEnd = selectionStart) {
      const target = new FakeElement({ "data-role": "search" }, value);
      target.selectionStart = selectionStart;
      target.selectionEnd = selectionEnd;
      documentListeners.get("input")({ target });
      return target;
    },
    imageError(options) {
      const target = new FakeImageElement(options);
      documentListeners.get("error")({ target });
      return target;
    },
    compositionStart(value = "") {
      const target = new FakeElement({ "data-role": "search" }, value);
      documentListeners.get("compositionstart")({ target });
      return target;
    },
    compositionInput(target, value) {
      target.value = value;
      documentListeners.get("input")({ target });
    },
    compositionEnd(target, value = target.value) {
      target.value = value;
      documentListeners.get("compositionend")({ target });
    },
    parentMessage(message) {
      windowListeners.get("message")({
        source: window.parent,
        data: message,
      });
    },
    searchSelection() {
      return searchInput.selection;
    },
    key(key, overrides = {}) {
      const event = {
        key,
        target: body,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...overrides,
      };
      windowListeners.get("keydown")(event);
      return event;
    },
  };
}

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function typeQuery(harness, query) {
  for (const character of query) {
    harness.key(character);
  }
}

function getRenderedCards(html) {
  const cardTags = html.match(/<button class="ts-card-wrap"[^>]*>/g) || [];

  return cardTags.map((tag) => ({
    index: Number(tag.match(/data-index="(\d+)"/)?.[1]),
    position: tag.match(/data-position="([^"]+)"/)?.[1] || "",
    fromPosition: tag.match(/data-from-position="([^"]+)"/)?.[1] || "",
    current: tag.match(/aria-current="([^"]+)"/)?.[1] || "",
  }));
}

test("starts with tabs in this window and clicking tabs in all windows reveals labeled external tabs", async () => {
  const allTabs = makeTabs();
  const harness = createHarness([allTabs[0], allTabs[1], allTabs[3]]);
  await harness.ready();

  assert.match(harness.app.innerHTML, /Tabs in this window/);
  assert.match(harness.app.innerHTML, /Tabs in all windows/);
  assert.match(harness.app.innerHTML, /Quarterly planning/);
  assert.match(harness.app.innerHTML, /Team handbook/);
  assert.doesNotMatch(harness.app.innerHTML, /Other-window dashboard/);
  assert.match(
    harness.app.innerHTML,
    /data-scope="current" aria-pressed="true"/
  );
  assert.match(harness.app.innerHTML, /class="ts-counter">1 \/ 2/);

  harness.click({
    "data-action": "set-scope",
    "data-scope": "all",
  });

  assert.match(harness.app.innerHTML, /Other-window dashboard/);
  assert.match(
    harness.app.innerHTML,
    /data-scope="all" aria-pressed="true"/
  );
  assert.match(
    harness.app.innerHTML,
    /ts-card-badge--window">Window 2/
  );
  assert.match(harness.app.innerHTML, /class="ts-counter">1 \/ 3/);
});

test("requests missing previews once and cancels capture when the overlay closes", async () => {
  const harness = createHarness(makeTabs(), {
    locationHash: "#tab=1",
  });
  await harness.ready();

  assert.equal(
    harness.runtimeMessages.filter(
      (message) => message.type === "tabscroll:request-all-previews"
    ).length,
    1
  );

  harness.key("Escape");

  assert.equal(
    harness.runtimeMessages.filter(
      (message) => message.type === "tabscroll:cancel-preview-capture"
    ).length,
    1
  );
});

test("circular carousel renders one previous, focused, and next card and wraps", async () => {
  const harness = createHarness(makeCarouselTabs());
  await harness.ready();

  const firstEdgeCards = getRenderedCards(harness.app.innerHTML);
  assert.equal(firstEdgeCards.length, 3);
  assert.equal(new Set(firstEdgeCards.map((card) => card.index)).size, 3);
  assert.deepEqual(
    firstEdgeCards.map((card) => card.position),
    ["left", "center", "right"]
  );
  assert.deepEqual(
    firstEdgeCards.map((card) => card.index),
    [5, 0, 1]
  );

  assert.equal(harness.key("ArrowLeft").defaultPrevented, true);

  const lastEdgeCards = getRenderedCards(harness.app.innerHTML);
  assert.equal(lastEdgeCards.length, 3);
  assert.equal(new Set(lastEdgeCards.map((card) => card.index)).size, 3);
  assert.deepEqual(
    lastEdgeCards.map((card) => card.index),
    [4, 5, 0]
  );
  assert.match(harness.app.innerHTML, /class="ts-counter">6 \/ 6/);
  assert.match(
    harness.app.innerHTML,
    /data-index="5" data-position="center" data-from-position="left"[^>]*aria-label="Carousel tab 6, Tab in focus" aria-current="true"/
  );
  assert.equal(
    lastEdgeCards.find((card) => card.position === "left")?.fromPosition,
    "off-left"
  );

  assert.equal(harness.key("ArrowRight").defaultPrevented, true);

  const wrappedFirstCards = getRenderedCards(harness.app.innerHTML);
  assert.equal(wrappedFirstCards.length, 3);
  assert.equal(new Set(wrappedFirstCards.map((card) => card.index)).size, 3);
  assert.match(harness.app.innerHTML, /class="ts-counter">1 \/ 6/);
  assert.match(
    harness.app.innerHTML,
    /data-index="0" data-position="center" data-from-position="right"[^>]*aria-label="Carousel tab 1, Tab in focus" aria-current="true"/
  );
  assert.equal(
    wrappedFirstCards.find((card) => card.position === "right")?.fromPosition,
    "off-right"
  );
});

test("clicking a side card centers that tab with position-aware motion", async () => {
  const harness = createHarness(makeCarouselTabs());
  await harness.ready();

  harness.click({
    "data-role": "card",
    "data-index": "1",
    "data-position": "right",
  });

  const cards = getRenderedCards(harness.app.innerHTML);
  assert.equal(cards.length, 3);
  assert.equal(new Set(cards.map((card) => card.index)).size, 3);
  assert.match(harness.app.innerHTML, /class="ts-counter">2 \/ 6/);
  assert.match(
    harness.app.innerHTML,
    /data-index="1" data-position="center" data-from-position="right"[^>]*aria-label="Carousel tab 2, Tab in focus" aria-current="true"/
  );
});

test("dragging the reel snaps to the next or previous tab", async () => {
  const harness = createHarness(makeCarouselTabs());
  await harness.ready();

  harness.drag(
    {
      "data-role": "card",
      "data-index": "0",
      "data-position": "center",
    },
    720,
    600
  );

  assert.match(harness.app.innerHTML, /class="ts-counter">2 \/ 6/);
  assert.match(harness.app.innerHTML, /class="ts-cards" data-motion="forward"/);

  harness.advanceTime(341);
  harness.drag(
    {
      "data-role": "card",
      "data-index": "1",
      "data-position": "center",
    },
    600,
    720
  );

  assert.match(harness.app.innerHTML, /class="ts-counter">1 \/ 6/);
  assert.match(harness.app.innerHTML, /class="ts-cards" data-motion="backward"/);
});

test("closing the selected last tab wraps selection to the former first tab", async () => {
  const harness = createHarness(makeCarouselTabs(3));
  await harness.ready();

  harness.key("ArrowLeft");
  assert.match(harness.app.innerHTML, /class="ts-counter">3 \/ 3/);
  assert.match(
    harness.app.innerHTML,
    /aria-label="Carousel tab 3, Tab in focus" aria-current="true"/
  );

  harness.key("Delete");
  await flushAsyncWork();

  assert.deepEqual(
    harness.runtimeMessages.slice(1).map(({ type, tabId }) => [type, tabId]),
    [["tabscroll:close-tab", 3]]
  );
  assert.doesNotMatch(harness.app.innerHTML, /Carousel tab 3/);
  assert.match(harness.app.innerHTML, /class="ts-counter">1 \/ 2/);
  assert.match(
    harness.app.innerHTML,
    /aria-label="Carousel tab 1, Tab in focus" aria-current="true"/
  );
});

test("two-tab carousel animates left and right with the inactive card on that side", async () => {
  const harness = createHarness(makeCarouselTabs(2));
  await harness.ready();

  harness.key("ArrowLeft");

  let cards = getRenderedCards(harness.app.innerHTML);
  assert.deepEqual(
    cards.map(({ index, position, fromPosition, current }) => ({
      index,
      position,
      fromPosition,
      current,
    })),
    [
      {
        index: 0,
        position: "left",
        fromPosition: "center",
        current: "false",
      },
      {
        index: 1,
        position: "center",
        fromPosition: "left",
        current: "true",
      },
    ]
  );
  assert.match(harness.app.innerHTML, /class="ts-counter">2 \/ 2/);

  harness.key("ArrowRight");

  cards = getRenderedCards(harness.app.innerHTML);
  assert.deepEqual(
    cards.map(({ index, position, fromPosition, current }) => ({
      index,
      position,
      fromPosition,
      current,
    })),
    [
      {
        index: 0,
        position: "center",
        fromPosition: "right",
        current: "true",
      },
      {
        index: 1,
        position: "right",
        fromPosition: "center",
        current: "false",
      },
    ]
  );
  assert.match(harness.app.innerHTML, /class="ts-counter">1 \/ 2/);
});

test("batched preview updates trigger only one deferred carousel render", async () => {
  const harness = createHarness(makeCarouselTabs(3));
  await harness.ready();

  harness.key("ArrowRight");
  const movingHtml = harness.app.innerHTML;

  harness.parentMessage({
    type: "tabscroll:previews-updated",
    previews: [
      {
        tabId: 2,
        preview: "data:image/png;base64,deferred-preview-2",
      },
      {
        tabId: 3,
        preview: "data:image/png;base64,deferred-preview-3",
      },
    ],
  });

  assert.equal(harness.app.innerHTML, movingHtml);
  assert.doesNotMatch(harness.app.innerHTML, /deferred-preview/);

  harness.advanceTime(456);

  assert.notEqual(harness.app.innerHTML, movingHtml);
  assert.match(harness.app.innerHTML, /deferred-preview-2/);
  assert.match(harness.app.innerHTML, /deferred-preview-3/);
});

test("preview errors ignore stale URLs and defer matching-preview removal during motion", async (t) => {
  await t.test("stale failed URL preserves the newer stored preview", async () => {
    const tabs = makeCarouselTabs(3);
    const stalePreview = "data:image/png;base64,stale-preview";
    const newerPreview = "data:image/png;base64,newer-preview";
    tabs[0].preview = newerPreview;
    const harness = createHarness(tabs);
    await harness.ready();

    harness.imageError({
      role: "preview",
      tabId: 1,
      src: stalePreview,
      currentSrc: stalePreview,
    });
    harness.key("ArrowRight");

    assert.match(
      harness.app.innerHTML,
      /<img src="data:image\/png;base64,newer-preview"[^>]*data-role="preview" data-tab-id="1"/
    );
  });

  await t.test("matching failure waits for carousel motion before rerendering", async () => {
    const tabs = makeCarouselTabs(3);
    const failedPreview = "data:image/png;base64,matching-preview";
    tabs[1].preview = failedPreview;
    const harness = createHarness(tabs);
    await harness.ready();

    harness.key("ArrowRight");
    const movingHtml = harness.app.innerHTML;
    assert.match(movingHtml, /matching-preview/);

    harness.imageError({
      role: "preview",
      tabId: 2,
      src: failedPreview,
      currentSrc: failedPreview,
    });

    assert.equal(harness.app.innerHTML, movingHtml);
    harness.advanceTime(439);
    assert.equal(harness.app.innerHTML, movingHtml);

    harness.advanceTime(17);
    assert.notEqual(harness.app.innerHTML, movingHtml);
    assert.doesNotMatch(harness.app.innerHTML, /matching-preview/);
    assert.match(
      harness.app.innerHTML,
      /aria-label="Carousel tab 2, Tab in focus" aria-current="true"/
    );
  });
});

test("typing immediately searches title, domain, and URL and renders no results", async (t) => {
  const cases = [
    {
      name: "title",
      query: "quarterly",
      included: "Quarterly planning",
      excluded: "Team handbook",
    },
    {
      name: "domain",
      query: "example.net",
      included: "Team handbook",
      excluded: "Quarterly planning",
    },
    {
      name: "URL",
      query: "invoices/2026",
      included: "Accounts",
      excluded: "Quarterly planning",
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const harness = createHarness();
      await harness.ready();

      const firstKey = harness.key(item.query[0]);
      for (const character of item.query.slice(1)) {
        harness.key(character);
      }

      assert.equal(firstKey.defaultPrevented, true);
      assert.match(
        harness.app.innerHTML,
        new RegExp(`value="${item.query.replace(".", "\\.")}"`, "i")
      );
      assert.match(harness.app.innerHTML, new RegExp(item.included));
      assert.doesNotMatch(harness.app.innerHTML, new RegExp(item.excluded));
      assert.match(harness.app.innerHTML, /class="ts-counter">1 \/ 1/);
    });
  }

  await t.test("no results", async () => {
    const harness = createHarness();
    await harness.ready();

    typeQuery(harness, "zzzz");

    assert.match(harness.app.innerHTML, /No matching tabs/);
    assert.match(harness.app.innerHTML, /Try another title, domain, or URL\./);
    assert.match(harness.app.innerHTML, /data-action="clear-search"/);
    assert.match(harness.app.innerHTML, /class="ts-counter">0 \/ 0/);
  });
});

test("slash enters search so P and M become query input instead of actions", async () => {
  const harness = createHarness();
  await harness.ready();

  assert.equal(harness.key("/").defaultPrevented, true);
  assert.equal(harness.key("P").defaultPrevented, true);
  assert.equal(harness.key("M").defaultPrevented, true);

  assert.match(harness.app.innerHTML, /data-role="search"[^>]*value="PM"/);
  assert.match(harness.app.innerHTML, /No matching tabs/);
  assert.deepEqual(
    harness.runtimeMessages.map((message) => message.type),
    ["tabscroll:get-session"]
  );
});

test("input rerender restores a mid-query selection range", async () => {
  const harness = createHarness();
  await harness.ready();

  harness.input("quarterly", 2, 7);

  assert.match(harness.app.innerHTML, /data-role="search"[^>]*value="quarterly"/);
  assert.deepEqual(harness.searchSelection(), [2, 7]);
  assert.match(harness.app.innerHTML, /Quarterly planning/);
});

test("a rejected activation leaves the overlay open and reports the runtime error", async () => {
  const harness = createHarness(makeTabs().slice(0, 2), {
    respondToMessage(message) {
      if (message.type === "tabscroll:activate-tab") {
        return {
          ok: false,
          error: "Chrome refused to activate the tab",
        };
      }

      return { ok: true };
    },
  });
  await harness.ready();

  harness.key("Enter");
  await flushAsyncWork();

  assert.deepEqual(
    harness.runtimeMessages.slice(1).map(({ type, tabId }) => [type, tabId]),
    [["tabscroll:activate-tab", 1]]
  );
  assert.equal(
    harness.runtimeMessages.some((message) => message.type === "tabscroll:close-standalone"),
    false
  );
  assert.match(harness.app.innerHTML, /Quarterly planning/);
  assert.match(
    harness.app.innerHTML,
    /class="ts-toast" role="status">Chrome refused to activate the tab/
  );
});

test("rapid duplicate pin shortcuts issue only one toggle while the first is pending", async () => {
  const pendingPin = createDeferred();
  let pinCallCount = 0;
  const harness = createHarness(makeTabs().slice(0, 2), {
    respondToMessage(message) {
      if (message.type !== "tabscroll:toggle-pin") {
        return { ok: true };
      }

      pinCallCount += 1;

      if (pinCallCount === 1) {
        return pendingPin.promise;
      }

      return {
        ok: true,
        tab: {
          id: message.tabId,
          pinned: false,
        },
      };
    },
  });
  await harness.ready();

  harness.key("P");
  harness.key("P");

  assert.equal(pinCallCount, 1);
  assert.equal(
    harness.runtimeMessages.filter((message) => message.type === "tabscroll:toggle-pin").length,
    1
  );

  pendingPin.resolve({
    ok: true,
    tab: {
      id: 1,
      pinned: true,
    },
  });
  await flushAsyncWork();
  assert.match(harness.app.innerHTML, /ts-card-badge--pinned">Pinned/);

  harness.key("P");
  await flushAsyncWork();
  assert.equal(pinCallCount, 2);
});

test("pin and close do not issue concurrent mutations for the same tab", async () => {
  const pendingPin = createDeferred();
  const harness = createHarness(makeTabs().slice(0, 2), {
    respondToMessage(message) {
      if (message.type === "tabscroll:toggle-pin") {
        return pendingPin.promise;
      }

      return { ok: true };
    },
  });
  await harness.ready();

  harness.key("P");
  harness.key("Delete");

  assert.deepEqual(
    harness.runtimeMessages.slice(1).map(({ type, tabId }) => [type, tabId]),
    [["tabscroll:toggle-pin", 1]]
  );

  pendingPin.resolve({
    ok: true,
    tab: {
      id: 1,
      pinned: true,
    },
  });
  await flushAsyncWork();

  harness.key("Delete");
  await flushAsyncWork();

  assert.deepEqual(
    harness.runtimeMessages.slice(1).map(({ type, tabId }) => [type, tabId]),
    [
      ["tabscroll:toggle-pin", 1],
      ["tabscroll:close-tab", 1],
    ]
  );
  assert.doesNotMatch(harness.app.innerHTML, /Quarterly planning/);
});

test("idle P, M, and Delete update the selected tab and then remove it", async () => {
  const harness = createHarness(makeTabs().slice(0, 2));
  await harness.ready();

  harness.key("P");
  await flushAsyncWork();
  assert.match(harness.app.innerHTML, /ts-card-badge--pinned">Pinned/);
  assert.match(harness.app.innerHTML, /Quarterly planning/);

  harness.key("M");
  await flushAsyncWork();
  assert.match(harness.app.innerHTML, /ts-card-badge--muted">Muted/);
  assert.match(harness.app.innerHTML, /Quarterly planning/);

  harness.key("Delete");
  await flushAsyncWork();
  assert.doesNotMatch(harness.app.innerHTML, /Quarterly planning/);
  assert.match(harness.app.innerHTML, /Team handbook/);
  assert.match(harness.app.innerHTML, /class="ts-counter">1 \/ 1/);
  assert.match(harness.app.innerHTML, /Tab in focus/);
  assert.deepEqual(
    harness.runtimeMessages.slice(1).map(({ type, tabId }) => [type, tabId]),
    [
      ["tabscroll:toggle-pin", 1],
      ["tabscroll:toggle-mute", 1],
      ["tabscroll:close-tab", 1],
    ]
  );
});

test("pending pin and mute responses preserve a newer selection", async (t) => {
  const cases = [
    {
      name: "pin",
      key: "P",
      messageType: "tabscroll:toggle-pin",
      updatedFields: {
        pinned: true,
      },
    },
    {
      name: "mute",
      key: "M",
      messageType: "tabscroll:toggle-mute",
      updatedFields: {
        audible: true,
        muted: true,
      },
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const pendingAction = createDeferred();
      const harness = createHarness(makeTabs().slice(0, 2), {
        respondToMessage(message) {
          if (message.type === item.messageType) {
            return pendingAction.promise;
          }

          return { ok: true };
        },
      });
      await harness.ready();

      harness.key(item.key);
      harness.key("ArrowRight");
      assert.match(
        harness.app.innerHTML,
        /aria-label="Team handbook, Tab in focus" aria-current="true"/
      );

      pendingAction.resolve({
        ok: true,
        tab: {
          id: 1,
          ...item.updatedFields,
        },
      });
      await flushAsyncWork();

      assert.match(
        harness.app.innerHTML,
        /aria-label="Team handbook, Tab in focus" aria-current="true"/
      );
      assert.match(harness.app.innerHTML, /class="ts-counter">2 \/ 2/);
    });
  }
});

test("a pending close preserves a newer selection when it resolves", async () => {
  const pendingClose = createDeferred();
  const harness = createHarness(makeTabs().slice(0, 2), {
    respondToMessage(message) {
      if (message.type === "tabscroll:close-tab") {
        return pendingClose.promise;
      }

      return { ok: true };
    },
  });
  await harness.ready();

  harness.key("Delete");
  harness.key("ArrowRight");
  assert.match(
    harness.app.innerHTML,
    /aria-label="Team handbook, Tab in focus" aria-current="true"/
  );

  pendingClose.resolve({ ok: true });
  await flushAsyncWork();

  assert.doesNotMatch(harness.app.innerHTML, /Quarterly planning/);
  assert.match(
    harness.app.innerHTML,
    /aria-label="Team handbook, Tab in focus" aria-current="true"/
  );
  assert.match(harness.app.innerHTML, /class="ts-counter">1 \/ 1/);
});

test("composition input waits for compositionend before rerendering search results", async () => {
  const tabs = [
    {
      id: 20,
      windowId: 11,
      index: 0,
      title: "計画 dashboard",
      url: "https://plans.example/",
      active: true,
      kind: "regular-tab",
      windowLabel: "Current Window",
    },
  ];
  const harness = createHarness(tabs);
  await harness.ready();
  const initialHtml = harness.app.innerHTML;
  const compositionTarget = harness.compositionStart();

  harness.compositionInput(compositionTarget, "計");

  assert.equal(harness.app.innerHTML, initialHtml);
  assert.doesNotMatch(harness.app.innerHTML, /value="計"/);

  harness.compositionEnd(compositionTarget);

  assert.notEqual(harness.app.innerHTML, initialHtml);
  assert.match(harness.app.innerHTML, /data-role="search"[^>]*value="計"/);
  assert.match(harness.app.innerHTML, /計画 dashboard/);
  assert.match(harness.app.innerHTML, /class="ts-counter">1 \/ 1/);
});

test("composing Enter and Arrow keydowns neither activate nor navigate", async () => {
  const harness = createHarness(makeTabs().slice(0, 2));
  await harness.ready();
  const compositionTarget = harness.compositionStart();

  const enterEvent = harness.key("Enter", {
    target: compositionTarget,
    isComposing: true,
  });
  const arrowEvent = harness.key("ArrowRight", {
    target: compositionTarget,
    isComposing: true,
  });

  assert.equal(enterEvent.defaultPrevented, false);
  assert.equal(arrowEvent.defaultPrevented, false);
  assert.equal(
    harness.runtimeMessages.some((message) => message.type === "tabscroll:activate-tab"),
    false
  );

  harness.compositionEnd(compositionTarget);

  assert.match(
    harness.app.innerHTML,
    /aria-label="Quarterly planning, Tab in focus" aria-current="true"/
  );
  assert.match(harness.app.innerHTML, /class="ts-counter">1 \/ 2/);
});

test("renders duplicate, pinned, playing-audio, muted, and discarded badges", async () => {
  const tabs = [
    {
      id: 10,
      windowId: 11,
      index: 0,
      title: "Live report",
      url: "https://example.com/report#live",
      active: true,
      kind: "regular-tab",
      duplicateKey: "https://example.com/report",
      pinned: true,
      audible: true,
      muted: false,
      discarded: true,
      windowLabel: "Current Window",
    },
    {
      id: 11,
      windowId: 11,
      index: 1,
      title: "Muted report",
      url: "https://example.com/report#muted",
      active: false,
      kind: "regular-tab",
      duplicateKey: "https://example.com/report",
      audible: true,
      muted: true,
      windowLabel: "Current Window",
    },
  ];
  const harness = createHarness(tabs);
  await harness.ready();

  const expectedBadges = [
    ["duplicate", "Duplicate"],
    ["pinned", "Pinned"],
    ["audio", "Audio"],
    ["muted", "Muted"],
    ["discarded", "Sleeping"],
  ];

  for (const [kind, label] of expectedBadges) {
    assert.match(
      harness.app.innerHTML,
      new RegExp(`ts-card-badge--${kind}">${label}`)
    );
  }

  assert.match(
    harness.app.innerHTML,
    /aria-label="Live report, Duplicate, Pinned, Audio, Sleeping, Tab in focus" aria-current="true"/
  );
  assert.match(
    harness.app.innerHTML,
    /aria-label="Muted report, Duplicate, Muted" aria-current="false"/
  );
});

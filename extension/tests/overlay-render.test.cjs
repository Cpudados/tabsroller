const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const overlaySource = fs.readFileSync(
  path.join(__dirname, "..", "overlay.js"),
  "utf8"
);

test("renders the recent-tab jump-back suggestion", async () => {
  const app = { innerHTML: "" };
  const backdropStates = [];
  const listeners = new Map();
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
      listeners.set(type, listener);
    },
    getElementById(id) {
      return id === "app" ? app : null;
    },
  };
  const localStorage = new Map();
  const window = {
    TabScrollBackdrop: {
      setState(value) {
        backdropStates.push(value);
      },
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    clearTimeout() {},
    focus() {},
    localStorage: {
      getItem(key) {
        return localStorage.get(key) || null;
      },
      setItem(key, value) {
        localStorage.set(key, value);
      },
    },
    location: {
      hash: "",
    },
    matchMedia() {
      return {
        matches: true,
        addEventListener() {},
      };
    },
    parent: null,
    requestAnimationFrame(callback) {
      callback();
    },
    setTimeout() {
      return 1;
    },
  };
  window.parent = window;

  const context = vm.createContext({
    chrome: {
      runtime: {
        id: "tabscroll-test",
        async sendMessage(message) {
          if (message?.type === "tabscroll:get-session") {
            return {
              ok: true,
              payload: {
                activeIndex: 0,
                recentTabId: 2,
                tabs: [
                  {
                    id: 1,
                    title: "Current tab",
                    url: "https://current.example/",
                    active: true,
                    lastAccessed: Date.now(),
                    kind: "regular-tab",
                  },
                  {
                    id: 2,
                    title: "Quarterly planning",
                    url: "https://recent.example/",
                    active: false,
                    lastAccessed: Date.now() - 4 * 60 * 1000,
                    kind: "regular-tab",
                  },
                ],
              },
            };
          }

          return { ok: true };
        },
      },
    },
    Date,
    Element: class Element {},
    HTMLImageElement: class HTMLImageElement {},
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

  await new Promise((resolve) => setImmediate(resolve));

  assert.match(app.innerHTML, /class="ts-recent"/);
  assert.match(app.innerHTML, /Quarterly planning/);
  assert.match(app.innerHTML, /Active 4m ago/);
  assert.match(app.innerHTML, /data-action="activate-recent"/);
  assert.deepEqual(JSON.parse(JSON.stringify(backdropStates.at(-1))), {
    activeIndex: 0,
    totalTabs: 2,
    theme: "night",
    loading: false,
  });
});

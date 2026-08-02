const assert = require("node:assert/strict");
const test = require("node:test");
const {
  REGULAR_TAB_KIND,
  TAB_COLLECTION_KIND,
  classifyTab,
} = require("../tab-classifier.js");

test("detects OneTab by its extension id", () => {
  assert.deepEqual(
    classifyTab({
      title: "Unexpected localized title",
      url: "chrome-extension://chphlpgkkbolifaimnlloiipkdnihall/onetab.html",
    }),
    {
      kind: TAB_COLLECTION_KIND,
      collectionName: "OneTab",
    }
  );
});

test("detects OneTab-compatible pages by title and path", () => {
  assert.deepEqual(
    classifyTab({
      title: "OneTab",
      url: "moz-extension://generated-id/onetab.html",
    }),
    {
      kind: TAB_COLLECTION_KIND,
      collectionName: "OneTab",
    }
  );
});

test("detects generic extension-based tab stash managers", () => {
  assert.deepEqual(
    classifyTab({
      title: "My Saved Tabs",
      url: "chrome-extension://example-extension-id/tab-manager.html",
    }),
    {
      kind: TAB_COLLECTION_KIND,
      collectionName: "My Saved Tabs",
    }
  );
});

test("does not classify ordinary extension pages as collections", () => {
  assert.deepEqual(
    classifyTab({
      title: "Extensions",
      url: "chrome-extension://example-extension-id/options.html",
    }),
    {
      kind: REGULAR_TAB_KIND,
      collectionName: "",
    }
  );
});

test("does not classify regular websites from title keywords alone", () => {
  assert.deepEqual(
    classifyTab({
      title: "Saved tabs and session manager",
      url: "https://example.com/article",
    }),
    {
      kind: REGULAR_TAB_KIND,
      collectionName: "",
    }
  );
});

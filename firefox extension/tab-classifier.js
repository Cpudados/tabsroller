(function (root, factory) {
  const classifier = factory();

  root.TabScrollTabClassifier = classifier;

  if (typeof module === "object" && module.exports) {
    module.exports = classifier;
  }
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  const TAB_COLLECTION_KIND = "tab-collection";
  const REGULAR_TAB_KIND = "tab";
  const ONE_TAB_EXTENSION_ID = "chphlpgkkbolifaimnlloiipkdnihall";
  const EXTENSION_PROTOCOLS = new Set([
    "chrome-extension:",
    "edge-extension:",
    "moz-extension:",
  ]);
  const COLLECTION_SIGNATURES = [
    {
      name: "OneTab",
      pattern: /\bone[\s_-]*tab\b/i,
    },
    {
      name: "Session Buddy",
      pattern: /\bsession[\s_-]*buddy\b/i,
    },
    {
      name: "Tab Session Manager",
      pattern: /\btab[\s_-]*session[\s_-]*manager\b/i,
    },
    {
      name: "Tab Stash",
      pattern: /\btab[\s_-]*stash\b/i,
    },
    {
      name: "Workona",
      pattern: /\bworkona\b/i,
    },
  ];
  const GENERIC_TAB_PATTERN = /\btabs?\b/i;
  const GENERIC_COLLECTION_PATTERN =
    /\b(collection|manager|saved|session|stash|stashed|suspend|suspended)\b/i;

  function classifyTab(tab) {
    const title = typeof tab?.title === "string" ? tab.title.trim() : "";
    const url = getTabUrl(tab);
    const parsedUrl = parseUrl(url);

    if (!parsedUrl || !EXTENSION_PROTOCOLS.has(parsedUrl.protocol)) {
      return {
        kind: REGULAR_TAB_KIND,
        collectionName: "",
      };
    }

    if (parsedUrl.hostname === ONE_TAB_EXTENSION_ID) {
      return createCollectionClassification("OneTab");
    }

    const searchableText = normalizeSearchableText(
      [title, parsedUrl.hostname, parsedUrl.pathname, parsedUrl.search].join(" ")
    );
    const signature = COLLECTION_SIGNATURES.find(({ pattern }) => pattern.test(searchableText));

    if (signature) {
      return createCollectionClassification(signature.name);
    }

    if (
      GENERIC_TAB_PATTERN.test(searchableText) &&
      GENERIC_COLLECTION_PATTERN.test(searchableText)
    ) {
      return createCollectionClassification(getCollectionName(title));
    }

    return {
      kind: REGULAR_TAB_KIND,
      collectionName: "",
    };
  }

  function createCollectionClassification(name) {
    return {
      kind: TAB_COLLECTION_KIND,
      collectionName: name || "Tab collection",
    };
  }

  function getCollectionName(title) {
    if (!title || title.length > 80) {
      return "Tab collection";
    }

    return title;
  }

  function getTabUrl(tab) {
    if (typeof tab?.url === "string" && tab.url) {
      return tab.url;
    }

    return typeof tab?.pendingUrl === "string" ? tab.pendingUrl : "";
  }

  function parseUrl(value) {
    try {
      return new URL(value);
    } catch (_error) {
      return null;
    }
  }

  function normalizeSearchableText(value) {
    try {
      return decodeURIComponent(value).replace(/[./]+/g, " ");
    } catch (_error) {
      return value.replace(/[./]+/g, " ");
    }
  }

  return {
    REGULAR_TAB_KIND,
    TAB_COLLECTION_KIND,
    classifyTab,
  };
});

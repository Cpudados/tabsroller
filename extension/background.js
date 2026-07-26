importScripts("tab-classifier.js");

const {
  TAB_COLLECTION_KIND,
  classifyTab,
} = globalThis.TabScrollTabClassifier;
const TOGGLE_MESSAGE = "tabscroll:toggle-overlay";
const ACTIVATE_MESSAGE = "tabscroll:activate-tab";
const CLOSE_STANDALONE_MESSAGE = "tabscroll:close-standalone";
const GET_SESSION_MESSAGE = "tabscroll:get-session";
const REQUEST_ALL_PREVIEWS_MESSAGE = "tabscroll:request-all-previews";
const PREVIEW_UPDATED_MESSAGE = "tabscroll:preview-updated";
const PREVIEW_CAPTURE_COMPLETE_MESSAGE = "tabscroll:preview-capture-complete";
const DEBUGGER_PROTOCOL_VERSION = "1.3";
const PREVIEW_FORMAT = "jpeg";
const PREVIEW_QUALITY = 65;
const MAX_BACKGROUND_PREVIEWS = 24;
const VISIBLE_PREVIEW_ATTEMPTS = 2;
const VISIBLE_PREVIEW_RETRY_DELAY_MS = 600;
const DEBUGGER_CAPTURE_ATTEMPTS = 2;
const DEBUGGER_CAPTURE_RETRY_DELAY_MS = 250;
const SCREENSHOT_CAPTURE_OPTIONS = [
  { fromSurface: true, optimizeForSpeed: true },
  { fromSurface: true },
  { fromSurface: false },
];
const MAX_TITLE_LENGTH = 512;
const MAX_URL_LENGTH = 8192;
const MAX_FAVICON_LENGTH = 4096;
const pendingSessions = new Map();
const activePreviewCaptures = new Map();

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) {
    return;
  }

  void openTabScroll(tab.id);
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-tabscroll") {
    return;
  }

  void openForActiveTab();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === ACTIVATE_MESSAGE) {
    void activateTab(message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  if (message?.type === CLOSE_STANDALONE_MESSAGE) {
    void closeStandaloneTab(sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  if (message?.type === GET_SESSION_MESSAGE) {
    void getSessionForSender(sender, message.tabId)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  if (message?.type === REQUEST_ALL_PREVIEWS_MESSAGE) {
    void requestAllPreviewsForSession(sender, message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }
});

async function openForActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  if (!activeTab?.id) {
    return;
  }

  await openTabScroll(activeTab.id);
}

async function openTabScroll(tabId) {
  let hostTab;

  try {
    hostTab = await chrome.tabs.get(tabId);

    if (typeof hostTab?.windowId !== "number") {
      return;
    }

    await ensureContentScript(tabId);

    // Start gathering the session before opening, but do not make the user wait
    // for a large tab query or screenshot before showing the loading view.
    prepareSession(hostTab);

    await safeSendMessage(tabId, {
      type: TOGGLE_MESSAGE,
      tabId,
    });
  } catch (error) {
    console.info("TabScroll is using its standalone view for this page.", error);

    try {
      hostTab = hostTab || (await chrome.tabs.get(tabId));
      prepareSession(hostTab);
      await openStandaloneOverlay(hostTab);
    } catch (fallbackError) {
      pendingSessions.delete(tabId);
      console.warn("TabScroll could not open.", fallbackError);
    }
  }
}

async function getSessionForSender(sender, explicitTabId) {
  const tabId =
    typeof explicitTabId === "number"
      ? explicitTabId
      : sender.tab?.id;

  if (typeof tabId !== "number") {
    throw new Error("TabScroll session is only available inside a browser tab");
  }

  const cached = pendingSessions.get(tabId);

  if (cached) {
    pendingSessions.delete(tabId);
    return await cached;
  }

  const tab = await chrome.tabs.get(tabId);
  return buildOverlayPayload(tab);
}

async function buildOverlayPayload(hostTab) {
  const hostClassification = classifyTab(hostTab);
  const [windowTabs, activePreview] = await Promise.all([
    chrome.tabs.query({ windowId: hostTab.windowId }),
    hostClassification.kind === TAB_COLLECTION_KIND
      ? Promise.resolve("")
      : captureVisiblePreview(hostTab.windowId),
  ]);

  const sortedTabs = windowTabs
    .filter((tab) => typeof tab.id === "number" && !isTabScrollPage(tab.url || tab.pendingUrl || ""))
    .sort((left, right) => left.index - right.index);

  const activeIndex = Math.max(
    sortedTabs.findIndex((tab) => tab.id === hostTab.id),
    0
  );
  const recentTab = sortedTabs
    .filter((tab) => tab.id !== hostTab.id && Number.isFinite(tab.lastAccessed))
    .sort((left, right) => right.lastAccessed - left.lastAccessed)[0];

  return {
    activeIndex,
    recentTabId: typeof recentTab?.id === "number" ? recentTab.id : null,
    tabs: sortedTabs.map((tab) => {
      const classification = classifyTab(tab);
      const isCollection = classification.kind === TAB_COLLECTION_KIND;

      return {
        id: tab.id,
        title: truncateText(tab.title || "Untitled tab", MAX_TITLE_LENGTH),
        url: truncateText(tab.url || tab.pendingUrl || "", MAX_URL_LENGTH),
        favicon: isCollection ? "" : normalizeFavicon(tab.favIconUrl),
        preview: !isCollection && tab.id === hostTab.id ? activePreview : "",
        active: tab.id === hostTab.id,
        lastAccessed: Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : null,
        kind: classification.kind,
        collectionName: truncateText(classification.collectionName, MAX_TITLE_LENGTH),
      };
    }),
  };
}

function prepareSession(hostTab) {
  if (!hostTab || typeof hostTab.id !== "number") {
    return;
  }

  const session = buildOverlayPayload(hostTab).catch((error) => {
    if (pendingSessions.get(hostTab.id) === session) {
      pendingSessions.delete(hostTab.id);
    }

    throw error;
  });

  pendingSessions.set(hostTab.id, session);
}

async function openStandaloneOverlay(hostTab) {
  if (typeof hostTab?.id !== "number" || typeof hostTab.windowId !== "number") {
    throw new Error("Missing host tab for standalone view");
  }

  const url = chrome.runtime.getURL(
    `overlay.html#tab=${encodeURIComponent(String(hostTab.id))}&standalone=1`
  );

  await chrome.tabs.create({
    windowId: hostTab.windowId,
    index: hostTab.index + 1,
    active: true,
    url,
  });
}

async function closeStandaloneTab(sender) {
  const tabId = sender.tab?.id;

  if (typeof tabId !== "number" || !isTabScrollPage(sender.tab?.url || "")) {
    throw new Error("TabScroll can only close its own standalone tab");
  }

  await chrome.tabs.remove(tabId);
}

async function ensureContentScript(tabId) {
  try {
    await safeSendMessage(tabId, { type: "tabscroll:ping" });
    return;
  } catch (_error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"],
    });
  }
}

async function activateTab(tabId) {
  if (typeof tabId !== "number") {
    throw new Error("Missing tab id");
  }

  const targetTab = await chrome.tabs.get(tabId);
  await chrome.windows.update(targetTab.windowId, { focused: true });
  await chrome.tabs.update(tabId, { active: true });
}

async function captureVisiblePreview(windowId) {
  for (let attempt = 0; attempt < VISIBLE_PREVIEW_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await wait(VISIBLE_PREVIEW_RETRY_DELAY_MS);
    }

    try {
      const preview = await chrome.tabs.captureVisibleTab(windowId, {
        format: PREVIEW_FORMAT,
        quality: PREVIEW_QUALITY,
      });

      if (preview) {
        return preview;
      }
    } catch (_error) {
      continue;
    }
  }

  return "";
}

async function safeSendMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

async function requestAllPreviewsForSession(sender, explicitTabId) {
  const sessionTabId =
    typeof explicitTabId === "number"
      ? explicitTabId
      : sender.tab?.id;

  if (typeof sessionTabId !== "number") {
    throw new Error("Missing session tab id");
  }

  if (activePreviewCaptures.has(sessionTabId)) {
    return;
  }

  const task = captureAllPreviewsForSession(sessionTabId)
    .catch((error) => {
      console.warn("TabScroll preview capture failed.", error);
    })
    .finally(() => {
      activePreviewCaptures.delete(sessionTabId);
    });

  activePreviewCaptures.set(sessionTabId, task);
}

async function captureAllPreviewsForSession(sessionTabId) {
  try {
    const hostTab = await chrome.tabs.get(sessionTabId);
    const windowTabs = await chrome.tabs.query({ windowId: hostTab.windowId });
    const sortedTabs = windowTabs
      .filter((tab) => typeof tab.id === "number")
      .sort((left, right) => left.index - right.index);
    const hostIndex = Math.max(
      sortedTabs.findIndex((tab) => tab.id === hostTab.id),
      0
    );
    const previewTabs = sortedTabs
      .filter((tab) => {
        if (tab.id === hostTab.id || tab.discarded) {
          return false;
        }

        return isPreviewCandidateUrl(tab.url || tab.pendingUrl || "");
      })
      .sort((left, right) => {
        const leftDistance = Math.abs(left.index - hostIndex);
        const rightDistance = Math.abs(right.index - hostIndex);
        return leftDistance - rightDistance;
      })
      .slice(0, MAX_BACKGROUND_PREVIEWS);

    for (const tab of previewTabs) {
      const preview = await captureTabPreviewWithDebugger(tab.id);

      if (preview) {
        await notifyPreviewUpdated(sessionTabId, tab.id, preview);
      }
    }
  } finally {
    await notifyPreviewCaptureComplete(sessionTabId);
  }
}

function isPreviewCandidateUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function isTabScrollPage(value) {
  return typeof value === "string" && value.startsWith(chrome.runtime.getURL("overlay.html"));
}

function normalizeFavicon(value) {
  if (typeof value !== "string" || value.length > MAX_FAVICON_LENGTH) {
    return "";
  }

  try {
    const parsed = new URL(value);

    if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "data:") {
      return value;
    }

    if (parsed.protocol === "chrome-extension:" && parsed.hostname === chrome.runtime.id) {
      return value;
    }
  } catch (_error) {
    return "";
  }

  return "";
}

function truncateText(value, maxLength) {
  const text = typeof value === "string" ? value : "";
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

async function notifyPreviewUpdated(sessionTabId, tabId, preview) {
  if (typeof sessionTabId !== "number" || typeof tabId !== "number" || !preview) {
    return;
  }

  try {
    await safeSendMessage(sessionTabId, {
      type: PREVIEW_UPDATED_MESSAGE,
      tabId,
      preview,
    });
  } catch (_error) {
    // The overlay may have closed before the preview finished warming.
  }
}

async function notifyPreviewCaptureComplete(sessionTabId) {
  if (typeof sessionTabId !== "number") {
    return;
  }

  try {
    await safeSendMessage(sessionTabId, {
      type: PREVIEW_CAPTURE_COMPLETE_MESSAGE,
    });
  } catch (_error) {
    // The overlay may have closed before capture completed.
  }
}

async function captureTabPreviewWithDebugger(tabId) {
  for (let attempt = 0; attempt < DEBUGGER_CAPTURE_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await wait(DEBUGGER_CAPTURE_RETRY_DELAY_MS);
    }

    const preview = await captureTabPreviewAttemptWithDebugger(tabId);

    if (preview) {
      return preview;
    }
  }

  return "";
}

async function captureTabPreviewAttemptWithDebugger(tabId) {
  const debuggee = { tabId };

  try {
    await chrome.debugger.attach(debuggee, DEBUGGER_PROTOCOL_VERSION);
  } catch (_error) {
    return "";
  }

  try {
    try {
      await chrome.debugger.sendCommand(debuggee, "Page.enable");
    } catch (_error) {
      // Some pages do not need explicit Page.enable before capture.
    }

    for (const options of SCREENSHOT_CAPTURE_OPTIONS) {
      try {
        const result = await chrome.debugger.sendCommand(debuggee, "Page.captureScreenshot", {
          format: PREVIEW_FORMAT,
          quality: PREVIEW_QUALITY,
          ...options,
        });
        const data = typeof result?.data === "string" ? result.data : "";

        if (data) {
          return `data:image/${PREVIEW_FORMAT};base64,${data}`;
        }
      } catch (_error) {
        continue;
      }
    }

    return "";
  } catch (_error) {
    return "";
  } finally {
    try {
      await chrome.debugger.detach(debuggee);
    } catch (_error) {
      // Ignore detach failures caused by closed tabs or canceled sessions.
    }
  }
}

function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

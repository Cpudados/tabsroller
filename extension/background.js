const TOGGLE_MESSAGE = "tabscroll:toggle-overlay";
const ACTIVATE_MESSAGE = "tabscroll:activate-tab";
const GET_SESSION_MESSAGE = "tabscroll:get-session";
const REQUEST_ALL_PREVIEWS_MESSAGE = "tabscroll:request-all-previews";
const PREVIEW_UPDATED_MESSAGE = "tabscroll:preview-updated";
const PREVIEW_CAPTURE_COMPLETE_MESSAGE = "tabscroll:preview-capture-complete";
const DEBUGGER_PROTOCOL_VERSION = "1.3";
const PREVIEW_FORMAT = "jpeg";
const PREVIEW_QUALITY = 65;
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
  try {
    const hostTab = await chrome.tabs.get(tabId);

    if (typeof hostTab?.windowId !== "number") {
      return;
    }

    await ensureContentScript(tabId);

    const payload = await buildOverlayPayload(hostTab);
    pendingSessions.set(tabId, payload);

    await safeSendMessage(tabId, {
      type: TOGGLE_MESSAGE,
      tabId,
    });
  } catch (error) {
    pendingSessions.delete(tabId);
    console.warn("TabScroll could not open on this page.", error);
  }
}

async function getSessionForSender(sender, explicitTabId) {
  const tabId = sender.tab?.id ?? (typeof explicitTabId === "number" ? explicitTabId : undefined);

  if (typeof tabId !== "number") {
    throw new Error("TabScroll session is only available inside a browser tab");
  }

  const cached = pendingSessions.get(tabId);

  if (cached) {
    pendingSessions.delete(tabId);
    return cached;
  }

  const tab = await chrome.tabs.get(tabId);
  return buildOverlayPayload(tab);
}

async function buildOverlayPayload(hostTab) {
  const windowTabs = await chrome.tabs.query({ windowId: hostTab.windowId });

  const sortedTabs = windowTabs
    .filter((tab) => typeof tab.id === "number")
    .sort((left, right) => left.index - right.index);

  const activeIndex = Math.max(
    sortedTabs.findIndex((tab) => tab.id === hostTab.id),
    0
  );

  const activePreview = await captureVisiblePreview(hostTab.windowId);

  return {
    activeIndex,
    tabs: sortedTabs.map((tab) => ({
      id: tab.id,
      title: tab.title || "Untitled tab",
      url: tab.url || tab.pendingUrl || "",
      favicon: tab.favIconUrl || "",
      preview: tab.id === hostTab.id ? activePreview : "",
      active: tab.active === true,
    })),
  };
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
  try {
    return await chrome.tabs.captureVisibleTab(windowId, {
      format: PREVIEW_FORMAT,
      quality: PREVIEW_QUALITY,
    });
  } catch (_error) {
    return "";
  }
}

async function safeSendMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

async function requestAllPreviewsForSession(sender, explicitTabId) {
  const sessionTabId = sender.tab?.id ?? (typeof explicitTabId === "number" ? explicitTabId : undefined);

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

    for (const tab of sortedTabs) {
      if (tab.id === hostTab.id) {
        continue;
      }

      if (tab.discarded || tab.status === "loading") {
        continue;
      }

      const preview = await captureTabPreviewWithDebugger(tab.id);

      if (preview) {
        await notifyPreviewUpdated(sessionTabId, tab.id, preview);
      }
    }
  } finally {
    await notifyPreviewCaptureComplete(sessionTabId);
  }
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

    for (const options of [
      { fromSurface: true, optimizeForSpeed: true },
      { fromSurface: false, optimizeForSpeed: true },
    ]) {
      const result = await chrome.debugger.sendCommand(debuggee, "Page.captureScreenshot", {
        format: PREVIEW_FORMAT,
        quality: PREVIEW_QUALITY,
        ...options,
      });
      const data = typeof result?.data === "string" ? result.data : "";

      if (data) {
        return `data:image/${PREVIEW_FORMAT};base64,${data}`;
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

const TOGGLE_MESSAGE = "tabscroll:toggle-overlay";
const ACTIVATE_MESSAGE = "tabscroll:activate-tab";
const GET_SESSION_MESSAGE = "tabscroll:get-session";
const PREVIEW_FORMAT = "jpeg";
const PREVIEW_QUALITY = 65;
const pendingSessions = new Map();

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
  const [windowTabs, activePreview, detailsAccess] = await Promise.all([
    chrome.tabs.query({ windowId: hostTab.windowId }),
    captureVisiblePreview(hostTab.windowId),
    chrome.permissions.contains({ permissions: ["tabs"] }),
  ]);

  const sortedTabs = windowTabs
    .filter((tab) => typeof tab.id === "number")
    .sort((left, right) => left.index - right.index);

  const activeIndex = Math.max(
    sortedTabs.findIndex((tab) => tab.id === hostTab.id),
    0
  );

  return {
    activeIndex,
    detailsAccess,
    tabs: sortedTabs.map((tab, index) => {
      const isHostTab = tab.id === hostTab.id;
      const title = tab.title || (isHostTab ? hostTab.title : "");
      const url = tab.url || tab.pendingUrl || (isHostTab ? hostTab.url || hostTab.pendingUrl : "");
      const favicon = tab.favIconUrl || (isHostTab ? hostTab.favIconUrl : "");

      return {
        id: tab.id,
        title: title || (detailsAccess ? "Untitled tab" : `Tab ${index + 1}`),
        url: url || "",
        favicon: favicon || "",
        preview: isHostTab ? activePreview : "",
        active: tab.active === true,
        detailsAvailable: detailsAccess || Boolean(isHostTab && (title || url || favicon)),
      };
    }),
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

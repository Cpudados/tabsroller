importScripts("tab-classifier.js");

const {
  TAB_COLLECTION_KIND,
  classifyTab,
} = globalThis.TabScrollTabClassifier;
const CONTENT_SCRIPT_PROTOCOL = 2;
const PING_MESSAGE = `tabscroll:v${CONTENT_SCRIPT_PROTOCOL}:ping`;
const TOGGLE_MESSAGE = `tabscroll:v${CONTENT_SCRIPT_PROTOCOL}:toggle-overlay`;
const ACTIVATE_MESSAGE = "tabscroll:activate-tab";
const CLOSE_TAB_MESSAGE = "tabscroll:close-tab";
const TOGGLE_PIN_MESSAGE = "tabscroll:toggle-pin";
const TOGGLE_MUTE_MESSAGE = "tabscroll:toggle-mute";
const CLOSE_STANDALONE_MESSAGE = "tabscroll:close-standalone";
const GET_SESSION_MESSAGE = "tabscroll:get-session";
const REQUEST_ALL_PREVIEWS_MESSAGE = "tabscroll:request-all-previews";
const CANCEL_PREVIEW_CAPTURE_MESSAGE = "tabscroll:cancel-preview-capture";
const PREVIEWS_UPDATED_MESSAGE = "tabscroll:previews-updated";
const PREVIEW_CAPTURE_COMPLETE_MESSAGE = "tabscroll:preview-capture-complete";
const SET_LANGUAGE_MESSAGE = "tabscroll:set-language";
const LANGUAGE_STORAGE_KEY = "tabscroll:language";
const ACTION_TITLES = {
  en: "Open TabScroll",
  "pt-BR": "Abrir o TabScroll",
  es: "Abrir TabScroll",
  fr: "Ouvrir TabScroll",
  de: "TabScroll öffnen",
  tr: "TabScroll'u aç",
};
const DEBUGGER_PROTOCOL_VERSION = "1.3";
const PREVIEW_FORMAT = "jpeg";
const PREVIEW_QUALITY = 65;
const BACKGROUND_PREVIEW_QUALITY = 60;
const BACKGROUND_PREVIEW_MAX_WIDTH = 800;
const BACKGROUND_PREVIEW_MAX_HEIGHT = 500;
const MAX_BACKGROUND_PREVIEWS = 24;
const BACKGROUND_PREVIEW_CONCURRENCY = 2;
const PREVIEW_UPDATE_BATCH_SIZE = 2;
const PREVIEW_CACHE_STORAGE_KEY = "tabscroll:preview-cache";
const PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_PREVIEW_CACHE_ENTRIES = 32;
const VISIBLE_PREVIEW_ATTEMPTS = 2;
const VISIBLE_PREVIEW_RETRY_DELAY_MS = 600;
const DEBUGGER_CAPTURE_ATTEMPTS = 2;
const DEBUGGER_CAPTURE_RETRY_DELAY_MS = 120;
const MAX_TITLE_LENGTH = 512;
const MAX_URL_LENGTH = 8192;
const MAX_FAVICON_LENGTH = 4096;
const pendingSessions = new Map();
const activePreviewCaptures = new Map();
const previewCache = new Map();
let previewCacheLoadPromise = null;
let previewCachePersistPromise = Promise.resolve();
let sessionSequence = 0;

void restoreActionLanguage();

chrome.tabs.onUpdated?.addListener?.((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "loading") {
    invalidateCachedPreview(tabId);
  }
});

chrome.tabs.onRemoved?.addListener?.((tabId) => {
  invalidateCachedPreview(tabId);
});

chrome.debugger?.onDetach?.addListener?.((_source, reason) => {
  if (reason !== "canceled_by_user") {
    return;
  }

  for (const captureState of activePreviewCaptures.values()) {
    captureState.cancelled = true;
  }
});

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

  if (message?.type === CLOSE_TAB_MESSAGE) {
    void closeTab(message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  if (message?.type === TOGGLE_PIN_MESSAGE) {
    void togglePinnedTab(message.tabId)
      .then((tab) => sendResponse({ ok: true, tab }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  if (message?.type === TOGGLE_MUTE_MESSAGE) {
    void toggleMutedTab(message.tabId)
      .then((tab) => sendResponse({ ok: true, tab }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  if (message?.type === CLOSE_STANDALONE_MESSAGE) {
    void closeStandaloneTab(sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  if (message?.type === SET_LANGUAGE_MESSAGE) {
    void setActionLanguage(message.language)
      .then((language) => sendResponse({ ok: true, language }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  if (message?.type === GET_SESSION_MESSAGE) {
    void getSessionForSender(sender, message.tabId, message.sessionId)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  if (message?.type === REQUEST_ALL_PREVIEWS_MESSAGE) {
    void requestAllPreviewsForSession(
      sender,
      message.tabId,
      message.sessionId,
      message.requestId,
      message.tabIds
    )
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

    return true;
  }

  if (message?.type === CANCEL_PREVIEW_CAPTURE_MESSAGE) {
    cancelPreviewCapture(message.tabId, message.sessionId);
    sendResponse({ ok: true });
    return;
  }

});

async function restoreActionLanguage() {
  const localStorage = chrome.storage?.local;

  if (!localStorage?.get) {
    return;
  }

  try {
    const stored = await localStorage.get(LANGUAGE_STORAGE_KEY);
    const language = normalizeUiLanguage(stored?.[LANGUAGE_STORAGE_KEY], false);

    if (language) {
      await updateActionTitle(language);
    }
  } catch (_error) {
    // The manifest-localized title remains available if storage cannot be read.
  }
}

async function setActionLanguage(value) {
  const language = normalizeUiLanguage(value, true);
  const localStorage = chrome.storage?.local;

  if (localStorage?.set) {
    await localStorage.set({ [LANGUAGE_STORAGE_KEY]: language });
  }

  await updateActionTitle(language);
  return language;
}

async function updateActionTitle(language) {
  if (typeof chrome.action?.setTitle === "function") {
    await chrome.action.setTitle({ title: ACTION_TITLES[language] });
  }
}

function normalizeUiLanguage(value, useDefault) {
  const normalized = String(value || "").trim().toLowerCase().replaceAll("_", "-");

  if (normalized === "pt" || normalized.startsWith("pt-")) {
    return "pt-BR";
  }

  for (const language of ["es", "fr", "de", "tr", "en"]) {
    if (normalized === language || normalized.startsWith(`${language}-`)) {
      return language;
    }
  }

  return useDefault ? "en" : "";
}

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
  let sessionId = "";

  try {
    hostTab = await chrome.tabs.get(tabId);

    if (typeof hostTab?.windowId !== "number") {
      return;
    }

    sessionId = createSessionId(tabId);
    prepareSession(hostTab, sessionId);
    await ensureContentScript(tabId);

    // Start gathering the session before opening, but do not make the user wait
    // for a large tab query or screenshot before showing the loading view.
    await safeSendMessage(tabId, {
      type: TOGGLE_MESSAGE,
      tabId,
      sessionId,
      protocol: CONTENT_SCRIPT_PROTOCOL,
    });
  } catch (error) {
    console.info("TabScroll is using its standalone view for this page.", error);

    try {
      hostTab = hostTab || (await chrome.tabs.get(tabId));
      sessionId = sessionId || createSessionId(tabId);

      if (!pendingSessions.has(sessionId)) {
        prepareSession(hostTab, sessionId);
      }

      await openStandaloneOverlay(hostTab, sessionId);
    } catch (fallbackError) {
      pendingSessions.delete(sessionId);
      console.warn("TabScroll could not open.", fallbackError);
    }
  }
}

async function getSessionForSender(sender, explicitTabId, explicitSessionId) {
  const tabId =
    typeof explicitTabId === "number"
      ? explicitTabId
      : sender.tab?.id;

  if (typeof tabId !== "number") {
    throw new Error("TabScroll session is only available inside a browser tab");
  }

  const sessionId = normalizeSessionId(explicitSessionId);
  const cached = sessionId ? pendingSessions.get(sessionId) : null;

  if (cached?.tabId === tabId) {
    pendingSessions.delete(sessionId);
    return await cached.payload;
  }

  const tab = await chrome.tabs.get(tabId);
  return buildOverlayPayload(tab);
}

async function buildOverlayPayload(hostTab) {
  const hostClassification = classifyTab(hostTab);
  const [allTabs, activePreview] = await Promise.all([
    chrome.tabs.query({ windowType: "normal" }),
    hostClassification.kind === TAB_COLLECTION_KIND
      ? Promise.resolve("")
      : hostTab.active
      ? captureVisiblePreview(hostTab.windowId)
      : Promise.resolve(""),
    ensurePreviewCacheLoaded(),
  ]);
  const resolvedActivePreview = activePreview || getCachedPreview(hostTab);

  const eligibleTabs = allTabs.filter(
    (tab) =>
      typeof tab.id === "number" &&
      typeof tab.windowId === "number" &&
      !isTabScrollPage(tab.url || tab.pendingUrl || "")
  );
  const { sortedTabs, windowLabels } = orderTabsByWindow(eligibleTabs, hostTab.windowId);
  const duplicateCounts = countDuplicateKeys(sortedTabs);
  const duplicateGroupIds = createDuplicateGroupIds(sortedTabs, duplicateCounts);

  const activeIndex = Math.max(
    sortedTabs.findIndex((tab) => tab.id === hostTab.id),
    0
  );
  const recentTab = sortedTabs
    .filter(
      (tab) =>
        tab.windowId === hostTab.windowId &&
        tab.id !== hostTab.id &&
        Number.isFinite(tab.lastAccessed)
    )
    .sort((left, right) => right.lastAccessed - left.lastAccessed)[0];

  return {
    activeIndex,
    currentWindowId: hostTab.windowId,
    recentTabId: typeof recentTab?.id === "number" ? recentTab.id : null,
    tabs: sortedTabs.map((tab) => {
      const classification = classifyTab(tab);
      const isCollection = classification.kind === TAB_COLLECTION_KIND;
      const tabUrl = tab.url || tab.pendingUrl || "";
      const duplicateKey = normalizeDuplicateKey(tabUrl);
      const isDuplicate = Boolean(duplicateKey && duplicateCounts.get(duplicateKey) > 1);

      return {
        id: tab.id,
        windowId: tab.windowId,
        index: tab.index,
        windowLabel: windowLabels.get(tab.windowId) || "Window",
        title: truncateText(tab.title || "", MAX_TITLE_LENGTH),
        url: truncateText(tabUrl, MAX_URL_LENGTH),
        favicon: isCollection ? "" : normalizeFavicon(tab.favIconUrl),
        preview: isCollection
          ? ""
          : tab.id === hostTab.id
          ? resolvedActivePreview
          : getCachedPreview(tab),
        active: tab.id === hostTab.id,
        lastAccessed: Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : null,
        pinned: Boolean(tab.pinned),
        audible: Boolean(tab.audible),
        muted: Boolean(tab.mutedInfo?.muted),
        discarded: Boolean(tab.discarded),
        duplicate: isDuplicate,
        duplicateKey: isDuplicate ? duplicateGroupIds.get(duplicateKey) || "" : "",
        kind: classification.kind,
        collectionName: truncateText(classification.collectionName, MAX_TITLE_LENGTH),
      };
    }),
  };
}

function prepareSession(hostTab, sessionId) {
  if (!hostTab || typeof hostTab.id !== "number") {
    return;
  }

  const normalizedSessionId = normalizeSessionId(sessionId);

  if (!normalizedSessionId) {
    return;
  }

  const session = buildOverlayPayload(hostTab).catch((error) => {
    if (pendingSessions.get(normalizedSessionId)?.payload === session) {
      pendingSessions.delete(normalizedSessionId);
    }

    throw error;
  });

  pendingSessions.set(normalizedSessionId, {
    tabId: hostTab.id,
    payload: session,
  });

  while (pendingSessions.size > 12) {
    pendingSessions.delete(pendingSessions.keys().next().value);
  }
}

async function openStandaloneOverlay(hostTab, sessionId) {
  if (typeof hostTab?.id !== "number" || typeof hostTab.windowId !== "number") {
    throw new Error("Missing host tab for standalone view");
  }

  const url = chrome.runtime.getURL(
    `overlay.html#tab=${encodeURIComponent(String(hostTab.id))}&session=${encodeURIComponent(
      normalizeSessionId(sessionId)
    )}&standalone=1`
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
    const response = await safeSendMessage(tabId, { type: PING_MESSAGE });

    if (response?.ok && response.protocol === CONTENT_SCRIPT_PROTOCOL) {
      return;
    }
  } catch (_error) {
    // Inject the current protocol below.
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content-script.js"],
  });

  const response = await safeSendMessage(tabId, { type: PING_MESSAGE });

  if (!response?.ok || response.protocol !== CONTENT_SCRIPT_PROTOCOL) {
    throw new Error("TabScroll could not initialize the current page overlay");
  }
}

async function activateTab(tabId) {
  validateTabId(tabId);

  const targetTab = await chrome.tabs.get(tabId);
  await chrome.windows.update(targetTab.windowId, { focused: true });
  await chrome.tabs.update(tabId, { active: true });
}

async function closeTab(tabId) {
  validateTabId(tabId);
  await chrome.tabs.remove(tabId);
}

async function togglePinnedTab(tabId) {
  validateTabId(tabId);
  const tab = await chrome.tabs.get(tabId);
  const updatedTab = await chrome.tabs.update(tabId, {
    pinned: !Boolean(tab.pinned),
  });

  return normalizeUpdatedTab(updatedTab);
}

async function toggleMutedTab(tabId) {
  validateTabId(tabId);
  const tab = await chrome.tabs.get(tabId);
  const updatedTab = await chrome.tabs.update(tabId, {
    muted: !Boolean(tab.mutedInfo?.muted),
  });

  return normalizeUpdatedTab(updatedTab);
}

async function captureVisiblePreview(windowId) {
  let lastError = null;

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
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  console.info("TabScroll active preview was unavailable.", {
    windowId,
    message: lastError ? String(lastError?.message || lastError) : "No image data returned",
  });

  return "";
}

async function safeSendMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

async function requestAllPreviewsForSession(
  sender,
  explicitTabId,
  explicitSessionId,
  explicitRequestId,
  explicitTabIds
) {
  const sessionTabId =
    typeof explicitTabId === "number"
      ? explicitTabId
      : sender.tab?.id;

  if (typeof sessionTabId !== "number") {
    throw new Error("Missing session tab id");
  }

  const sessionId = normalizeSessionId(explicitSessionId) || `legacy:${sessionTabId}`;
  const requestId = normalizeSessionId(explicitRequestId);
  const captureKey = sessionId;
  const existingCapture = activePreviewCaptures.get(captureKey);

  if (existingCapture && !existingCapture.cancelled) {
    return existingCapture.task;
  }

  const captureState = {
    cancelled: false,
    diagnostics: [],
    failedTabIds: [],
    sessionId,
    requestId,
  };
  const task = captureAllPreviewsForSession(sessionTabId, captureState, {
    tabIds: normalizeRequestedTabIds(explicitTabIds),
  })
    .catch((error) => {
      console.warn("TabScroll preview capture failed.", error);
      throw error;
    })
    .finally(() => {
      if (activePreviewCaptures.get(captureKey) === captureState) {
        activePreviewCaptures.delete(captureKey);
      }
    });

  captureState.task = task;
  activePreviewCaptures.set(captureKey, captureState);
  return task;
}

function cancelPreviewCapture(sessionTabId, explicitSessionId) {
  if (typeof sessionTabId !== "number") {
    return;
  }

  const sessionId = normalizeSessionId(explicitSessionId);
  const captureState = sessionId
    ? activePreviewCaptures.get(sessionId)
    : Array.from(activePreviewCaptures.values()).find(
        (capture) => capture.sessionTabId === sessionTabId
      );

  if (captureState) {
    captureState.cancelled = true;
  }
}

async function captureAllPreviewsForSession(
  sessionTabId,
  captureState = { cancelled: false },
  options = {}
) {
  let capturedAnyPreview = false;
  captureState.sessionTabId = sessionTabId;
  captureState.diagnostics = Array.isArray(captureState.diagnostics)
    ? captureState.diagnostics
    : [];
  captureState.failedTabIds = Array.isArray(captureState.failedTabIds)
    ? captureState.failedTabIds
    : [];
  captureState.sessionId = normalizeSessionId(captureState.sessionId);
  captureState.requestId = normalizeSessionId(captureState.requestId);

  try {
    await ensurePreviewCacheLoaded();
    const hostTab = await chrome.tabs.get(sessionTabId);
    const allTabs = await chrome.tabs.query({ windowType: "normal" });
    const eligibleTabs = allTabs
      .filter(
        (tab) =>
          typeof tab.id === "number" &&
          !isTabScrollPage(tab.url || tab.pendingUrl || "")
      )
      .map((tab) =>
        typeof tab.windowId === "number"
          ? tab
          : { ...tab, windowId: hostTab.windowId }
      );
    const { sortedTabs, windowOrder } = orderTabsByWindow(eligibleTabs, hostTab.windowId);
    const activeIndexByWindow = getActiveIndexByWindow(sortedTabs);
    const requestedTabIds = new Set(normalizeRequestedTabIds(options.tabIds));
    const pendingUpdates = [];
    const previewTabs = sortedTabs
      .filter((tab) => {
        const cachedPreview = getCachedPreview(tab);

        if (cachedPreview) {
          if (requestedTabIds.has(tab.id)) {
            pendingUpdates.push({
              tabId: tab.id,
              preview: cachedPreview,
            });
          }

          return false;
        }

        if (tab.id === hostTab.id || tab.discarded) {
          return false;
        }

        return (
          isPreviewCandidateUrl(tab.url || tab.pendingUrl || "") &&
          (!requestedTabIds.size || requestedTabIds.has(tab.id))
        );
      })
      .sort((left, right) => {
        const leftWindowRank = left.windowId === hostTab.windowId ? 0 : 1;
        const rightWindowRank = right.windowId === hostTab.windowId ? 0 : 1;

        if (leftWindowRank !== rightWindowRank) {
          return leftWindowRank - rightWindowRank;
        }

        const leftWindowOrder = windowOrder.get(left.windowId) ?? Number.MAX_SAFE_INTEGER;
        const rightWindowOrder = windowOrder.get(right.windowId) ?? Number.MAX_SAFE_INTEGER;

        if (leftWindowOrder !== rightWindowOrder) {
          return leftWindowOrder - rightWindowOrder;
        }

        const leftCenter =
          left.windowId === hostTab.windowId
            ? hostTab.index
            : activeIndexByWindow.get(left.windowId) ?? 0;
        const rightCenter =
          right.windowId === hostTab.windowId
            ? hostTab.index
            : activeIndexByWindow.get(right.windowId) ?? 0;
        const leftDistance = Math.abs(left.index - leftCenter);
        const rightDistance = Math.abs(right.index - rightCenter);

        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }

        if (Boolean(left.active) !== Boolean(right.active)) {
          return left.active ? -1 : 1;
        }

        return left.index - right.index;
      })
      .slice(0, requestedTabIds.size ? requestedTabIds.size : MAX_BACKGROUND_PREVIEWS);
    let nextPreviewIndex = 0;

    async function flushPreviewUpdates() {
      if (!pendingUpdates.length || captureState.cancelled) {
        return;
      }

      const previews = pendingUpdates.splice(0, pendingUpdates.length);
      await notifyPreviewsUpdated(
        sessionTabId,
        captureState.sessionId,
        captureState.requestId,
        previews
      );
    }

    async function captureWorker() {
      while (!captureState.cancelled) {
        const previewIndex = nextPreviewIndex;
        nextPreviewIndex += 1;

        if (previewIndex >= previewTabs.length) {
          return;
        }

        const tab = previewTabs[previewIndex];
        const preview = await captureTabPreviewWithDebugger(tab.id, captureState);

        if (!preview || captureState.cancelled) {
          if (!captureState.cancelled && !captureState.failedTabIds.includes(tab.id)) {
            captureState.failedTabIds.push(tab.id);
          }

          continue;
        }

        cachePreview(tab, preview);
        capturedAnyPreview = true;
        pendingUpdates.push({
          tabId: tab.id,
          preview,
        });

        if (pendingUpdates.length >= PREVIEW_UPDATE_BATCH_SIZE) {
          await flushPreviewUpdates();
        }
      }
    }

    const workerCount = Math.min(BACKGROUND_PREVIEW_CONCURRENCY, previewTabs.length);
    await Promise.all(
      Array.from({ length: workerCount }, () => captureWorker())
    );
    await flushPreviewUpdates();
  } finally {
    if (capturedAnyPreview) {
      schedulePreviewCachePersist();
    }

    if (captureState.diagnostics.length) {
      console.info("TabScroll could not capture some previews.", {
        failedTabIds: captureState.failedTabIds,
        diagnostics: captureState.diagnostics,
      });
    }

    await notifyPreviewCaptureComplete(
      sessionTabId,
      captureState.sessionId,
      captureState.requestId,
      captureState.failedTabIds
    );
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

function createSessionId(tabId) {
  sessionSequence += 1;
  return `${tabId}:${Date.now().toString(36)}:${sessionSequence.toString(36)}`;
}

function normalizeSessionId(value) {
  return typeof value === "string" && /^[a-z0-9:_-]{1,160}$/i.test(value)
    ? value
    : "";
}

function normalizeRequestedTabIds(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(values.filter((tabId) => Number.isInteger(tabId) && tabId >= 0))
  ).slice(0, 8);
}

function isTabScrollPage(value) {
  return typeof value === "string" && value.startsWith(chrome.runtime.getURL("overlay.html"));
}

function orderTabsByWindow(tabs, currentWindowId) {
  const tabsByWindow = new Map();

  for (const tab of tabs) {
    if (!tabsByWindow.has(tab.windowId)) {
      tabsByWindow.set(tab.windowId, []);
    }

    tabsByWindow.get(tab.windowId).push(tab);
  }

  const windowIds = [];

  if (tabsByWindow.has(currentWindowId)) {
    windowIds.push(currentWindowId);
  }

  for (const windowId of tabsByWindow.keys()) {
    if (windowId !== currentWindowId) {
      windowIds.push(windowId);
    }
  }

  const sortedTabs = [];
  const windowLabels = new Map();
  const windowOrder = new Map();

  windowIds.forEach((windowId, windowIndex) => {
    windowLabels.set(windowId, windowIndex === 0 ? "Current Window" : `Window ${windowIndex + 1}`);
    windowOrder.set(windowId, windowIndex);
    tabsByWindow
      .get(windowId)
      .sort((left, right) => left.index - right.index)
      .forEach((tab) => sortedTabs.push(tab));
  });

  return {
    sortedTabs,
    windowLabels,
    windowOrder,
  };
}

function countDuplicateKeys(tabs) {
  const counts = new Map();

  for (const tab of tabs) {
    const key = normalizeDuplicateKey(tab.url || tab.pendingUrl || "");

    if (key) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return counts;
}

function createDuplicateGroupIds(tabs, duplicateCounts) {
  const groupIds = new Map();

  for (const tab of tabs) {
    const key = normalizeDuplicateKey(tab.url || tab.pendingUrl || "");

    if (!key || duplicateCounts.get(key) < 2 || groupIds.has(key)) {
      continue;
    }

    groupIds.set(key, `duplicate-${groupIds.size + 1}`);
  }

  return groupIds;
}

function normalizeDuplicateKey(value) {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.href;
  } catch (_error) {
    return "";
  }
}

function getActiveIndexByWindow(tabs) {
  const activeIndexByWindow = new Map();

  for (const tab of tabs) {
    if (tab.active && !activeIndexByWindow.has(tab.windowId)) {
      activeIndexByWindow.set(tab.windowId, tab.index);
    }
  }

  return activeIndexByWindow;
}

async function ensurePreviewCacheLoaded() {
  if (previewCacheLoadPromise) {
    return previewCacheLoadPromise;
  }

  previewCacheLoadPromise = (async () => {
    const sessionStorage = chrome.storage?.session;

    if (!sessionStorage?.get) {
      return;
    }

    try {
      const stored = await sessionStorage.get(PREVIEW_CACHE_STORAGE_KEY);
      const entries = stored?.[PREVIEW_CACHE_STORAGE_KEY];
      const now = Date.now();

      if (!Array.isArray(entries)) {
        return;
      }

      for (const entry of entries) {
        if (
          !Number.isInteger(entry?.tabId) ||
          typeof entry.url !== "string" ||
          typeof entry.preview !== "string" ||
          !entry.preview.startsWith("data:image/") ||
          !Number.isFinite(entry.capturedAt) ||
          now - entry.capturedAt > PREVIEW_CACHE_TTL_MS
        ) {
          continue;
        }

        previewCache.set(entry.tabId, entry);
      }

      trimPreviewCache();
    } catch (_error) {
      // Session caching is an optimization; capture still works without it.
    }
  })();

  return previewCacheLoadPromise;
}

function getCachedPreview(tab) {
  if (!Number.isInteger(tab?.id)) {
    return "";
  }

  const cached = previewCache.get(tab.id);
  const tabUrl = tab.url || tab.pendingUrl || "";

  if (
    !cached ||
    cached.url !== tabUrl ||
    Date.now() - cached.capturedAt > PREVIEW_CACHE_TTL_MS
  ) {
    if (cached) {
      previewCache.delete(tab.id);
      schedulePreviewCachePersist();
    }

    return "";
  }

  return cached.preview;
}

function cachePreview(tab, preview) {
  if (
    !Number.isInteger(tab?.id) ||
    typeof preview !== "string" ||
    !preview.startsWith("data:image/")
  ) {
    return;
  }

  previewCache.delete(tab.id);
  previewCache.set(tab.id, {
    tabId: tab.id,
    url: tab.url || tab.pendingUrl || "",
    preview,
    capturedAt: Date.now(),
  });
  trimPreviewCache();
}

function trimPreviewCache() {
  while (previewCache.size > MAX_PREVIEW_CACHE_ENTRIES) {
    const oldestTabId = previewCache.keys().next().value;
    previewCache.delete(oldestTabId);
  }
}

function invalidateCachedPreview(tabId) {
  if (!Number.isInteger(tabId)) {
    return;
  }

  void ensurePreviewCacheLoaded().then(() => {
    if (previewCache.delete(tabId)) {
      schedulePreviewCachePersist();
    }
  });
}

function schedulePreviewCachePersist() {
  previewCachePersistPromise = previewCachePersistPromise
    .catch(() => {})
    .then(() => persistPreviewCache());
}

async function persistPreviewCache() {
  const sessionStorage = chrome.storage?.session;

  if (!sessionStorage?.set) {
    return;
  }

  try {
    await sessionStorage.set({
      [PREVIEW_CACHE_STORAGE_KEY]: Array.from(previewCache.values()),
    });
  } catch (_error) {
    // Ignore quota or shutdown races; the current overlay already has previews.
  }
}

async function notifyPreviewsUpdated(sessionTabId, sessionId, requestId, previews) {
  if (
    typeof sessionTabId !== "number" ||
    !Array.isArray(previews) ||
    !previews.length
  ) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: PREVIEWS_UPDATED_MESSAGE,
      tabId: sessionTabId,
      sessionId: normalizeSessionId(sessionId),
      requestId: normalizeSessionId(requestId),
      previews,
    });
  } catch (_error) {
    // The overlay may have closed before the preview batch finished.
  }
}

async function notifyPreviewCaptureComplete(
  sessionTabId,
  sessionId,
  requestId,
  failedTabIds = []
) {
  if (typeof sessionTabId !== "number") {
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: PREVIEW_CAPTURE_COMPLETE_MESSAGE,
      tabId: sessionTabId,
      sessionId: normalizeSessionId(sessionId),
      requestId: normalizeSessionId(requestId),
      failedTabIds: normalizeRequestedTabIds(failedTabIds),
    });
  } catch (_error) {
    // The overlay may have closed before capture completed.
  }
}

async function captureTabPreviewWithDebugger(tabId, captureState = { cancelled: false }) {
  for (let attempt = 0; attempt < DEBUGGER_CAPTURE_ATTEMPTS; attempt += 1) {
    if (captureState.cancelled) {
      return "";
    }

    if (attempt > 0) {
      await wait(DEBUGGER_CAPTURE_RETRY_DELAY_MS);
    }

    const preview = await captureTabPreviewAttemptWithDebugger(tabId, captureState);

    if (preview) {
      return preview;
    }
  }

  return "";
}

async function captureTabPreviewAttemptWithDebugger(
  tabId,
  captureState = { cancelled: false }
) {
  const debuggee = { tabId };

  try {
    await chrome.debugger.attach(debuggee, DEBUGGER_PROTOCOL_VERSION);
  } catch (error) {
    recordPreviewDiagnostic(captureState, tabId, "attach", error);
    return "";
  }

  try {
    const screenshotOptions = await getBackgroundScreenshotOptions(debuggee);

    for (const options of screenshotOptions) {
      if (captureState.cancelled) {
        return "";
      }

      try {
        const result = await chrome.debugger.sendCommand(debuggee, "Page.captureScreenshot", {
          format: PREVIEW_FORMAT,
          quality: BACKGROUND_PREVIEW_QUALITY,
          ...options,
        });
        const data = typeof result?.data === "string" ? result.data : "";

        if (data) {
          return `data:image/${PREVIEW_FORMAT};base64,${data}`;
        }
      } catch (error) {
        recordPreviewDiagnostic(captureState, tabId, "screenshot", error);
        continue;
      }
    }

    return "";
  } catch (error) {
    recordPreviewDiagnostic(captureState, tabId, "prepare", error);
    return "";
  } finally {
    try {
      await chrome.debugger.detach(debuggee);
    } catch (_error) {
      // Ignore detach failures caused by closed tabs or canceled sessions.
    }
  }
}

function recordPreviewDiagnostic(captureState, tabId, stage, error) {
  if (!Array.isArray(captureState?.diagnostics) || captureState.diagnostics.length >= 12) {
    return;
  }

  captureState.diagnostics.push({
    tabId,
    stage,
    message: truncateText(String(error?.message || error || "Unknown capture error"), 240),
  });
}

async function getBackgroundScreenshotOptions(debuggee) {
  const fallbackOptions = [
    {
      fromSurface: true,
      optimizeForSpeed: true,
      captureBeyondViewport: false,
    },
    {
      fromSurface: true,
      captureBeyondViewport: false,
    },
    {
      fromSurface: false,
    },
  ];

  try {
    const metrics = await chrome.debugger.sendCommand(
      debuggee,
      "Page.getLayoutMetrics"
    );
    const viewport =
      metrics?.cssVisualViewport ||
      metrics?.cssLayoutViewport ||
      metrics?.visualViewport ||
      metrics?.layoutViewport;
    const width = Number(viewport?.clientWidth);
    const height = Number(viewport?.clientHeight);

    if (!(width > 0) || !(height > 0)) {
      return fallbackOptions;
    }

    const scale = Math.max(
      0.1,
      Math.min(
        1,
        BACKGROUND_PREVIEW_MAX_WIDTH / width,
        BACKGROUND_PREVIEW_MAX_HEIGHT / height
      )
    );
    const clip = {
      x: Number.isFinite(viewport.pageX) ? viewport.pageX : 0,
      y: Number.isFinite(viewport.pageY) ? viewport.pageY : 0,
      width,
      height,
      scale,
    };

    return [
      {
        fromSurface: true,
        optimizeForSpeed: true,
        captureBeyondViewport: false,
        clip,
      },
      {
        fromSurface: true,
        captureBeyondViewport: false,
        clip,
      },
      ...fallbackOptions,
    ];
  } catch (_error) {
    return fallbackOptions;
  }
}

function validateTabId(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) {
    throw new Error("Invalid tab id");
  }
}

function normalizeUpdatedTab(tab) {
  if (!tab || typeof tab.id !== "number") {
    throw new Error("Tab update did not return tab metadata");
  }

  return {
    id: tab.id,
    windowId: typeof tab.windowId === "number" ? tab.windowId : null,
    index: Number.isInteger(tab.index) ? tab.index : null,
    title: truncateText(tab.title || "", MAX_TITLE_LENGTH),
    url: truncateText(tab.url || tab.pendingUrl || "", MAX_URL_LENGTH),
    active: Boolean(tab.active),
    pinned: Boolean(tab.pinned),
    audible: Boolean(tab.audible),
    muted: Boolean(tab.mutedInfo?.muted),
    discarded: Boolean(tab.discarded),
    lastAccessed: Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : null,
  };
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

function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

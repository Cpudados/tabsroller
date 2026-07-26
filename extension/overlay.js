(function () {
  const THEME_STORAGE_KEY = "tabscroll:theme";
  const THEME_NIGHT = "night";
  const THEME_WHITE = "white";
  const WHEEL_THRESHOLD = 80;
  const WHEEL_LOCK_MS = 160;
  const MAX_VISIBLE_DOTS = 15;
  const app = document.getElementById("app");
  const storedTheme = readStoredTheme();
  const systemThemeQuery =
    typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  const state = {
    tabs: [],
    activeIndex: 0,
    recentTabId: null,
    loading: true,
    hostTabId: null,
    standalone: false,
    previewCaptureRequested: false,
    wheelDelta: 0,
    wheelResetTimer: 0,
    wheelLockedUntil: 0,
    theme: storedTheme || (systemThemeQuery?.matches ? THEME_NIGHT : THEME_WHITE),
    themeLocked: Boolean(storedTheme),
  };

  const icons = {
    app: [
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">',
      '<rect x="3.5" y="10" width="7.5" height="9" rx="1.75" stroke="currentColor" stroke-width="1.8" opacity="0.48"/>',
      '<rect x="8.25" y="6" width="7.5" height="9" rx="1.75" stroke="currentColor" stroke-width="1.8" opacity="0.72"/>',
      '<rect x="13" y="2" width="7.5" height="9" rx="1.75" stroke="currentColor" stroke-width="1.8"/>',
      "</svg>",
    ].join(""),
    fallback: [
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">',
      '<path d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
      "</svg>",
    ].join(""),
    collection: [
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">',
      '<rect x="4" y="7" width="13" height="12" rx="2.2" stroke="currentColor" stroke-width="1.7"/>',
      '<path d="M7 4.5h10.5A2.5 2.5 0 0 1 20 7v8.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      '<path d="M8 11h5M8 14.5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      "</svg>",
    ].join(""),
    moon: [
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">',
      '<path d="M21 13.2A8.6 8.6 0 1 1 10.8 3a7 7 0 0 0 10.2 10.2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      "</svg>",
    ].join(""),
    sun: [
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">',
      '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/>',
      '<path d="M12 2v2.3M12 19.7V22M4.93 4.93l1.63 1.63M17.44 17.44l1.63 1.63M2 12h2.3M19.7 12H22M4.93 19.07l1.63-1.63M17.44 6.56l1.63-1.63" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      "</svg>",
    ].join(""),
    return: [
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">',
      '<path d="M9 7 4 12l5 5M5 12h8.5a5.5 5.5 0 1 1 0 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      "</svg>",
    ].join(""),
  };

  window.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("message", handleParentMessage);
  document.addEventListener("click", handleClick);
  document.addEventListener("error", handleImageError, true);
  bindSystemThemeListener();
  applyTheme();
  render();
  void requestSession();

  function handleWheel(event) {
    if (!state.tabs.length) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    const scaledDelta = event.deltaMode === 1 ? dominantDelta * 16 : dominantDelta;
    const now = Date.now();

    if (now < state.wheelLockedUntil) {
      return;
    }

    state.wheelDelta += scaledDelta;
    window.clearTimeout(state.wheelResetTimer);
    state.wheelResetTimer = window.setTimeout(() => {
      state.wheelDelta = 0;
    }, 120);

    if (Math.abs(state.wheelDelta) < WHEEL_THRESHOLD) {
      return;
    }

    const direction = state.wheelDelta > 0 ? 1 : -1;
    state.wheelDelta = 0;
    state.wheelLockedUntil = now + WHEEL_LOCK_MS;
    moveSelection(direction);
  }

  function handleKeyDown(event) {
    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      toggleTheme();
      return;
    }

    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "r") {
      const recentTab = getRecentTab();

      if (recentTab) {
        event.preventDefault();
        void activateTab(recentTab);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
      return;
    }

    if (!state.tabs.length) {
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateSelection();
    }
  }

  function handleClick(event) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest("[data-action]");
    if (actionElement) {
      const action = actionElement.getAttribute("data-action");

      if (action === "toggle-theme") {
        toggleTheme();
        return;
      }

      if (action === "close") {
        closeOverlay();
        return;
      }

      if (action === "activate") {
        activateSelection();
        return;
      }

      if (action === "activate-recent") {
        const recentTab = getRecentTab();

        if (recentTab) {
          void activateTab(recentTab);
        }
        return;
      }
    }

    const dot = target.closest("[data-role='dot']");
    if (dot) {
      const index = Number(dot.getAttribute("data-index"));
      setSelection(index);
      return;
    }

    const card = target.closest("[data-role='card']");
    if (card) {
      const index = Number(card.getAttribute("data-index"));

      if (index === state.activeIndex) {
        activateSelection();
      } else {
        setSelection(index);
      }

      return;
    }

    const backdrop = target.closest("[data-role='backdrop']");
    if (backdrop && target === backdrop) {
      closeOverlay();
    }
  }

  function handleImageError(event) {
    const image = event.target;

    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    if (image.dataset.role === "favicon") {
      image.remove();
      return;
    }

    if (image.dataset.role !== "preview") {
      return;
    }

    const index = Number(image.dataset.index);

    if (!Number.isInteger(index) || !state.tabs[index]) {
      return;
    }

    state.tabs[index].preview = "";
    render();
  }

  function moveSelection(direction) {
    setSelection(state.activeIndex + direction);
  }

  function setSelection(index) {
    const nextIndex = clampIndex(index);

    if (nextIndex === state.activeIndex) {
      return;
    }

    state.activeIndex = nextIndex;
    render();
  }

  async function activateSelection() {
    const tab = state.tabs[state.activeIndex];

    if (!tab || typeof tab.id !== "number") {
      closeOverlay();
      return;
    }

    await activateTab(tab);
  }

  async function activateTab(tab) {
    try {
      await chrome.runtime.sendMessage({
        type: "tabscroll:activate-tab",
        tabId: tab.id,
      });
    } finally {
      closeOverlay();
    }
  }

  function toggleTheme() {
    state.theme = state.theme === THEME_NIGHT ? THEME_WHITE : THEME_NIGHT;
    state.themeLocked = true;
    persistTheme(state.theme);
    applyTheme();
    render();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    document.body.dataset.theme = state.theme;
    document.documentElement.style.colorScheme = state.theme === THEME_NIGHT ? "dark" : "light";
  }

  function bindSystemThemeListener() {
    if (!systemThemeQuery) {
      return;
    }

    const handleSystemThemeChange = (event) => {
      if (state.themeLocked) {
        return;
      }

      state.theme = event.matches ? THEME_NIGHT : THEME_WHITE;
      applyTheme();
      render();
    };

    if (typeof systemThemeQuery.addEventListener === "function") {
      systemThemeQuery.addEventListener("change", handleSystemThemeChange);
    } else if (typeof systemThemeQuery.addListener === "function") {
      systemThemeQuery.addListener(handleSystemThemeChange);
    }
  }

  function closeOverlay() {
    if (state.standalone) {
      void chrome.runtime.sendMessage({
        type: "tabscroll:close-standalone",
      });
      return;
    }

    window.parent.postMessage(
      {
        type: "tabscroll:close",
      },
      "*"
    );
  }

  function handleParentMessage(event) {
    if (event.source !== window.parent) {
      return;
    }

    const message = event.data;

    if (message?.type === "tabscroll:preview-capture-complete") {
      state.previewCaptureRequested = false;
      return;
    }

    if (message?.type !== "tabscroll:preview-updated") {
      return;
    }

    const tabId = typeof message.tabId === "number" ? message.tabId : NaN;
    const preview = sanitizeAssetUrl(message.preview);

    if (!Number.isFinite(tabId) || !preview) {
      return;
    }

    const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);

    if (tabIndex < 0 || state.tabs[tabIndex]?.preview === preview) {
      return;
    }

    state.tabs[tabIndex].preview = preview;

    if (!state.loading) {
      render();
    }
  }

  function render() {
    syncBackdrop();

    if (state.loading) {
      app.innerHTML = [
        '<div class="ts-shell" data-role="backdrop">',
        renderHeader(),
        '  <div class="ts-stage">',
        '    <div class="ts-loading">',
        '      <div class="ts-loading-spinner" aria-hidden="true"></div>',
        '      <h2 class="ts-loading-title">Loading tabs</h2>',
        '      <p class="ts-loading-copy">TabScroll is gathering your current window.</p>',
        "    </div>",
        "  </div>",
        "</div>",
      ].join("");
      return;
    }

    if (!state.tabs.length) {
      app.innerHTML = [
        '<div class="ts-shell" data-role="backdrop">',
        renderHeader(),
        '  <div class="ts-stage">',
        '    <div class="ts-empty">',
        "      <h2>No tabs available</h2>",
        "      <p>TabScroll only works when there is at least one regular browser tab in the current window.</p>",
        '      <button type="button" data-action="close">Close</button>',
        "    </div>",
        "  </div>",
        "</div>",
      ].join("");
      return;
    }

    const visibleCards = getVisibleCards();

    app.innerHTML = [
      '<div class="ts-shell" data-role="backdrop">',
      renderHeader(),
      '  <div class="ts-stage">',
      '    <div class="ts-cards">',
      visibleCards.map((item) => renderCard(item.tab, item.index, item.position)).join(""),
      "    </div>",
      "  </div>",
      renderRecentSuggestion(),
      renderDots(),
      renderCounter(),
      renderHint(),
      "</div>",
    ].join("");
  }

  function renderHeader() {
    return [
      '<header class="ts-header">',
      '  <div class="ts-brand">',
      `    <div class="ts-brand-badge">${icons.app}</div>`,
      '    <div class="ts-brand-copy">',
      '      <h1 class="ts-brand-title">TabScroll</h1>',
      '      <p class="ts-brand-subtitle">Spatial tab index</p>',
      "    </div>",
      "  </div>",
      '  <div class="ts-actions">',
      renderThemeToggle(),
      '    <button class="ts-key-button" type="button" data-action="close">',
      '      <span class="ts-key">Esc</span>',
      "      <span>to close</span>",
      "    </button>",
      "  </div>",
      "</header>",
    ].join("");
  }

  function renderThemeToggle() {
    const nextTheme = state.theme === THEME_NIGHT ? THEME_WHITE : THEME_NIGHT;
    const nextThemeLabel = nextTheme === THEME_NIGHT ? "dark" : "light";

    return [
      `    <button class="ts-theme-toggle" type="button" data-action="toggle-theme" aria-label="Switch to ${nextThemeLabel} mode">`,
      `      <span class="ts-theme-toggle-track" data-theme="${state.theme}" aria-hidden="true">`,
      '        <span class="ts-theme-toggle-thumb"></span>',
      `        <span class="ts-theme-toggle-option ts-theme-toggle-option--night">${icons.moon}<span>Dark</span></span>`,
      `        <span class="ts-theme-toggle-option ts-theme-toggle-option--white">${icons.sun}<span>Light</span></span>`,
      "      </span>",
      "    </button>",
    ].join("");
  }

  function renderCard(tab, index, position) {
    const title = escapeHtml(tab.title || "Untitled tab");
    const isCollection = tab.kind === "tab-collection";
    const collectionName = escapeHtml(tab.collectionName || tab.title || "Tab collection");
    const url = isCollection
      ? "Saved-tab collection"
      : escapeHtml(formatUrl(tab.url || ""));
    const preview = sanitizeAssetUrl(tab.preview);
    const favicon = sanitizeAssetUrl(tab.favicon);
    const cardIcon = isCollection ? renderCollectionIcon() : renderFavicon(favicon);
    const selected = index === state.activeIndex;
    const selectedLabel = isCollection ? "Collection in focus" : "Tab in focus";

    return [
      `<button class="ts-card-wrap" type="button" data-role="card" data-index="${index}" data-position="${position}" data-kind="${isCollection ? "collection" : "tab"}" aria-label="${title}${isCollection ? ", tab collection" : ""}">`,
      '  <div class="ts-card">',
      `    <div class="ts-preview${isCollection ? " ts-preview--collection" : ""}">`,
      isCollection
        ? renderCollectionPreview(collectionName)
        : preview
        ? `      <img src="${preview}" alt="Preview of ${title}" data-role="preview" data-index="${index}">`
        : [
            '      <div class="ts-preview-fallback">',
            '        <div class="ts-preview-fallback-inner">',
            `          <div class="ts-favicon-badge">${renderFavicon(favicon)}</div>`,
            "          <span>No preview available</span>",
            "        </div>",
            "      </div>",
          ].join(""),
      '      <div class="ts-preview-gradient"></div>',
      "    </div>",
      '    <div class="ts-card-body">',
      '      <div class="ts-card-meta">',
      `        <div class="ts-favicon-pill">${cardIcon}</div>`,
      '        <div class="ts-card-copy">',
      `          <h2 class="ts-card-title">${title}</h2>`,
      `          <p class="ts-card-url">${url}</p>`,
      selected
        ? [
            '          <div class="ts-card-status">',
            '            <span class="ts-card-status-dot"></span>',
            `            <span>${selectedLabel}</span>`,
            "          </div>",
          ].join("")
        : "",
      "        </div>",
      "      </div>",
      "    </div>",
      "  </div>",
      "</button>",
    ].join("");
  }

  function renderCollectionPreview(collectionName) {
    return [
      '      <div class="ts-collection-preview">',
      '        <div class="ts-collection-stack" aria-hidden="true">',
      '          <span class="ts-collection-sheet ts-collection-sheet--back"></span>',
      '          <span class="ts-collection-sheet ts-collection-sheet--middle"></span>',
      '          <span class="ts-collection-sheet ts-collection-sheet--front"></span>',
      `          <span class="ts-collection-symbol">${icons.collection}</span>`,
      "        </div>",
      '        <div class="ts-collection-copy">',
      '          <span class="ts-collection-eyebrow">Tab collection detected</span>',
      "          <strong>Saved tabs live inside this page</strong>",
      `          <span>Open ${collectionName} to browse or restore them.</span>`,
      "        </div>",
      "      </div>",
    ].join("");
  }

  function renderDots() {
    const dotIndexes = getVisibleDotIndexes();

    return [
      '<div class="ts-dots">',
      dotIndexes
        .map((index) => {
          const className = index === state.activeIndex ? "ts-dot is-active" : "ts-dot";
          return `<button class="${className}" type="button" data-role="dot" data-index="${index}" aria-label="Go to tab ${index + 1}"></button>`;
        })
        .join(""),
      "</div>",
    ].join("");
  }

  function renderCounter() {
    return `<div class="ts-counter">${state.activeIndex + 1} / ${state.tabs.length}</div>`;
  }

  function renderRecentSuggestion() {
    const tab = getRecentTab();

    if (!tab) {
      return "";
    }

    const title = escapeHtml(tab.title || "Untitled tab");
    const favicon = sanitizeAssetUrl(tab.favicon);
    const recency = escapeHtml(formatRecency(tab.lastAccessed));

    return [
      '<button class="ts-recent" type="button" data-action="activate-recent">',
      `  <span class="ts-recent-icon">${icons.return}</span>`,
      '  <span class="ts-recent-context">Back to</span>',
      `  <span class="ts-recent-favicon">${renderFavicon(favicon)}</span>`,
      '  <span class="ts-recent-copy">',
      `    <strong>${title}</strong>`,
      `    <span>${recency}</span>`,
      "  </span>",
      '  <span class="ts-recent-key">R</span>',
      "</button>",
    ].join("");
  }

  function renderHint() {
    const shortcutKeys = getShortcutKeys();

    return [
      '<div class="ts-hint">',
      '  <div class="ts-hint-row">',
      '    <div class="ts-hint-keys">',
      shortcutKeys.map((key) => `      <span class="ts-key">${escapeHtml(key)}</span>`).join(""),
      "    </div>",
      '    <span class="ts-hint-copy">to open</span>',
      "  </div>",
      '  <div class="ts-hint-row">',
      '    <div class="ts-hint-keys">',
      '      <span class="ts-key">T</span>',
      "    </div>",
      '    <span class="ts-hint-copy">to switch theme</span>',
      "  </div>",
      getRecentTab()
        ? [
            '  <div class="ts-hint-row">',
            '    <div class="ts-hint-keys">',
            '      <span class="ts-key">R</span>',
            "    </div>",
            '    <span class="ts-hint-copy">to jump back</span>',
            "  </div>",
          ].join("")
        : "",
      '  <div class="ts-hint-row">',
      '    <div class="ts-hint-keys">',
      '      <span class="ts-key">←</span>',
      '      <span class="ts-key">→</span>',
      '      <span class="ts-key">Enter</span>',
      "    </div>",
      '    <span class="ts-hint-copy">or scroll to navigate</span>',
      "  </div>",
      "</div>",
    ].join("");
  }

  function getShortcutKeys() {
    const isMac = /mac/i.test(navigator.platform || navigator.userAgent || "");

    if (isMac) {
      return ["Cmd", "Shift", "K"];
    }

    return ["Ctrl", "Shift", "K"];
  }

  function syncBackdrop() {
    const backdropState = {
      activeIndex: state.activeIndex,
      totalTabs: state.tabs.length,
      theme: state.theme,
      loading: state.loading,
    };

    window.TabScrollSceneState = backdropState;
    window.TabScrollBackdrop?.setState?.(backdropState);
  }

  function renderFavicon(favicon) {
    return [
      '<span class="ts-favicon-art">',
      icons.fallback,
      favicon ? `<img src="${favicon}" alt="" data-role="favicon">` : "",
      "</span>",
    ].join("");
  }

  function renderCollectionIcon() {
    return `<span class="ts-favicon-art ts-favicon-art--collection">${icons.collection}</span>`;
  }

  function getPosition(index) {
    const diff = index - state.activeIndex;

    if (diff === -2) {
      return "left-far";
    }

    if (diff === -1) {
      return "left";
    }

    if (diff === 0) {
      return "center";
    }

    if (diff === 1) {
      return "right";
    }

    if (diff === 2) {
      return "right-far";
    }

    return "";
  }

  function getVisibleCards() {
    const cards = [];
    const firstIndex = Math.max(0, state.activeIndex - 2);
    const lastIndex = Math.min(state.tabs.length - 1, state.activeIndex + 2);

    for (let index = firstIndex; index <= lastIndex; index += 1) {
      cards.push({
        index,
        tab: state.tabs[index],
        position: getPosition(index),
      });
    }

    return cards;
  }

  function getVisibleDotIndexes() {
    const total = state.tabs.length;

    if (total <= MAX_VISIBLE_DOTS) {
      return Array.from({ length: total }, (_, index) => index);
    }

    const radius = Math.floor(MAX_VISIBLE_DOTS / 2);
    const start = Math.max(0, Math.min(state.activeIndex - radius, total - MAX_VISIBLE_DOTS));

    return Array.from({ length: MAX_VISIBLE_DOTS }, (_, offset) => start + offset);
  }

  function clampIndex(index) {
    if (!state.tabs.length) {
      return 0;
    }

    return Math.max(0, Math.min(index, state.tabs.length - 1));
  }

  function findActiveIndex(tabs) {
    const index = tabs.findIndex((tab) => tab.active);
    return index < 0 ? 0 : index;
  }

  function getRecentTab() {
    return state.tabs.find((tab) => tab.id === state.recentTabId && !tab.active) || null;
  }

  function formatRecency(value) {
    if (!Number.isFinite(value)) {
      return "Recently active";
    }

    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - value) / 60000));

    if (elapsedMinutes < 1) {
      return "Active just now";
    }

    if (elapsedMinutes < 60) {
      return `Active ${elapsedMinutes}m ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);

    if (elapsedHours < 24) {
      return `Active ${elapsedHours}h ago`;
    }

    return "Active earlier";
  }

  function focusOverlay() {
    window.requestAnimationFrame(() => {
      document.body.focus();
      window.focus();
    });
  }

  async function requestSession() {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const hostTabIdValue = hashParams.get("tab");
    const hostTabId =
      hostTabIdValue && /^\d+$/.test(hostTabIdValue) ? Number(hostTabIdValue) : undefined;

    state.hostTabId = typeof hostTabId === "number" ? hostTabId : null;
    state.standalone = hashParams.get("standalone") === "1";

    try {
      const response = await chrome.runtime.sendMessage({
        type: "tabscroll:get-session",
        tabId: hostTabId,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Failed to load session");
      }

      state.tabs = Array.isArray(response.payload?.tabs) ? response.payload.tabs : [];
      state.recentTabId =
        typeof response.payload?.recentTabId === "number" ? response.payload.recentTabId : null;
      state.previewCaptureRequested = false;
      state.activeIndex = clampIndex(
        typeof response.payload?.activeIndex === "number"
          ? response.payload.activeIndex
          : findActiveIndex(state.tabs)
      );
      state.loading = false;

      render();
      focusOverlay();

      if (!state.standalone && hasAdditionalPreviewCandidates()) {
        void startPreviewCapture();
      }
    } catch (_error) {
      state.tabs = [];
      state.activeIndex = 0;
      state.recentTabId = null;
      state.previewCaptureRequested = false;
      state.loading = false;
      render();
    }
  }

  async function startPreviewCapture() {
    if (state.previewCaptureRequested || !hasAdditionalPreviewCandidates()) {
      return;
    }

    state.previewCaptureRequested = true;

    try {
      const response = await chrome.runtime.sendMessage({
        type: "tabscroll:request-all-previews",
        tabId: state.hostTabId,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Failed to capture previews");
      }
    } catch (_error) {
      state.previewCaptureRequested = false;
    }
  }

  function hasAdditionalPreviewCandidates() {
    return state.tabs.some((tab) => !tab.active && isPreviewCandidateUrl(tab.url || ""));
  }

  function isPreviewCandidateUrl(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_error) {
      return false;
    }
  }

  function formatUrl(value) {
    if (!value) {
      return "No URL available";
    }

    try {
      const parsed = new URL(value);
      const host = parsed.host.replace(/^www\./, "");
      const path = parsed.pathname === "/" ? "" : parsed.pathname;
      return `${host}${path}` || host;
    } catch (_error) {
      return value;
    }
  }

  function sanitizeAssetUrl(value) {
    if (typeof value !== "string" || value.length === 0) {
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

  function persistTheme(theme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_error) {
      // Storage is optional for the overlay.
    }
  }

  function readStoredTheme() {
    try {
      const value = window.localStorage.getItem(THEME_STORAGE_KEY);
      return value === THEME_NIGHT || value === THEME_WHITE ? value : "";
    } catch (_error) {
      return "";
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();

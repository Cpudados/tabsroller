(function () {
  const THEME_STORAGE_KEY = "tabscroll:theme";
  const THEME_NIGHT = "night";
  const THEME_WHITE = "white";
  const WHEEL_THRESHOLD = 80;
  const CAROUSEL_MOTION_MS = 280;
  const WHEEL_LOCK_MS = CAROUSEL_MOTION_MS;
  const MAX_VISIBLE_DOTS = 15;
  const app = document.getElementById("app");
  const storedTheme = readStoredTheme();
  const systemThemeQuery =
    typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  const state = {
    sourceTabs: [],
    visibleTabs: [],
    activeIndex: 0,
    selectedTabId: null,
    currentWindowId: null,
    scope: "current",
    query: "",
    searchActive: false,
    searchComposing: false,
    searchSelectionStart: 0,
    searchSelectionEnd: 0,
    recentTabId: null,
    statusMessage: "",
    statusTimer: 0,
    pendingActions: new Map(),
    carouselStep: 0,
    carouselDirection: 1,
    carouselMotionUntil: 0,
    deferredRenderTimer: 0,
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
  window.addEventListener("pagehide", cancelPreviewCapture);
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("focusin", handleFocusIn);
  document.addEventListener("compositionstart", handleCompositionStart);
  document.addEventListener("compositionend", handleCompositionEnd);
  document.addEventListener("error", handleImageError, true);
  bindSystemThemeListener();
  applyTheme();
  render();
  void requestSession();

  function handleWheel(event) {
    if (!state.visibleTabs.length) {
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
    const unmodified = !event.metaKey && !event.ctrlKey && !event.altKey;
    const key = typeof event.key === "string" ? event.key : "";
    const lowerKey = key.toLowerCase();
    const searchInput = isSearchInput(event.target);

    if (event.isComposing || state.searchComposing) {
      return;
    }

    if (key === "Escape") {
      event.preventDefault();

      if (state.searchActive || state.query) {
        exitSearch();
      } else {
        closeOverlay();
      }
      return;
    }

    if (key === "Delete" && unmodified && !searchInput) {
      event.preventDefault();
      void closeSelectedTab();
      return;
    }

    if (state.searchActive) {
      if (key === "Backspace" && unmodified) {
        if (!searchInput) {
          event.preventDefault();
          updateQuery(state.query.slice(0, -1), true);
        }
        return;
      }

      if ((!searchInput && key === "ArrowRight") || key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1);
        return;
      }

      if ((!searchInput && key === "ArrowLeft") || key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1);
        return;
      }

      if (key === "Enter") {
        event.preventDefault();
        activateSelection();
        return;
      }

      if (unmodified && key.length === 1) {
        if (!searchInput) {
          event.preventDefault();
          updateQuery(`${state.query}${key}`, true);
        }
        return;
      }

      return;
    }

    if (unmodified && lowerKey === "t") {
      event.preventDefault();
      toggleTheme();
      return;
    }

    if (unmodified && lowerKey === "r") {
      const recentTab = getRecentTab();

      if (recentTab) {
        event.preventDefault();
        void activateTab(recentTab);
      }
      return;
    }

    if (unmodified && lowerKey === "p") {
      event.preventDefault();
      void toggleSelectedPin();
      return;
    }

    if (unmodified && lowerKey === "m") {
      event.preventDefault();
      void toggleSelectedMute();
      return;
    }

    if (unmodified && key === "/") {
      event.preventDefault();
      enterSearch("");
      return;
    }

    if (!state.visibleTabs.length) {
      if (unmodified && key.length === 1 && key !== " ") {
        event.preventDefault();
        enterSearch(key);
      }
      return;
    }

    if (key === "ArrowRight" || key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (key === "ArrowLeft" || key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }

    if (key === "Enter" || key === " ") {
      event.preventDefault();
      activateSelection();
      return;
    }

    if (unmodified && key.length === 1) {
      event.preventDefault();
      enterSearch(key);
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

      if (action === "clear-search") {
        updateQuery("", true);
        return;
      }

      if (action === "set-scope") {
        setScope(actionElement.getAttribute("data-scope"));
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
        setSelection(index, {
          step: getCarouselStepForPosition(card.getAttribute("data-position")),
        });
      }

      return;
    }

    const backdrop = target.closest("[data-role='backdrop']");
    if (backdrop && target === backdrop) {
      closeOverlay();
    }
  }

  function handleInput(event) {
    if (!isSearchInput(event.target)) {
      return;
    }

    if (state.searchComposing) {
      state.query = event.target.value;
      rememberSearchSelection(event.target);
      return;
    }

    updateQuery(event.target.value, true, getSearchSelection(event.target));
  }

  function handleFocusIn(event) {
    if (!isSearchInput(event.target) || state.searchActive) {
      return;
    }

    state.searchActive = true;
    render();
  }

  function handleCompositionStart(event) {
    if (isSearchInput(event.target)) {
      state.searchComposing = true;
    }
  }

  function handleCompositionEnd(event) {
    if (!isSearchInput(event.target)) {
      return;
    }

    state.searchComposing = false;
    updateQuery(event.target.value, true, getSearchSelection(event.target));
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

    const tabId = Number(image.dataset.tabId);

    if (!Number.isInteger(tabId)) {
      return;
    }

    const tab = state.sourceTabs.find((item) => item.id === tabId);

    if (!tab) {
      return;
    }

    const failedPreview = sanitizeAssetUrl(image.currentSrc || image.src);

    if (!failedPreview || failedPreview !== tab.preview) {
      return;
    }

    tab.preview = "";
    renderAfterCarouselMotion();
  }

  function moveSelection(direction) {
    const step = direction < 0 ? -1 : 1;
    setSelection(state.activeIndex + step, {
      step,
      wrap: true,
    });
  }

  function setSelection(index, options = {}) {
    const nextIndex = options.wrap ? wrapIndex(index) : clampIndex(index);

    if (nextIndex === state.activeIndex || !state.visibleTabs.length) {
      return;
    }

    state.carouselStep =
      state.visibleTabs.length > 1 && Number.isInteger(options.step)
        ? Math.max(-2, Math.min(options.step, 2))
        : 0;
    if (state.carouselStep) {
      state.carouselDirection = state.carouselStep < 0 ? -1 : 1;
      state.carouselMotionUntil = Date.now() + CAROUSEL_MOTION_MS;
    }
    state.activeIndex = nextIndex;
    state.selectedTabId = state.visibleTabs[nextIndex]?.id ?? null;
    render();
  }

  async function activateSelection() {
    const tab = state.visibleTabs[state.activeIndex];

    if (!tab || typeof tab.id !== "number") {
      closeOverlay();
      return;
    }

    await activateTab(tab);
  }

  async function activateTab(tab) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "tabscroll:activate-tab",
        tabId: tab.id,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Could not activate this tab");
      }

      closeOverlay();
    } catch (error) {
      showStatus(getActionError(error, "Could not activate this tab"));
    }
  }

  async function closeSelectedTab() {
    const tab = state.visibleTabs[state.activeIndex];

    if (!tab || typeof tab.id !== "number") {
      return;
    }

    const removedIndex = state.activeIndex;
    const actionKey = `tab:${tab.id}`;

    if (state.pendingActions.has(actionKey)) {
      return;
    }

    state.pendingActions.set(actionKey, true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "tabscroll:close-tab",
        tabId: tab.id,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Could not close this tab");
      }

      const latestSelectedTabId = state.selectedTabId;
      state.sourceTabs = state.sourceTabs.filter((item) => item.id !== tab.id);
      const canPreserveSelection =
        latestSelectedTabId !== tab.id &&
        state.sourceTabs.some((item) => item.id === latestSelectedTabId);

      state.selectedTabId = canPreserveSelection ? latestSelectedTabId : null;
      refreshVisibleTabs(
        canPreserveSelection
          ? { preferredTabId: latestSelectedTabId }
          : { fallbackIndex: removedIndex, wrapFallback: true }
      );
      render();
    } catch (error) {
      showStatus(getActionError(error, "Could not close this tab"));
    } finally {
      state.pendingActions.delete(actionKey);
    }
  }

  async function toggleSelectedPin() {
    await updateSelectedTab("tabscroll:toggle-pin", "Could not update the pinned tab");
  }

  async function toggleSelectedMute() {
    await updateSelectedTab("tabscroll:toggle-mute", "Could not update the tab audio");
  }

  async function updateSelectedTab(type, fallbackMessage) {
    const selectedTab = state.visibleTabs[state.activeIndex];

    if (!selectedTab || typeof selectedTab.id !== "number") {
      return;
    }

    const actionKey = `tab:${selectedTab.id}`;

    if (state.pendingActions.has(actionKey)) {
      return;
    }

    state.pendingActions.set(actionKey, true);

    try {
      const response = await chrome.runtime.sendMessage({
        type,
        tabId: selectedTab.id,
      });

      if (!response?.ok) {
        throw new Error(response?.error || fallbackMessage);
      }

      const authoritativeTab = response.tab || response.payload?.tab;

      if (!authoritativeTab || authoritativeTab.id !== selectedTab.id) {
        throw new Error(fallbackMessage);
      }

      const sourceIndex = state.sourceTabs.findIndex((tab) => tab.id === selectedTab.id);

      if (sourceIndex < 0) {
        return;
      }

      state.sourceTabs[sourceIndex] = {
        ...state.sourceTabs[sourceIndex],
        ...getAuthoritativeActionPatch(type, authoritativeTab),
      };
      sortSourceTabs();
      refreshVisibleTabs({ preferredTabId: state.selectedTabId });
      render();
    } catch (error) {
      showStatus(getActionError(error, fallbackMessage));
    } finally {
      state.pendingActions.delete(actionKey);
    }
  }

  function getAuthoritativeActionPatch(type, tab) {
    if (type === "tabscroll:toggle-pin") {
      const patch = {
        pinned: Boolean(tab.pinned),
      };

      if (Number.isFinite(tab.index)) {
        patch.index = tab.index;
      }

      if (Number.isFinite(tab.windowId)) {
        patch.windowId = tab.windowId;
      }

      return patch;
    }

    return {
      muted: Boolean(tab.muted),
      audible: Boolean(tab.audible),
    };
  }

  function getActionError(error, fallbackMessage) {
    const message = typeof error?.message === "string" ? error.message.trim() : "";
    return message || fallbackMessage;
  }

  function showStatus(message) {
    state.statusMessage = message;
    window.clearTimeout(state.statusTimer);
    state.statusTimer = window.setTimeout(() => {
      state.statusMessage = "";
      render();
    }, 2800);
    render();
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
    cancelPreviewCapture();

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

  function cancelPreviewCapture() {
    if (!state.previewCaptureRequested) {
      return;
    }

    state.previewCaptureRequested = false;
    void chrome.runtime.sendMessage({
      type: "tabscroll:cancel-preview-capture",
      tabId: state.hostTabId,
    });
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

    if (message?.type !== "tabscroll:previews-updated") {
      return;
    }

    const previews = Array.isArray(message.previews)
      ? message.previews.slice(0, 24)
      : [];
    let updated = false;

    for (const item of previews) {
      const tabId = typeof item?.tabId === "number" ? item.tabId : NaN;
      const preview = sanitizeAssetUrl(item?.preview);

      if (!Number.isFinite(tabId) || !preview) {
        continue;
      }

      const tabIndex = state.sourceTabs.findIndex((tab) => tab.id === tabId);

      if (tabIndex < 0 || state.sourceTabs[tabIndex]?.preview === preview) {
        continue;
      }

      state.sourceTabs[tabIndex].preview = preview;
      updated = true;
    }

    if (updated && !state.loading) {
      renderAfterCarouselMotion();
    }
  }

  function renderAfterCarouselMotion() {
    window.clearTimeout(state.deferredRenderTimer);
    const remainingMotion = state.carouselMotionUntil - Date.now();

    if (remainingMotion <= 0) {
      state.deferredRenderTimer = 0;
      render();
      return;
    }

    state.deferredRenderTimer = window.setTimeout(() => {
      state.deferredRenderTimer = 0;
      renderAfterCarouselMotion();
    }, remainingMotion + 16);
  }

  function render() {
    if (state.searchComposing) {
      return;
    }

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
        renderLiveStatus(),
        "</div>",
      ].join("");
      restoreSearchFocus();
      return;
    }

    if (!state.sourceTabs.length) {
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
        renderLiveStatus(),
        "</div>",
      ].join("");
      restoreSearchFocus();
      return;
    }

    if (!state.visibleTabs.length) {
      const noMatches = getSearchTokens().length > 0;
      const heading = noMatches ? "No matching tabs" : "No tabs in this scope";
      const copy = noMatches
        ? "Try another title, domain, or URL."
        : "Switch to All Windows to browse tabs outside the current window.";

      app.innerHTML = [
        '<div class="ts-shell" data-role="backdrop">',
        renderHeader(),
        '  <div class="ts-stage">',
        '    <div class="ts-empty ts-no-results">',
        `      <h2>${heading}</h2>`,
        `      <p>${copy}</p>`,
        noMatches
          ? '      <button type="button" data-action="clear-search">Clear search</button>'
          : '      <button type="button" data-action="set-scope" data-scope="all">Show all windows</button>',
        "    </div>",
        "  </div>",
        renderCounter(),
        renderHint(),
        renderLiveStatus(),
        "</div>",
      ].join("");
      restoreSearchFocus();
      return;
    }

    const visibleCards = getVisibleCards();

    app.innerHTML = [
      '<div class="ts-shell" data-role="backdrop">',
      renderHeader(),
      '  <div class="ts-stage">',
      '    <div class="ts-cards">',
      visibleCards
        .map((item) => renderCard(item.tab, item.index, item.position, item.offset))
        .join(""),
      "    </div>",
      "  </div>",
      renderRecentSuggestion(),
      renderDots(),
      renderCounter(),
      renderHint(),
      renderLiveStatus(),
      "</div>",
    ].join("");
    state.carouselStep = 0;
    restoreSearchFocus();
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
      renderHeaderControls(),
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

  function renderHeaderControls() {
    const currentCount = getScopedSourceTabs("current").length;
    const allCount = state.sourceTabs.length;
    const scopeCount = getScopedSourceTabs(state.scope).length;
    const resultCount = state.visibleTabs.length;
    const searchCount = getSearchTokens().length
      ? `${resultCount} of ${scopeCount}`
      : `${scopeCount}`;
    const query = escapeHtml(state.query);

    return [
      '  <div class="ts-header-controls">',
      '    <div class="ts-search" role="search">',
      `      <input class="ts-search-input" data-role="search" type="search" value="${query}" placeholder="Search title, domain, or URL" aria-label="Search tabs" autocomplete="off" spellcheck="false">`,
      `      <span class="ts-search-count" aria-hidden="true">${searchCount}</span>`,
      `      <button class="ts-search-clear" type="button" data-action="clear-search" aria-label="Clear tab search"${state.query ? "" : " hidden"}>Clear</button>`,
      "    </div>",
      '    <div class="ts-scope-toggle" role="group" aria-label="Choose which browser windows to show tabs from">',
      renderScopeOption("current", "Tabs in this window", currentCount),
      renderScopeOption("all", "Tabs in all windows", allCount),
      "    </div>",
      "  </div>",
    ].join("");
  }

  function renderScopeOption(scope, label, count) {
    const selected = state.scope === scope;
    return [
      `      <button class="ts-scope-option${selected ? " is-active" : ""}" type="button" data-action="set-scope" data-scope="${scope}" aria-pressed="${selected}">`,
      `        <span>${label}</span>`,
      `        <span class="ts-scope-count" aria-label="${count} tabs">${count}</span>`,
      "      </button>",
    ].join("");
  }

  function renderLiveStatus() {
    return [
      '<div class="ts-live-status" aria-live="polite" aria-atomic="true">',
      state.statusMessage
        ? `  <span class="ts-toast" role="status">${escapeHtml(state.statusMessage)}</span>`
        : "",
      "</div>",
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

  function renderCard(tab, index, position, offset) {
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
    const badgeDescriptors = getBadgeDescriptors(tab);
    const badges = renderBadges(tab);
    const ariaLabel = escapeHtml(
      [
        tab.title || "Untitled tab",
        isCollection ? "tab collection" : "",
        ...badgeDescriptors.map(({ label }) => label),
        selected ? selectedLabel : "",
      ]
        .filter(Boolean)
        .join(", ")
    );
    const fromPosition = getPreviousCarouselPosition(offset);
    const motionAttribute = fromPosition
      ? ` data-from-position="${fromPosition}"`
      : "";

    return [
      `<button class="ts-card-wrap" type="button" data-role="card" data-index="${index}" data-position="${position}"${motionAttribute} data-kind="${isCollection ? "collection" : "tab"}" aria-label="${ariaLabel}" aria-current="${selected ? "true" : "false"}">`,
      '  <div class="ts-card">',
      `    <div class="ts-preview${isCollection ? " ts-preview--collection" : ""}">`,
      isCollection
        ? renderCollectionPreview(collectionName)
        : preview
        ? `      <img src="${preview}" alt="Preview of ${title}" data-role="preview" data-tab-id="${tab.id}">`
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
      badges,
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
    const current = state.visibleTabs.length ? state.activeIndex + 1 : 0;
    return `<div class="ts-counter">${current} / ${state.visibleTabs.length}</div>`;
  }

  function renderRecentSuggestion() {
    if (state.searchActive || state.query) {
      return "";
    }

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

  function renderBadges(tab) {
    const badges = getBadgeDescriptors(tab).map(({ kind, label }) =>
      renderBadge(kind, label)
    );

    if (!badges.length) {
      return "";
    }

    return `<div class="ts-card-badges">${badges.join("")}</div>`;
  }

  function getBadgeDescriptors(tab) {
    const badges = [];

    if (tab.duplicate) {
      badges.push({ kind: "duplicate", label: "Duplicate" });
    }

    if (tab.pinned) {
      badges.push({ kind: "pinned", label: "Pinned" });
    }

    if (tab.audible && !tab.muted) {
      badges.push({ kind: "audio", label: "Audio" });
    }

    if (tab.muted) {
      badges.push({ kind: "muted", label: "Muted" });
    }

    if (tab.discarded) {
      badges.push({ kind: "discarded", label: "Sleeping" });
    }

    if (state.scope === "all" && tab.windowLabel) {
      badges.push({ kind: "window", label: tab.windowLabel });
    }

    return badges;
  }

  function renderBadge(kind, label) {
    return `<span class="ts-card-badge ts-card-badge--${kind}">${escapeHtml(label)}</span>`;
  }

  function renderHint() {
    const shortcutKeys = getShortcutKeys();
    const contextualHints = state.searchActive
      ? [
          '  <div class="ts-hint-row">',
          '    <div class="ts-hint-keys">',
          '      <span class="ts-key">Type</span>',
          '      <span class="ts-key">⌫</span>',
          '      <span class="ts-key">Esc</span>',
          "    </div>",
          '    <span class="ts-hint-copy">search, edit, or exit search</span>',
          "  </div>",
        ].join("")
      : [
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
        ].join("");

    return [
      '<div class="ts-hint">',
      '  <div class="ts-hint-row">',
      '    <div class="ts-hint-keys">',
      shortcutKeys.map((key) => `      <span class="ts-key">${escapeHtml(key)}</span>`).join(""),
      "    </div>",
      '    <span class="ts-hint-copy">to open</span>',
      "  </div>",
      contextualHints,
      '  <div class="ts-hint-row">',
      '    <div class="ts-hint-keys">',
      '      <span class="ts-key">Del</span>',
      state.searchActive ? "" : '      <span class="ts-key">P</span>',
      state.searchActive ? "" : '      <span class="ts-key">M</span>',
      "    </div>",
      `    <span class="ts-hint-copy">${state.searchActive ? "to close" : "close, pin, or mute"}</span>`,
      "  </div>",
      '  <div class="ts-hint-row">',
      '    <div class="ts-hint-keys">',
      '      <span class="ts-key">&larr;</span>',
      '      <span class="ts-key">&rarr;</span>',
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

  function getPositionForOffset(offset) {
    if (offset <= -2) {
      return "off-left";
    }

    if (offset === -1) {
      return "left";
    }

    if (offset === 0) {
      return "center";
    }

    if (offset === 1) {
      return "right";
    }

    return "off-right";
  }

  function getPreviousCarouselPosition(offset) {
    if (!state.carouselStep || !Number.isInteger(offset)) {
      return "";
    }

    if (state.visibleTabs.length === 2) {
      if (offset === 0) {
        return state.carouselStep < 0 ? "left" : "right";
      }

      return "center";
    }

    return getPositionForOffset(offset + state.carouselStep);
  }

  function getCarouselStepForPosition(position) {
    if (position === "left") {
      return -1;
    }

    if (position === "right") {
      return 1;
    }

    return 0;
  }

  function getCarouselOffsets(total) {
    if (total <= 1) {
      return [0];
    }

    if (total === 2) {
      return state.carouselDirection < 0 ? [-1, 0] : [0, 1];
    }

    return [-1, 0, 1];
  }

  function getVisibleCards() {
    return getCarouselOffsets(state.visibleTabs.length).map((offset) => {
      const index = wrapIndex(state.activeIndex + offset);
      return {
        index,
        offset,
        tab: state.visibleTabs[index],
        position: getPositionForOffset(offset),
      };
    });
  }

  function getVisibleDotIndexes() {
    const total = state.visibleTabs.length;

    if (total <= MAX_VISIBLE_DOTS) {
      return Array.from({ length: total }, (_, index) => index);
    }

    const radius = Math.floor(MAX_VISIBLE_DOTS / 2);
    const start = Math.max(0, Math.min(state.activeIndex - radius, total - MAX_VISIBLE_DOTS));

    return Array.from({ length: MAX_VISIBLE_DOTS }, (_, offset) => start + offset);
  }

  function clampIndex(index) {
    if (!state.visibleTabs.length) {
      return 0;
    }

    return Math.max(0, Math.min(index, state.visibleTabs.length - 1));
  }

  function wrapIndex(index) {
    const total = state.visibleTabs.length;

    if (!total) {
      return 0;
    }

    return ((index % total) + total) % total;
  }

  function findActiveIndex(tabs) {
    const index = tabs.findIndex((tab) => tab.active);
    return index < 0 ? 0 : index;
  }

  function getRecentTab() {
    const candidates = getScopedSourceTabs(state.scope).filter(
      (tab) => tab.id !== state.hostTabId && !tab.active
    );

    if (!candidates.length) {
      return null;
    }

    return candidates.reduce((recent, tab) => {
      const tabAccessed = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : 0;
      const recentAccessed = Number.isFinite(recent.lastAccessed) ? recent.lastAccessed : 0;
      return tabAccessed > recentAccessed ? tab : recent;
    });
  }

  function setScope(scope) {
    if ((scope !== "current" && scope !== "all") || scope === state.scope) {
      return;
    }

    const selectedTabId = state.selectedTabId;
    state.scope = scope;
    refreshVisibleTabs({ preferredTabId: selectedTabId });
    render();
  }

  function enterSearch(query) {
    state.searchActive = true;
    updateQuery(query, true);
  }

  function exitSearch() {
    const selectedTabId = state.selectedTabId;
    state.query = "";
    state.searchActive = false;
    state.searchComposing = false;
    state.searchSelectionStart = 0;
    state.searchSelectionEnd = 0;
    refreshVisibleTabs({ preferredTabId: selectedTabId });
    render();
    focusOverlay();
  }

  function updateQuery(query, keepSearchActive, selection) {
    const selectedTabId = state.selectedTabId;
    state.query = typeof query === "string" ? query : "";
    state.searchActive = Boolean(keepSearchActive);

    if (selection && Number.isFinite(selection.start) && Number.isFinite(selection.end)) {
      state.searchSelectionStart = selection.start;
      state.searchSelectionEnd = selection.end;
    } else {
      state.searchSelectionStart = state.query.length;
      state.searchSelectionEnd = state.query.length;
    }

    refreshVisibleTabs({ preferredTabId: selectedTabId });
    render();
  }

  function getSearchSelection(input) {
    const fallbackPosition =
      typeof input?.value === "string" ? input.value.length : state.query.length;
    return {
      start: Number.isFinite(input?.selectionStart) ? input.selectionStart : fallbackPosition,
      end: Number.isFinite(input?.selectionEnd) ? input.selectionEnd : fallbackPosition,
    };
  }

  function rememberSearchSelection(input) {
    const selection = getSearchSelection(input);
    state.searchSelectionStart = selection.start;
    state.searchSelectionEnd = selection.end;
  }

  function refreshVisibleTabs(options = {}) {
    window.clearTimeout(state.deferredRenderTimer);
    state.deferredRenderTimer = 0;
    state.carouselStep = 0;
    state.carouselMotionUntil = 0;
    recomputeDuplicateFlags();
    const scopedTabs = getScopedSourceTabs(state.scope);
    const tokens = getSearchTokens();
    state.visibleTabs = tokens.length
      ? scopedTabs.filter((tab) => matchesSearch(tab, tokens))
      : scopedTabs.slice();

    const preferredTabId =
      typeof options.preferredTabId === "number" ? options.preferredTabId : state.selectedTabId;
    const preferredIndex = state.visibleTabs.findIndex((tab) => tab.id === preferredTabId);

    if (preferredIndex >= 0) {
      state.activeIndex = preferredIndex;
    } else if (Number.isInteger(options.fallbackIndex)) {
      state.activeIndex = options.wrapFallback
        ? wrapIndex(options.fallbackIndex)
        : clampIndex(options.fallbackIndex);
    } else {
      state.activeIndex = 0;
    }

    state.selectedTabId = state.visibleTabs[state.activeIndex]?.id ?? null;
  }

  function recomputeDuplicateFlags() {
    const duplicateCounts = new Map();

    state.sourceTabs.forEach((tab) => {
      if (typeof tab.duplicateKey !== "string" || !tab.duplicateKey) {
        return;
      }

      duplicateCounts.set(tab.duplicateKey, (duplicateCounts.get(tab.duplicateKey) || 0) + 1);
    });

    state.sourceTabs.forEach((tab) => {
      tab.duplicate = Boolean(
        tab.duplicateKey && (duplicateCounts.get(tab.duplicateKey) || 0) > 1
      );
    });
  }

  function getScopedSourceTabs(scope) {
    if (scope === "all" || !Number.isFinite(state.currentWindowId)) {
      return state.sourceTabs;
    }

    return state.sourceTabs.filter((tab) => tab.windowId === state.currentWindowId);
  }

  function getSearchTokens() {
    return state.query
      .toLocaleLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function matchesSearch(tab, tokens) {
    const url = typeof tab.url === "string" ? tab.url : "";
    const searchableText = [
      typeof tab.title === "string" ? tab.title : "",
      formatHost(url),
      url,
    ]
      .join(" ")
      .toLocaleLowerCase();

    return tokens.every((token) => searchableText.includes(token));
  }

  function formatHost(value) {
    try {
      return new URL(value).host.replace(/^www\./i, "");
    } catch (_error) {
      return "";
    }
  }

  function isSearchInput(target) {
    return Boolean(
      target &&
        typeof target.getAttribute === "function" &&
        target.getAttribute("data-role") === "search"
    );
  }

  function restoreSearchFocus() {
    if (!state.searchActive || typeof document.querySelector !== "function") {
      return;
    }

    window.requestAnimationFrame(() => {
      const input = document.querySelector("[data-role='search']");

      if (!input || typeof input.focus !== "function") {
        return;
      }

      input.focus({ preventScroll: true });

      if (typeof input.setSelectionRange === "function") {
        const maxSelection = input.value.length;
        const selectionStart = Math.max(
          0,
          Math.min(state.searchSelectionStart, maxSelection)
        );
        const selectionEnd = Math.max(
          selectionStart,
          Math.min(state.searchSelectionEnd, maxSelection)
        );
        input.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  }

  function normalizeSourceTabs(tabs) {
    const windowOrder = new Map();
    let nextWindowOrder = 0;

    return tabs.map((tab, sourceOrder) => {
      const windowKey = Number.isFinite(tab.windowId) ? tab.windowId : "unknown";

      if (!windowOrder.has(windowKey)) {
        windowOrder.set(windowKey, nextWindowOrder);
        nextWindowOrder += 1;
      }

      return {
        ...tab,
        _sourceOrder: sourceOrder,
        _windowOrder: windowOrder.get(windowKey),
      };
    });
  }

  function sortSourceTabs() {
    state.sourceTabs.sort((left, right) => {
      const leftCurrent = left.windowId === state.currentWindowId ? 0 : 1;
      const rightCurrent = right.windowId === state.currentWindowId ? 0 : 1;

      if (leftCurrent !== rightCurrent) {
        return leftCurrent - rightCurrent;
      }

      if (left._windowOrder !== right._windowOrder) {
        return left._windowOrder - right._windowOrder;
      }

      if (Boolean(left.pinned) !== Boolean(right.pinned)) {
        return left.pinned ? -1 : 1;
      }

      const leftIndex = Number.isFinite(left.index) ? left.index : Number.MAX_SAFE_INTEGER;
      const rightIndex = Number.isFinite(right.index) ? right.index : Number.MAX_SAFE_INTEGER;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left._sourceOrder - right._sourceOrder;
    });
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

      const payloadTabs = Array.isArray(response.payload?.tabs) ? response.payload.tabs : [];
      const payloadCurrentWindowId = response.payload?.currentWindowId;
      const activeTab = payloadTabs.find((tab) => tab.active);

      state.currentWindowId = Number.isFinite(payloadCurrentWindowId)
        ? payloadCurrentWindowId
        : Number.isFinite(activeTab?.windowId)
        ? activeTab.windowId
        : null;
      state.sourceTabs = normalizeSourceTabs(payloadTabs);
      sortSourceTabs();
      state.recentTabId =
        typeof response.payload?.recentTabId === "number" ? response.payload.recentTabId : null;
      state.previewCaptureRequested = false;
      const payloadActiveIndex =
        typeof response.payload?.activeIndex === "number" ? response.payload.activeIndex : -1;
      const payloadSelectedTabId = payloadTabs[payloadActiveIndex]?.id;
      const activeTabId =
        typeof payloadSelectedTabId === "number"
          ? payloadSelectedTabId
          : payloadTabs[findActiveIndex(payloadTabs)]?.id;

      state.selectedTabId = typeof activeTabId === "number" ? activeTabId : null;
      refreshVisibleTabs({ preferredTabId: state.selectedTabId });
      state.loading = false;

      render();
      focusOverlay();

      if (!state.standalone && hasAdditionalPreviewCandidates()) {
        void startPreviewCapture();
      }
    } catch (_error) {
      state.sourceTabs = [];
      state.visibleTabs = [];
      state.activeIndex = 0;
      state.selectedTabId = null;
      state.currentWindowId = null;
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
    return state.sourceTabs.some(
      (tab) =>
        !tab.active &&
        !tab.preview &&
        isPreviewCandidateUrl(tab.url || "")
    );
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

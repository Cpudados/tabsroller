(function () {
  const THEME_STORAGE_KEY = "tabscroll:theme";
  const ONBOARDING_STORAGE_KEY = "tabscroll:onboarding-v1";
  const THEME_NIGHT = "night";
  const THEME_WHITE = "white";
  const WHEEL_THRESHOLD = 48;
  const WHEEL_LOCK_MS = 160;
  const app = document.getElementById("app");
  const storedTheme = readStoredTheme();
  const systemThemeQuery =
    typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  const state = {
    tabs: [],
    activeIndex: 0,
    loading: true,
    hostTabId: null,
    detailsAccess: false,
    onboarding: false,
    permissionPending: false,
    permissionError: false,
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
  };

  window.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("keydown", handleKeyDown, true);
  document.addEventListener("click", handleClick);
  bindSystemThemeListener();
  applyTheme();
  render();
  void requestSession();

  function handleWheel(event) {
    if (state.onboarding || !state.tabs.length) {
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

    if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
      return;
    }

    if (state.onboarding || !state.tabs.length) {
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
      if (event.target instanceof Element && event.target.closest("button")) {
        return;
      }

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

      if (action === "grant-details") {
        void grantDetailsAccess();
        return;
      }

      if (action === "complete-onboarding") {
        completeOnboarding();
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
      void activateIndex(index);
      return;
    }

    const backdrop = target.closest("[data-role='backdrop']");
    if (backdrop && target === backdrop) {
      closeOverlay();
    }
  }

  function moveSelection(direction) {
    setSelection(state.activeIndex + direction);
  }

  function setSelection(index) {
    const nextIndex = normalizeIndex(index);

    if (nextIndex === state.activeIndex) {
      return;
    }

    state.activeIndex = nextIndex;
    render();
  }

  async function activateSelection() {
    await activateIndex(state.activeIndex);
  }

  async function activateIndex(index) {
    const nextIndex = normalizeIndex(index);
    const tab = state.tabs[nextIndex];

    if (!tab || typeof tab.id !== "number") {
      closeOverlay();
      return;
    }

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
    window.parent.postMessage(
      {
        type: "tabscroll:close",
      },
      "*"
    );
  }

  function render() {
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

    if (state.onboarding) {
      app.innerHTML = [
        '<div class="ts-shell" data-role="backdrop">',
        renderHeader(),
        renderOnboarding(),
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

    const visibleCards = state.tabs
      .map((tab, index) => ({ index, tab, position: getPosition(index) }))
      .filter((item) => item.position);

    app.innerHTML = [
      '<div class="ts-shell" data-role="backdrop">',
      renderHeader(),
      '  <div class="ts-stage">',
      '    <div class="ts-cards">',
      visibleCards.map((item) => renderCard(item.tab, item.index, item.position)).join(""),
      "    </div>",
      "  </div>",
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
      '      <p class="ts-brand-subtitle">Quick Tab Switcher</p>',
      "    </div>",
      "  </div>",
      '  <div class="ts-actions">',
      !state.detailsAccess && !state.onboarding
        ? `    <button class="ts-details-button" type="button" data-action="grant-details"${
            state.permissionPending ? " disabled" : ""
          }>${state.permissionPending ? "Requesting…" : "Show tab details"}</button>`
        : "",
      renderThemeToggle(),
      '    <button class="ts-key-button" type="button" data-action="close">',
      '      <span class="ts-key">Esc</span>',
      "      <span>to close</span>",
      "    </button>",
      "  </div>",
      "</header>",
    ].join("");
  }

  function renderOnboarding() {
    const shortcutKeys = getShortcutKeys();
    const shortcut = shortcutKeys.map((key) => `<span class="ts-key">${escapeHtml(key)}</span>`).join("");

    return [
      '<main class="ts-onboarding">',
      '  <section class="ts-onboarding-card" aria-labelledby="ts-onboarding-title">',
      '    <div class="ts-onboarding-copy">',
      '      <p class="ts-onboarding-eyebrow">Welcome to TabScroll</p>',
      '      <h2 id="ts-onboarding-title">Find the right tab without losing your place.</h2>',
      '      <p>Open the switcher, move through your current window, and choose a tab. Nothing runs until you ask for it.</p>',
      '      <div class="ts-onboarding-steps" aria-label="How TabScroll works">',
      `        <div><span>1</span><strong>Open</strong><p>${shortcut}</p></div>`,
      '        <div><span>2</span><strong>Move</strong><p>Scroll or use <span class="ts-key">←</span> <span class="ts-key">→</span></p></div>',
      '        <div><span>3</span><strong>Switch</strong><p>Press <span class="ts-key">Enter</span> or click a card</p></div>',
      "      </div>",
      "    </div>",
      '    <aside class="ts-permission-card">',
      state.detailsAccess
        ? [
            '      <span class="ts-permission-icon" aria-hidden="true">✓</span>',
            '      <p class="ts-permission-kicker">Ready to switch</p>',
            '      <h3>Tab details are enabled.</h3>',
            '      <p>Titles, site addresses, and favicons will make each card easier to recognize.</p>',
            '      <button class="ts-primary-button" type="button" data-action="complete-onboarding">Start switching</button>',
          ].join("")
        : [
            '      <span class="ts-permission-icon" aria-hidden="true">✦</span>',
            '      <p class="ts-permission-kicker">Optional permission</p>',
            '      <h3>Make every tab recognizable.</h3>',
            '      <p>Allow access to tab titles, site addresses, and favicons. Chrome describes this as browsing-history access; TabScroll reads only your open tabs and never saves or sends them.</p>',
            state.permissionError
              ? '      <p class="ts-permission-error" role="status">Permission was not enabled. You can keep using the limited view.</p>'
              : "",
            `      <button class="ts-primary-button" type="button" data-action="grant-details"${
              state.permissionPending ? " disabled" : ""
            }>${state.permissionPending ? "Waiting for Chrome…" : "Allow tab details"}</button>`,
            '      <button class="ts-secondary-button" type="button" data-action="complete-onboarding">Continue with limited view</button>',
          ].join(""),
      '      <p class="ts-trust-note"><span aria-hidden="true">●</span> No debugger access · No background screenshots · No data leaves Chrome</p>',
      "    </aside>",
      "  </section>",
      "</main>",
    ].join("");
  }

  function renderThemeToggle() {
    const nextTheme = state.theme === THEME_NIGHT ? THEME_WHITE : THEME_NIGHT;

    return [
      `    <button class="ts-theme-toggle" type="button" data-action="toggle-theme" aria-label="Switch to ${nextTheme} mode">`,
      '      <span class="ts-theme-toggle-label">Theme</span>',
      `      <span class="ts-theme-toggle-track" data-theme="${state.theme}" aria-hidden="true">`,
      '        <span class="ts-theme-toggle-thumb"></span>',
      `        <span class="ts-theme-toggle-option ts-theme-toggle-option--night">${icons.moon}<span>Night</span></span>`,
      `        <span class="ts-theme-toggle-option ts-theme-toggle-option--white">${icons.sun}<span>White</span></span>`,
      "      </span>",
      "    </button>",
    ].join("");
  }

  function renderCard(tab, index, position) {
    const title = escapeHtml(tab.title || "Untitled tab");
    const url = escapeHtml(
      tab.detailsAvailable ? formatUrl(tab.url || "") : "Enable tab details to identify this tab"
    );
    const preview = sanitizeAssetUrl(tab.preview);
    const favicon = sanitizeAssetUrl(tab.favicon);
    const selected = index === state.activeIndex;

    return [
      `<button class="ts-card-wrap" type="button" data-role="card" data-index="${index}" data-position="${position}" aria-label="Switch to ${title}">`,
      '  <div class="ts-card">',
      '    <div class="ts-preview">',
      preview
        ? `      <img src="${preview}" alt="Preview of ${title}">`
        : [
            '      <div class="ts-preview-fallback">',
            '        <div class="ts-preview-fallback-inner">',
            `          <div class="ts-favicon-badge">${renderFavicon(favicon)}</div>`,
            `          <strong>${title}</strong>`,
            `          <span>${url}</span>`,
            "        </div>",
            "      </div>",
          ].join(""),
      '      <div class="ts-preview-gradient"></div>',
      "    </div>",
      '    <div class="ts-card-body">',
      '      <div class="ts-card-meta">',
      `        <div class="ts-favicon-pill">${renderFavicon(favicon)}</div>`,
      '        <div class="ts-card-copy">',
      `          <h2 class="ts-card-title">${title}</h2>`,
      `          <p class="ts-card-url">${url}</p>`,
      selected
        ? [
            '          <div class="ts-card-status">',
            '            <span class="ts-card-status-dot"></span>',
            `            <span>${tab.active ? "Current tab" : "Press Enter to switch"}</span>`,
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

  function renderDots() {
    const dotIndexes = getDotIndexes();
    let previousIndex = -1;

    return [
      '<div class="ts-dots">',
      dotIndexes
        .map((index) => {
          const className = index === state.activeIndex ? "ts-dot is-active" : "ts-dot";
          const gap = previousIndex >= 0 && index - previousIndex > 1 ? '<span class="ts-dot-gap" aria-hidden="true">…</span>' : "";
          previousIndex = index;
          return `${gap}<button class="${className}" type="button" data-role="dot" data-index="${index}" aria-label="Select tab ${index + 1}"></button>`;
        })
        .join(""),
      "</div>",
    ].join("");
  }

  function getDotIndexes() {
    if (state.tabs.length <= 11) {
      return state.tabs.map((_, index) => index);
    }

    const indexes = new Set([0, state.tabs.length - 1]);

    for (let offset = -2; offset <= 2; offset += 1) {
      indexes.add(normalizeIndex(state.activeIndex + offset));
    }

    return Array.from(indexes).sort((left, right) => left - right);
  }

  function renderCounter() {
    return `<div class="ts-counter">${state.activeIndex + 1} / ${state.tabs.length}</div>`;
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
      '  <div class="ts-hint-row">',
      '    <div class="ts-hint-keys">',
      '      <span class="ts-key">←</span>',
      '      <span class="ts-key">→</span>',
      '      <span class="ts-key">Enter</span>',
      "    </div>",
      '    <span class="ts-hint-copy">move · Enter switches · cards open directly</span>',
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
    if (favicon) {
      return `<img src="${favicon}" alt="">`;
    }

    return icons.fallback;
  }

  function getPosition(index) {
    let diff = index - state.activeIndex;
    const count = state.tabs.length;

    if (count > 2 && diff > count / 2) {
      diff -= count;
    } else if (count > 2 && diff < -count / 2) {
      diff += count;
    }

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

  function clampIndex(index) {
    if (!state.tabs.length) {
      return 0;
    }

    return Math.max(0, Math.min(index, state.tabs.length - 1));
  }

  function normalizeIndex(index) {
    if (!state.tabs.length) {
      return 0;
    }

    return ((index % state.tabs.length) + state.tabs.length) % state.tabs.length;
  }

  function findActiveIndex(tabs) {
    const index = tabs.findIndex((tab) => tab.active);
    return index < 0 ? 0 : index;
  }

  function focusOverlay() {
    window.requestAnimationFrame(() => {
      document.body.focus();
      window.focus();
    });
  }

  async function requestSession(options = {}) {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const hostTabIdValue = hashParams.get("tab");
    const hostTabId =
      hostTabIdValue && /^\d+$/.test(hostTabIdValue) ? Number(hostTabIdValue) : undefined;

    state.hostTabId = typeof hostTabId === "number" ? hostTabId : null;

    try {
      const response = await chrome.runtime.sendMessage({
        type: "tabscroll:get-session",
        tabId: hostTabId,
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Failed to load session");
      }

      state.tabs = Array.isArray(response.payload?.tabs) ? response.payload.tabs : [];
      state.detailsAccess = response.payload?.detailsAccess === true;
      state.activeIndex = clampIndex(
        typeof response.payload?.activeIndex === "number"
          ? response.payload.activeIndex
          : findActiveIndex(state.tabs)
      );
      state.loading = false;
      state.onboarding = options.showOnboarding !== false && !readOnboardingComplete();

      render();
      focusOverlay();
    } catch (_error) {
      state.tabs = [];
      state.activeIndex = 0;
      state.loading = false;
      render();
    }
  }

  async function grantDetailsAccess() {
    if (state.permissionPending) {
      return;
    }

    state.permissionPending = true;
    state.permissionError = false;
    render();

    try {
      const granted = await chrome.permissions.request({ permissions: ["tabs"] });

      if (!granted) {
        state.permissionError = true;
        return;
      }

      persistOnboardingComplete();
      state.onboarding = false;
      state.loading = true;
      render();
      await requestSession({ showOnboarding: false });
    } catch (_error) {
      state.permissionError = true;
    } finally {
      state.permissionPending = false;
      render();
    }
  }

  function completeOnboarding() {
    persistOnboardingComplete();
    state.onboarding = false;
    state.permissionError = false;
    render();
    focusOverlay();
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

    if (
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("data:") ||
      value.startsWith("chrome-extension://") ||
      value.startsWith("moz-extension://")
    ) {
      return value;
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

  function persistOnboardingComplete() {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "complete");
    } catch (_error) {
      // Onboarding can safely repeat when local storage is unavailable.
    }
  }

  function readOnboardingComplete() {
    try {
      return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "complete";
    } catch (_error) {
      return false;
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

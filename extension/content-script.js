(() => {
  const browser = globalThis.browser;
  const CONTENT_SCRIPT_PROTOCOL = 2;
  const INSTANCE_KEY = `__tabscrollContentScriptV${CONTENT_SCRIPT_PROTOCOL}__`;
  const PING_MESSAGE = `tabscroll:v${CONTENT_SCRIPT_PROTOCOL}:ping`;
  const TOGGLE_MESSAGE = `tabscroll:v${CONTENT_SCRIPT_PROTOCOL}:toggle-overlay`;

  if (window[INSTANCE_KEY]) {
    return;
  }

  window[INSTANCE_KEY] = true;

  const FRAME_ID = "tabscroll-extension-frame";

  let frame = null;
  let hostTabId = null;
  let sessionId = "";

  document.getElementById(FRAME_ID)?.remove();

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === PING_MESSAGE) {
      sendResponse({ ok: true, protocol: CONTENT_SCRIPT_PROTOCOL });
      return;
    }

    if (message?.type === TOGGLE_MESSAGE && message.protocol === CONTENT_SCRIPT_PROTOCOL) {
      hostTabId = typeof message.tabId === "number" ? message.tabId : hostTabId;
      sessionId = typeof message.sessionId === "string" ? message.sessionId : sessionId;

      if (frame) {
        closeOverlay();
      } else {
        openOverlay();
      }

      sendResponse({ ok: true });
      return;
    }

    return undefined;
  });

  window.addEventListener("message", handleFrameMessage);

  function openOverlay() {
    if (frame) {
      focusFrame();
      return;
    }

    frame = document.createElement("iframe");
    frame.id = FRAME_ID;
    frame.src = browser.runtime.getURL(
      `overlay.html#tab=${encodeURIComponent(
        String(hostTabId ?? "")
      )}&session=${encodeURIComponent(sessionId)}`
    );
    frame.title = "TabScroll";
    frame.tabIndex = -1;
    frame.setAttribute("allowtransparency", "true");
    frame.style.position = "fixed";
    frame.style.inset = "0";
    frame.style.width = "100vw";
    frame.style.height = "100vh";
    frame.style.border = "0";
    frame.style.margin = "0";
    frame.style.padding = "0";
    frame.style.background = "transparent";
    frame.style.colorScheme = "light dark";
    frame.style.zIndex = "2147483647";

    frame.addEventListener("load", focusFrame);

    document.documentElement.appendChild(frame);
  }

  function closeOverlay() {
    if (!frame) {
      return;
    }

    if (typeof hostTabId === "number") {
      void browser.runtime.sendMessage({
        type: "tabscroll:cancel-preview-capture",
        tabId: hostTabId,
        sessionId,
      });
    }

    frame.remove();
    frame = null;
    hostTabId = null;
    sessionId = "";
  }

  function handleFrameMessage(event) {
    if (!frame || event.source !== frame.contentWindow) {
      return;
    }

    const message = event.data;

    if (!message || message.type !== "tabscroll:close") {
      return;
    }

    closeOverlay();
  }

  function focusFrame() {
    try {
      frame?.focus();
      frame?.contentWindow?.focus();
    } catch (_error) {
      // Focus errors are non-fatal on some pages.
    }
  }
})();

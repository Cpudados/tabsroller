(() => {
  const INSTANCE_KEY = "__tabscrollContentScriptLoaded__";

  if (window[INSTANCE_KEY]) {
    return;
  }

  window[INSTANCE_KEY] = true;

  const FRAME_ID = "tabscroll-extension-frame";

  let frame = null;
  let hostTabId = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "tabscroll:ping") {
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "tabscroll:toggle-overlay") {
      hostTabId = typeof message.tabId === "number" ? message.tabId : hostTabId;

      if (frame) {
        closeOverlay();
      } else {
        openOverlay();
      }

      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "tabscroll:preview-updated") {
      if (frame?.contentWindow) {
        frame.contentWindow.postMessage(
          {
            type: "tabscroll:preview-updated",
            tabId: message.tabId,
            preview: message.preview,
          },
          "*"
        );
      }

      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "tabscroll:preview-capture-complete") {
      if (frame?.contentWindow) {
        frame.contentWindow.postMessage(
          {
            type: "tabscroll:preview-capture-complete",
          },
          "*"
        );
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
    frame.src = chrome.runtime.getURL(`overlay.html#tab=${encodeURIComponent(String(hostTabId ?? ""))}`);
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

    frame.remove();
    frame = null;
    hostTabId = null;
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

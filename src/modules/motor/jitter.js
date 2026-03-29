(() => {
  const EVENTS = [
    "pointermove",
    "pointerdown",
    "pointerup",
    "pointercancel",
    "click",
    "auxclick",
    "contextmenu",
  ];

  const DEFAULT_CONFIG = {
    magnitudePx: 2,
    frequencyHz: 3,
  };

  const CURSOR_HIDE_TIMEOUT_MS = 180;
  const NATIVE_DRAG_SELECTORS =
    "[draggable='true'], a[href], img, [contenteditable='true']";
  const OVERLAY_MESSAGE_TYPE = "MUTA7_JITTER_OVERLAY";
  const isTopWindow = window.top === window;

  let config = { ...DEFAULT_CONFIG };
  let listenersAttached = false;
  let virtualCursorEl = null;
  let previousCursorValue = null;
  let cursorPosition = { x: -9999, y: -9999 };
  let cursorTarget = null;
  let cursorAnimationFrame = 0;
  let cursorHideTimeoutId = 0;
  let overlaySuspended = false;
  const bypassedPointerIds = new Set();
  const pointerCaptureTargets = new Map();
  let pointerCaptureShimApplied = false;

  function randomOffset() {
    return (Math.random() * 2 - 1) * config.magnitudePx;
  }

  function ensurePointerCaptureShim() {
    if (pointerCaptureShimApplied) return;
    const proto = Element.prototype;
    const originalSet = proto.setPointerCapture;
    const originalRelease = proto.releasePointerCapture;

    if (typeof originalSet === "function") {
      proto.setPointerCapture = function patchedSetPointerCapture(pointerId) {
        pointerCaptureTargets.set(pointerId, this);
        return originalSet.call(this, pointerId);
      };
    }

    if (typeof originalRelease === "function") {
      proto.releasePointerCapture = function patchedReleasePointerCapture(
        pointerId,
      ) {
        pointerCaptureTargets.delete(pointerId);
        return originalRelease.call(this, pointerId);
      };
    }

    pointerCaptureShimApplied = true;
  }

  function markSynthetic(event) {
    Object.defineProperty(event, "__muta7Synthetic", {
      value: true,
      enumerable: false,
    });
  }

  function isSynthetic(event) {
    return Boolean(event?.__muta7Synthetic);
  }

  function clonePointerEvent(event, offsetX, offsetY) {
    const baseInit = {
      bubbles: event.bubbles,
      cancelable: event.cancelable,
      composed: event.composed,
      view: event.view ?? window,
      detail: event.detail,
      screenX: event.screenX + offsetX,
      screenY: event.screenY + offsetY,
      clientX: event.clientX + offsetX,
      clientY: event.clientY + offsetY,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      button: event.button,
      buttons: event.buttons,
      relatedTarget: event.relatedTarget ?? undefined,
    };

    if (event instanceof PointerEvent) {
      Object.assign(baseInit, {
        pointerId: event.pointerId,
        width: event.width,
        height: event.height,
        pressure: event.pressure,
        tangentialPressure: event.tangentialPressure,
        tiltX: event.tiltX,
        tiltY: event.tiltY,
        twist: event.twist,
        pointerType: event.pointerType,
        isPrimary: event.isPrimary,
      });
      return new PointerEvent(event.type, baseInit);
    }

    return new MouseEvent(event.type, baseInit);
  }

  function ensureVirtualCursor() {
    if (virtualCursorEl || !document.documentElement) return;
    const cursor = document.createElement("div");
    cursor.setAttribute("data-muta7-virtual-cursor", "true");
    Object.assign(cursor.style, {
      position: "fixed",
      width: "16px",
      height: "16px",
      margin: "0",
      padding: "0",
      borderRadius: "50%",
      border: "2px solid #1f8b4c",
      background: "rgba(31, 139, 76, 0.15)",
      boxShadow: "0 0 4px rgba(31, 139, 76, 0.4)",
      pointerEvents: "none",
      top: "0",
      left: "0",
      transform: "translate(-50%, -50%) translate3d(-9999px, -9999px, 0)",
      zIndex: "2147483647",
    });
    (document.documentElement ?? document.body).appendChild(cursor);
    virtualCursorEl = cursor;
  }

  function hideSystemCursor() {
    const root = document.documentElement;
    if (!root) return;
    if (previousCursorValue === null) {
      previousCursorValue = root.style.cursor ?? "";
    }
    root.style.cursor = "none";
  }

  function restoreSystemCursor() {
    const root = document.documentElement;
    if (!root) return;
    if (previousCursorValue !== null) {
      root.style.cursor = previousCursorValue;
      previousCursorValue = null;
    } else {
      root.style.removeProperty("cursor");
    }
  }

  function showVirtualCursorIfNeeded(x, y) {
    if (overlaySuspended) return;
    if (
      virtualCursorEl &&
      virtualCursorEl.style.transform?.includes("-9999") === false
    ) {
      return;
    }
    hideSystemCursor();
    cursorPosition = { x, y };
    virtualCursorEl.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0)`;
  }

  function clearCursorHideTimer() {
    if (!cursorHideTimeoutId) return;
    window.clearTimeout(cursorHideTimeoutId);
    cursorHideTimeoutId = 0;
  }

  function hideVirtualCursor() {
    if (isTopWindow && virtualCursorEl) {
      virtualCursorEl.style.transform =
        "translate(-50%, -50%) translate3d(-9999px, -9999px, 0)";
    }
    if (isTopWindow) {
      restoreSystemCursor();
    }
  }

  function scheduleCursorHide() {
    if (overlaySuspended) return;
    clearCursorHideTimer();
    cursorHideTimeoutId = window.setTimeout(() => {
      hideVirtualCursor();
    }, CURSOR_HIDE_TIMEOUT_MS);
  }

  function ensureCursorAnimation() {
    if (cursorAnimationFrame) return;
    const step = () => {
      if (!virtualCursorEl) {
        cursorAnimationFrame = 0;
        return;
      }

      if (cursorTarget) {
        const stiffness = 0.35;
        const dx = cursorTarget.x - cursorPosition.x;
        const dy = cursorTarget.y - cursorPosition.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 0.5) {
          cursorPosition = { ...cursorTarget };
        } else {
          cursorPosition = {
            x: cursorPosition.x + dx * stiffness,
            y: cursorPosition.y + dy * stiffness,
          };
        }

        virtualCursorEl.style.transform = `translate(-50%, -50%) translate3d(${cursorPosition.x}px, ${cursorPosition.y}px, 0)`;
      }

      cursorAnimationFrame = window.requestAnimationFrame(step);
    };
    cursorAnimationFrame = window.requestAnimationFrame(step);
  }

  function stopCursorAnimation() {
    if (!cursorAnimationFrame) return;
    window.cancelAnimationFrame(cursorAnimationFrame);
    cursorAnimationFrame = 0;
  }

  function updateVirtualCursorPosition(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    ensureVirtualCursor();
    if (!virtualCursorEl) return;
    cursorTarget = { x, y };
    if (overlaySuspended) return;
    showVirtualCursorIfNeeded(x, y);
    ensureCursorAnimation();
    scheduleCursorHide();
  }

  function suspendOverlay() {
    if (!isTopWindow || overlaySuspended) return;
    overlaySuspended = true;
    hideVirtualCursor();
  }

  function resumeOverlay() {
    if (!isTopWindow || !overlaySuspended) return;
    overlaySuspended = false;
    if (cursorTarget) {
      showVirtualCursorIfNeeded(cursorTarget.x, cursorTarget.y);
      ensureCursorAnimation();
      scheduleCursorHide();
    }
  }

  function handleIframePointerEvent(event) {
    if (!isTopWindow) return;
    if (!(event.target instanceof HTMLIFrameElement)) return;
    if (event.type === "pointerover") {
      suspendOverlay();
      return;
    }

    if (event.type === "pointerout") {
      resumeOverlay();
    }
  }

  function notifyParentOverlay(action) {
    if (isTopWindow) return;
    try {
      window.parent?.postMessage({ source: OVERLAY_MESSAGE_TYPE, action }, "*");
    } catch {
      // ignore
    }
  }

  function handleOverlayMessage(event) {
    if (!isTopWindow) return;
    if (event?.data?.source !== OVERLAY_MESSAGE_TYPE) return;
    if (event.data.action === "suspend") {
      suspendOverlay();
    } else if (event.data.action === "resume") {
      resumeOverlay();
    }
  }

  function isNativeDragCandidate(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(NATIVE_DRAG_SELECTORS));
  }

  function redispatchWithJitter(originalEvent) {
    const pointerId = originalEvent.pointerId;
    if (bypassedPointerIds.has(pointerId)) return;
    const offsetX = randomOffset();
    const offsetY = randomOffset();
    const synthetic = clonePointerEvent(originalEvent, offsetX, offsetY);
    markSynthetic(synthetic);
    let dispatchTarget = originalEvent.target;
    if (typeof pointerId === "number") {
      const captured = pointerCaptureTargets.get(pointerId);
      if (captured?.isConnected) {
        dispatchTarget = captured;
      }
    }
    dispatchTarget?.dispatchEvent(synthetic);
    updateVirtualCursorPosition(synthetic.clientX, synthetic.clientY);
  }

  function handleEvent(event) {
    if (!listenersAttached) return;
    if (!event.isTrusted || isSynthetic(event)) return;

    const pointerId = event.pointerId;
    if (typeof pointerId === "number") {
      if (bypassedPointerIds.has(pointerId)) {
        if (event.type === "pointerup" || event.type === "pointercancel") {
          bypassedPointerIds.delete(pointerId);
        }
        return;
      }

      if (
        event.type === "pointerdown" &&
        event.target instanceof Element &&
        event.target.closest(NATIVE_DRAG_SELECTORS)
      ) {
        bypassedPointerIds.add(pointerId);
        return;
      }

      if (event.type === "pointerup" || event.type === "pointercancel") {
        bypassedPointerIds.delete(pointerId);
      }
    }

    event.stopImmediatePropagation();
    redispatchWithJitter(event);
  }

  function attachListeners() {
    if (listenersAttached) return;
    ensurePointerCaptureShim();
    EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, handleEvent, true);
    });
    if (isTopWindow) {
      document.addEventListener("pointerover", handleIframePointerEvent, true);
      document.addEventListener("pointerout", handleIframePointerEvent, true);
    }
    listenersAttached = true;
    ensureVirtualCursor();
  }

  function detachListeners() {
    if (!listenersAttached) return;
    EVENTS.forEach((eventName) => {
      document.removeEventListener(eventName, handleEvent, true);
    });
    if (isTopWindow) {
      document.removeEventListener(
        "pointerover",
        handleIframePointerEvent,
        true,
      );
      document.removeEventListener(
        "pointerout",
        handleIframePointerEvent,
        true,
      );
    }
    listenersAttached = false;
    bypassedPointerIds.clear();
    hideVirtualCursor();
    stopCursorAnimation();
    clearCursorHideTimer();
    virtualCursorEl?.remove();
    virtualCursorEl = null;
  }

  function update(newConfig = {}) {
    config = {
      ...config,
      ...newConfig,
    };
    attachListeners();
  }

  function disable() {
    detachListeners();
  }

  globalThis.Muta7MotorJitterModule = {
    update,
    disable,
  };
})();

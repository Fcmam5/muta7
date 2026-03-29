(() => {
  const DEFAULT_CONFIG = {
    mode: "down",
    chance: 0.2,
  };

  let config = { ...DEFAULT_CONFIG };
  let enabled = false;
  const prematurePointers = new Set();

  function shouldTrigger() {
    return Math.random() < Math.max(0, Math.min(1, config.chance));
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

  function cloneMouseLikeEvent(event, type) {
    const baseInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: event.view ?? window,
      detail: event.detail,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
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
      return new PointerEvent(type, baseInit);
    }

    return new MouseEvent(type, baseInit);
  }

  function dispatchEventSequence(originalEvent, types) {
    types.forEach((type) => {
      const synthetic = cloneMouseLikeEvent(originalEvent, type);
      markSynthetic(synthetic);
      originalEvent.target?.dispatchEvent(synthetic);
    });
  }

  function showHighlight(x, y, color = "rgba(239, 68, 68, 0.45)") {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dot = document.createElement("div");
    Object.assign(dot.style, {
      position: "fixed",
      pointerEvents: "none",
      width: "26px",
      height: "26px",
      borderRadius: "50%",
      border: "2px solid rgba(239, 68, 68, 0.8)",
      background: color,
      transform: "translate(-50%, -50%) scale(0.6)",
      opacity: "0.85",
      transition: "opacity 350ms ease, transform 350ms ease",
      zIndex: "2147483647",
      left: `${x}px`,
      top: `${y}px`,
    });
    document.documentElement.appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.opacity = "0";
      dot.style.transform = "translate(-50%, -50%) scale(1.7)";
    });
    setTimeout(() => dot.remove(), 450);
  }

  function triggerGhostClick(event) {
    const delay = 50 + Math.random() * 200;
    setTimeout(() => {
      dispatchEventSequence(event, ["pointerdown", "pointerup", "click"]);
      showHighlight(event.clientX, event.clientY);
    }, delay);
  }

  function triggerPrematureRelease(event) {
    const key = event.pointerId ?? "mouse";
    prematurePointers.add(key);
    const delay = 40 + Math.random() * 120;
    setTimeout(() => {
      dispatchEventSequence(event, ["pointerup", "click"]);
      showHighlight(event.clientX, event.clientY, "rgba(251, 191, 36, 0.45)");
    }, delay);
  }

  function onPointerDown(event) {
    if (!enabled) return;
    if (!event.isTrusted || isSynthetic(event)) return;

    const mode = config.mode;
    if ((mode === "down" || mode === "both") && shouldTrigger()) {
      triggerGhostClick(event);
    }

    if ((mode === "up" || mode === "both") && shouldTrigger()) {
      triggerPrematureRelease(event);
    }
  }

  function onPointerUp(event) {
    if (!enabled) return;
    if (!event.isTrusted || isSynthetic(event)) return;

    const key = event.pointerId ?? "mouse";
    if (!prematurePointers.has(key)) return;

    prematurePointers.delete(key);
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }

  function attach() {
    if (enabled) return;
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    enabled = true;
  }

  function detach() {
    if (!enabled) return;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    enabled = false;
    prematurePointers.clear();
  }

  function update(newConfig = {}) {
    config = {
      ...config,
      ...newConfig,
      mode: (newConfig.mode ?? config.mode ?? "down").toLowerCase(),
    };
    attach();
  }

  function disable() {
    detach();
  }

  globalThis.Muta7MotorAccidentalModule = {
    update,
    disable,
  };
})();

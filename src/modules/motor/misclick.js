(() => {
  const CLICK_EVENTS = ["click", "auxclick", "contextmenu", "pointerdown"];

  const DEFAULT_CONFIG = {
    strategy: "nearest",
    radius: 35,
  };

  let config = { ...DEFAULT_CONFIG };
  let enabled = false;

  function markSynthetic(event) {
    Object.defineProperty(event, "__muta7Synthetic", {
      value: true,
      enumerable: false,
    });
  }

  function isSynthetic(event) {
    return Boolean(event?.__muta7Synthetic);
  }

  function showHighlight(x, y, color = "rgba(31, 139, 76, 0.45)") {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dot = document.createElement("div");
    Object.assign(dot.style, {
      position: "fixed",
      pointerEvents: "none",
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      border: "2px solid rgba(31, 139, 76, 0.9)",
      background: color,
      transform: "translate(-50%, -50%) scale(0.6)",
      opacity: "0.8",
      transition: "opacity 400ms ease, transform 400ms ease",
      zIndex: "2147483647",
      left: `${x}px`,
      top: `${y}px`,
    });
    document.documentElement.appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.opacity = "0";
      dot.style.transform = "translate(-50%, -50%) scale(1.8)";
    });
    setTimeout(() => dot.remove(), 500);
  }

  function normalizeConfig(newConfig = {}) {
    const strategy = (
      newConfig.strategy ??
      config.strategy ??
      "nearest"
    ).toLowerCase();
    const radius = Math.max(
      5,
      Math.min(400, Number(newConfig.radius ?? config.radius ?? 35)),
    );
    return { strategy, radius };
  }

  function getInteractiveElements(root = document) {
    return Array.from(
      root.querySelectorAll(
        "a[href], button, input, textarea, select, summary, [role=button], [role=link], [tabindex]",
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
  }

  function distanceSquared(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
  }

  function findNearestElement(event) {
    const elements = getInteractiveElements();
    let best = null;
    let bestDist = Infinity;
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = distanceSquared(event.clientX, event.clientY, cx, cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = el;
      }
    });
    if (Math.sqrt(bestDist) > config.radius) return null;
    return best;
  }

  function dispatchOnTarget(originalEvent, targetEl) {
    if (!targetEl) return;
    const synthetic = new MouseEvent(originalEvent.type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      detail: originalEvent.detail,
      screenX: originalEvent.screenX,
      screenY: originalEvent.screenY,
      clientX: originalEvent.clientX,
      clientY: originalEvent.clientY,
      ctrlKey: originalEvent.ctrlKey,
      shiftKey: originalEvent.shiftKey,
      altKey: originalEvent.altKey,
      metaKey: originalEvent.metaKey,
      button: originalEvent.button,
      buttons: originalEvent.buttons,
    });
    markSynthetic(synthetic);
    targetEl.dispatchEvent(synthetic);
  }

  function getRandomPointWithinRadius(x, y) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * config.radius;
    const nx = x + Math.cos(angle) * radius;
    const ny = y + Math.sin(angle) * radius;
    return { nx, ny };
  }

  function handleEvent(event) {
    if (!enabled) return;
    if (!event.isTrusted || isSynthetic(event)) return;

    // TODO: Behavior is still WIP—make misfire frequency configurable instead of
    // rerouting every eligible click once presets are finalized.

    const action = config.strategy;
    if (action === "nearest") {
      const target = findNearestElement(event);
      if (target && target !== event.target) {
        event.preventDefault();
        event.stopImmediatePropagation();
        dispatchOnTarget(event, target);
        const rect = target.getBoundingClientRect();
        showHighlight(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    } else if (action === "random") {
      const { nx, ny } = getRandomPointWithinRadius(
        event.clientX,
        event.clientY,
      );
      const target = document.elementFromPoint(nx, ny);
      if (target && target !== event.target) {
        event.preventDefault();
        event.stopImmediatePropagation();
        dispatchOnTarget(event, target);
        showHighlight(nx, ny);
      }
    }
  }

  function attach() {
    if (enabled) return;
    CLICK_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, handleEvent, true);
    });
    enabled = true;
  }

  function detach() {
    if (!enabled) return;
    CLICK_EVENTS.forEach((eventName) => {
      document.removeEventListener(eventName, handleEvent, true);
    });
    enabled = false;
  }

  function update(newConfig = {}) {
    config = normalizeConfig(newConfig);
    attach();
  }

  function disable() {
    detach();
  }

  globalThis.Muta7MotorMisclickModule = {
    update,
    disable,
  };
})();

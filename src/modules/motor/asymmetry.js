(() => {
  const MOVE_EVENTS = ["pointermove", "mousemove"];

  const DEFAULT_CONFIG = {
    side: "left",
    slowdown: 0.6,
    drift: 80,
  };

  let config = { ...DEFAULT_CONFIG };
  let enabled = false;
  let weakBoundary = null;

  function computeBoundary(side) {
    const width = window.innerWidth;
    const offset = width * 0.1;
    if (side === "right") {
      return width - offset;
    }
    if (side === "random") {
      return Math.random() < 0.5 ? width * 0.3 : width * 0.7;
    }
    return offset;
  }

  function markSynthetic(event) {
    Object.defineProperty(event, "__muta7AsymSynthetic", {
      value: true,
      enumerable: false,
    });
  }

  function isSynthetic(event) {
    return Boolean(event?.__muta7AsymSynthetic);
  }

  function clonePointerMove(event, newX, newY) {
    const baseInit = {
      bubbles: event.bubbles,
      cancelable: event.cancelable,
      composed: event.composed,
      view: event.view ?? window,
      detail: event.detail,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: newX,
      clientY: newY,
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

  function adjustMovement(event) {
    const isLeftWeak =
      config.side === "left" ||
      (config.side === "random" && weakBoundary <= window.innerWidth / 2);
    const isRightWeak =
      config.side === "right" ||
      (config.side === "random" && weakBoundary > window.innerWidth / 2);
    const boundary = weakBoundary ?? computeBoundary(config.side);

    let newX = event.clientX;
    let newY = event.clientY;

    if (isLeftWeak && event.clientX < boundary) {
      const delta = event.movementX * config.slowdown;
      newX = event.clientX - event.movementX + delta - config.drift / 500;
    } else if (isRightWeak && event.clientX > boundary) {
      const delta = event.movementX * config.slowdown;
      newX = event.clientX - event.movementX + delta + config.drift / 500;
    }

    if (isLeftWeak) {
      newY += config.drift / 800;
    } else if (isRightWeak) {
      newY -= config.drift / 800;
    }

    return { newX, newY };
  }

  function handleMove(event) {
    if (!enabled) return;
    if (!event.isTrusted || isSynthetic(event)) return;

    const { newX, newY } = adjustMovement(event);
    if (
      Math.abs(newX - event.clientX) < 0.5 &&
      Math.abs(newY - event.clientY) < 0.5
    ) {
      return;
    }

    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
    const synthetic = clonePointerMove(event, newX, newY);
    markSynthetic(synthetic);
    event.target?.dispatchEvent(synthetic);
  }

  function attach() {
    if (enabled) return;
    MOVE_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, handleMove, true);
    });
    enabled = true;
  }

  function detach() {
    if (!enabled) return;
    MOVE_EVENTS.forEach((eventName) => {
      document.removeEventListener(eventName, handleMove, true);
    });
    enabled = false;
  }

  function update(newConfig = {}) {
    config = {
      ...config,
      ...newConfig,
      side: (newConfig.side ?? config.side ?? "left").toLowerCase(),
      slowdown: Math.max(
        0.2,
        Math.min(0.95, Number(newConfig.slowdown ?? config.slowdown ?? 0.6)),
      ),
      drift: Math.max(
        10,
        Math.min(400, Number(newConfig.drift ?? config.drift ?? 80)),
      ),
    };
    weakBoundary = computeBoundary(config.side);
    attach();
  }

  function disable() {
    detach();
  }

  globalThis.Muta7MotorAsymmetryModule = {
    update,
    disable,
  };
})();

(() => {
  const MODES = {
    none: { blockMouse: false, blockTouch: false, blockKeyboard: false },
    mouse: { blockMouse: true, blockTouch: false, blockKeyboard: false },
    touch: { blockMouse: false, blockTouch: true, blockKeyboard: false },
    keyboard: { blockMouse: false, blockTouch: false, blockKeyboard: true },
    "mouse-touch": { blockMouse: true, blockTouch: true, blockKeyboard: false },
    "mouse-keyboard": {
      blockMouse: true,
      blockTouch: false,
      blockKeyboard: true,
    },
    "touch-keyboard": {
      blockMouse: false,
      blockTouch: true,
      blockKeyboard: true,
    },
    full: { blockMouse: true, blockTouch: true, blockKeyboard: true },
  };

  const MOUSE_EVENTS = [
    "click",
    "auxclick",
    "dblclick",
    "contextmenu",
    "mousedown",
    "mouseup",
    "mousemove",
    "mouseenter",
    "mouseleave",
    "mouseover",
    "mouseout",
    "mousewheel",
    "wheel",
    "drag",
    "dragstart",
    "dragend",
    "dragenter",
    "dragleave",
    "dragover",
    "drop",
  ];

  const SCROLL_EVENTS = ["wheel", "mousewheel"];

  const POINTER_EVENTS = [
    "pointerdown",
    "pointerup",
    "pointermove",
    "pointerover",
    "pointerenter",
    "pointerleave",
    "pointerout",
    "pointercancel",
    "gotpointercapture",
    "lostpointercapture",
  ];

  const TOUCH_EVENTS = [
    "touchstart",
    "touchmove",
    "touchend",
    "touchcancel",
    "gesturestart",
    "gesturechange",
    "gestureend",
  ];

  const KEY_EVENTS = ["keydown", "keypress", "keyup"];

  let mouseHandler = null;
  let pointerHandler = null;
  let touchHandler = null;
  let scrollHandler = null;
  let keyboardHandler = null;
  let currentMode = "none";
  let interactionStyleEl = null;
  let hoverShieldEl = null;
  let pointerPolicy = { blockMouse: false, blockTouch: false };
  let mousePolicy = { blockMouse: false, blockKeyboard: false };

  function suppress(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopImmediatePropagation();
  }

  function setHoverShield(active) {
    if (!document.documentElement) return;

    if (!active) {
      hoverShieldEl?.remove();
      hoverShieldEl = null;
      return;
    }

    if (hoverShieldEl) return;

    const shield = document.createElement("div");
    shield.setAttribute("data-muta7-hover-shield", "true");
    Object.assign(shield.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      pointerEvents: "auto",
      background: "transparent",
      cursor: "not-allowed",
    });

    document.documentElement.appendChild(shield);
    hoverShieldEl = shield;
  }

  function setInteractionOverride({ blockMouse = false, blockTouch = false }) {
    if (!document.documentElement) return;

    if (interactionStyleEl) {
      interactionStyleEl.remove();
      interactionStyleEl = null;
    }

    if (!blockMouse && !blockTouch) {
      setHoverShield(false);
      return;
    }

    const style = document.createElement("style");
    style.setAttribute("data-muta7-motor-cursor", "true");
    const styleRules = [];

    if (blockMouse) {
      styleRules.push(`
        * {
          cursor: not-allowed !important;
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
        }
      `);
    }

    if (blockTouch) {
      styleRules.push(`
        html, body, * {
          touch-action: none !important;
          -ms-touch-action: none !important;
        }
      `);
    }

    style.textContent = styleRules.join("\n");
    document.documentElement.appendChild(style);
    interactionStyleEl = style;
    setHoverShield(blockMouse);
  }

  function shouldBlockMouseEvent(event) {
    if (!mousePolicy.blockMouse) {
      return false;
    }

    const canBeKeyboardActivation =
      !mousePolicy.blockKeyboard &&
      (event.type === "click" || event.type === "contextmenu") &&
      event.detail === 0;

    if (canBeKeyboardActivation) {
      return false;
    }

    return true;
  }

  function setMouseCapture(
    active,
    policy = { blockMouse: false, blockKeyboard: false },
  ) {
    mousePolicy = {
      blockMouse: Boolean(policy.blockMouse),
      blockKeyboard: Boolean(policy.blockKeyboard),
    };

    if (active && !mouseHandler) {
      mouseHandler = (event) => {
        if (!shouldBlockMouseEvent(event)) return;
        suppress(event);
      };
      MOUSE_EVENTS.forEach((eventName) => {
        document.addEventListener(eventName, mouseHandler, true);
      });
      return;
    }

    if (!active && mouseHandler) {
      MOUSE_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, mouseHandler, true);
      });
      mouseHandler = null;
    }
  }

  function shouldBlockPointer(event) {
    const pointerType = String(event?.pointerType ?? "").toLowerCase();
    const isMousePointer = pointerType === "" || pointerType === "mouse";
    const isTouchPointer = pointerType === "touch";

    if (pointerPolicy.blockMouse && pointerPolicy.blockTouch) {
      return true;
    }

    if (pointerPolicy.blockMouse && isMousePointer) {
      return true;
    }

    if (pointerPolicy.blockTouch && isTouchPointer) {
      return true;
    }

    return false;
  }

  function setPointerCapture(
    active,
    policy = { blockMouse: false, blockTouch: false },
  ) {
    pointerPolicy = {
      blockMouse: Boolean(policy.blockMouse),
      blockTouch: Boolean(policy.blockTouch),
    };

    if (active && !pointerHandler) {
      pointerHandler = (event) => {
        if (!shouldBlockPointer(event)) return;
        suppress(event);
      };
      POINTER_EVENTS.forEach((eventName) => {
        document.addEventListener(eventName, pointerHandler, true);
      });
      return;
    }

    if (!active && pointerHandler) {
      POINTER_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, pointerHandler, true);
      });
      pointerHandler = null;
    }
  }

  function setTouchCapture(active) {
    if (active && !touchHandler) {
      touchHandler = suppress;
      TOUCH_EVENTS.forEach((eventName) => {
        document.addEventListener(eventName, touchHandler, true);
      });
      return;
    }

    if (!active && touchHandler) {
      TOUCH_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, touchHandler, true);
      });
      touchHandler = null;
    }
  }

  function setScrollCapture(active) {
    if (active && !scrollHandler) {
      scrollHandler = suppress;
      SCROLL_EVENTS.forEach((eventName) => {
        document.addEventListener(eventName, scrollHandler, {
          capture: true,
          passive: false,
        });
        window.addEventListener(eventName, scrollHandler, {
          capture: true,
          passive: false,
        });
      });
      return;
    }

    if (!active && scrollHandler) {
      SCROLL_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, scrollHandler, true);
        window.removeEventListener(eventName, scrollHandler, true);
      });
      scrollHandler = null;
    }
  }

  function setKeyboardCapture(active) {
    if (active && !keyboardHandler) {
      keyboardHandler = suppress;
      KEY_EVENTS.forEach((eventName) => {
        document.addEventListener(eventName, keyboardHandler, true);
      });
      return;
    }

    if (!active && keyboardHandler) {
      KEY_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, keyboardHandler, true);
      });
      keyboardHandler = null;
    }
  }

  function applyMode(mode = "none") {
    const config = MODES[mode] ?? MODES.none;
    setMouseCapture(config.blockMouse, config);
    setPointerCapture(config.blockMouse || config.blockTouch, config);
    setTouchCapture(config.blockTouch);
    setScrollCapture(config.blockMouse || config.blockTouch);
    setKeyboardCapture(config.blockKeyboard);
    currentMode = mode;
    setInteractionOverride(config);
  }

  function enable({ mode = "none" } = {}) {
    applyMode(mode);
  }

  function disable() {
    applyMode("none");
    setHoverShield(false);
  }

  function update(config = {}) {
    applyMode(config.mode ?? currentMode ?? "none");
  }

  globalThis.Muta7MotorBlockerModule = {
    enable,
    disable,
    update,
  };
})();

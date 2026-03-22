(() => {
  const MODES = {
    none: { blockPointer: false, blockKeyboard: false },
    mouse: { blockPointer: true, blockKeyboard: false },
    full: { blockPointer: true, blockKeyboard: true },
  };

  const POINTER_EVENTS = [
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
    "wheel",
    "pointerdown",
    "pointerup",
    "pointermove",
    "pointerover",
    "pointerenter",
    "pointerleave",
    "pointerout",
  ];

  const KEY_EVENTS = ["keydown", "keypress", "keyup"];

  let pointerHandler = null;
  let keyboardHandler = null;
  let currentMode = "none";
  let cursorStyleEl = null;

  function suppress(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function enableCursorOverride() {
    if (cursorStyleEl || !document.documentElement) return;
    const style = document.createElement("style");
    style.setAttribute("data-muta7-motor-cursor", "true");
    style.textContent = `
      * {
        cursor: help !important;
        pointer-events: none !important;
      }
    `;
    document.documentElement.appendChild(style);
    cursorStyleEl = style;
  }

  function disableCursorOverride() {
    if (!cursorStyleEl) return;
    cursorStyleEl.remove();
    cursorStyleEl = null;
  }

  function setPointerCapture(active) {
    if (active && !pointerHandler) {
      pointerHandler = suppress;
      POINTER_EVENTS.forEach((eventName) => {
        document.addEventListener(eventName, pointerHandler, true);
      });
      enableCursorOverride();
      return;
    }

    if (!active && pointerHandler) {
      POINTER_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, pointerHandler, true);
      });
      pointerHandler = null;
      disableCursorOverride();
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
    setPointerCapture(config.blockPointer);
    setKeyboardCapture(config.blockKeyboard);
    currentMode = mode;
  }

  function enable({ mode = "none" } = {}) {
    applyMode(mode);
  }

  function disable() {
    applyMode("none");
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

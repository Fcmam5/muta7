(() => {
  const FILTER_KEY = "colorblindness";
  const DEFAULT_MODE = "protanopia";
  const stack = globalThis.Muta7FilterStack;

  if (!stack) {
    console.warn("Muta7: Filter stack not available, colorblindness module disabled");
    return;
  }

  function createMatrixFilter(id, values) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg'>` +
      `<filter id='${id}' color-interpolation-filters='sRGB'>` +
      `<feColorMatrix type='matrix' values='${values}' />` +
      `</filter>` +
      `</svg>`;
    const encoded = encodeURIComponent(svg);
    return `url("data:image/svg+xml,${encoded}#${id}")`;
  }

  const FILTERS = {
    protanopia: createMatrixFilter(
      "muta7-protanopia",
      "0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0"
    ),
    deuteranopia: createMatrixFilter(
      "muta7-deuteranopia",
      "0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0"
    ),
    tritanopia: createMatrixFilter(
      "muta7-tritanopia",
      "0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0"
    ),
    monochromacy: createMatrixFilter(
      "muta7-monochromacy",
      "0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0 0 0 1 0"
    ),
  };

  let isEnabled = false;
  let currentMode = "none";

  function apply(mode) {
    if (!mode || mode === "none") {
      stack.delete(FILTER_KEY);
      currentMode = "none";
      return;
    }

    const filterValue = FILTERS[mode] ?? FILTERS[DEFAULT_MODE];
    stack.set(FILTER_KEY, filterValue);
    currentMode = mode;
  }

  function enable(config = {}) {
    if (isEnabled && currentMode === config.mode) return;
    isEnabled = true;
    apply(config.mode || DEFAULT_MODE);
  }

  function disable() {
    if (!isEnabled) return;
    stack.delete(FILTER_KEY);
    currentMode = "none";
    isEnabled = false;
  }

  function update(config = {}) {
    if (!isEnabled) {
      enable(config);
      return;
    }
    apply(config.mode || currentMode || DEFAULT_MODE);
  }

  globalThis.Muta7ColorBlindnessModule = {
    enable,
    disable,
    update,
  };
})();

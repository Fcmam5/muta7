(() => {
  const stack = globalThis.Muta7FilterStack;
  const FALLBACK_KEY = "blur";
  const fallbackRoot = document.documentElement;
  let fallbackBaseFilter = fallbackRoot.style.filter || "";
  let isEnabled = false;

  function toBlurPixels(intensity = 0) {
    const bounded = Math.max(0, Math.min(100, Number(intensity) || 0));
    return bounded / 10;
  }

  function enable({ intensity = 0 } = {}) {
    if (!isEnabled) {
      fallbackBaseFilter = fallbackRoot.style.filter || "";
      isEnabled = true;
    }
    const blurPx = toBlurPixels(intensity);
    if (stack) {
      stack.set("blur", `blur(${blurPx}px)`);
      return;
    }
    fallbackRoot.style.filter =
      `${fallbackBaseFilter} blur(${blurPx}px)`.trim();
  }

  function disable() {
    if (stack) {
      stack.delete("blur");
    } else {
      fallbackRoot.style.filter = fallbackBaseFilter;
    }
    isEnabled = false;
  }

  function update(config = {}) {
    if (!isEnabled) {
      enable(config);
      return;
    }
    const blurPx = toBlurPixels(config.intensity);
    if (stack) {
      stack.set("blur", `blur(${blurPx}px)`);
      return;
    }
    fallbackRoot.style.filter =
      `${fallbackBaseFilter} blur(${blurPx}px)`.trim();
  }

  globalThis.Muta7BlurModule = {
    enable,
    disable,
    update,
  };
})();

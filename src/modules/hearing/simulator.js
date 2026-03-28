(() => {
  const MODES = {
    none: "none",
    deaf: "deaf",
    hard: "hard",
  };

  const mediaElements = new Set();
  const originalVolumes = new WeakMap();
  const enforcementHandlers = new WeakMap();
  let mutationObserver = null;
  let currentConfig = { mode: MODES.none, level: 60 };
  const audioContexts = new Set();
  const originalAudioContext = window.AudioContext;
  const originalWebkitAudioContext = window.webkitAudioContext;

  function getAttenuation(config) {
    if (config.mode === MODES.deaf) return 0;
    if (config.mode === MODES.hard) {
      const level = Math.max(0, Math.min(100, Number(config.level ?? 60)));
      return Math.max(0, 1 - level / 100);
    }
    return 1;
  }

  function trackMediaElement(element) {
    if (!(element instanceof HTMLMediaElement)) return;
    if (!originalVolumes.has(element)) {
      originalVolumes.set(element, element.volume || 1);
    }
    mediaElements.add(element);
    applyConfigToElement(element, currentConfig);
    attachEnforcement(element);
  }

  function untrackMediaElement(element) {
    if (!(element instanceof HTMLMediaElement)) return;
    detachEnforcement(element);
    restoreElement(element);
    mediaElements.delete(element);
    originalVolumes.delete(element);
  }

  function restoreElement(element) {
    const originalVolume = originalVolumes.get(element);
    if (typeof originalVolume !== "number") return;
    try {
      element.muted = false;
      element.volume = originalVolume;
    } catch (error) {
      console.warn("Muta7 hearing restore failed", error);
    }
  }

  function applyConfigToElement(element, config) {
    const attenuation = getAttenuation(config);
    if (attenuation === 0) {
      element.muted = true;
      return;
    }

    element.muted = false;
    const originalVolume = originalVolumes.get(element) ?? 1;
    element.volume = Math.max(0, Math.min(1, originalVolume * attenuation));
  }

  function attachEnforcement(element) {
    if (enforcementHandlers.has(element)) return;
    const handler = () => {
      if (currentConfig.mode === MODES.none) return;
      applyConfigToElement(element, currentConfig);
    };
    enforcementHandlers.set(element, handler);
    element.addEventListener("volumechange", handler, true);
    element.addEventListener("play", handler, true);
  }

  function detachEnforcement(element) {
    const handler = enforcementHandlers.get(element);
    if (!handler) return;
    element.removeEventListener("volumechange", handler, true);
    element.removeEventListener("play", handler, true);
    enforcementHandlers.delete(element);
  }

  function scanExistingMedia() {
    document
      .querySelectorAll("audio, video")
      .forEach((el) => trackMediaElement(el));
  }

  function handleMutations(records) {
    for (const record of records) {
      record.addedNodes?.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node instanceof HTMLMediaElement) trackMediaElement(node);
        node
          .querySelectorAll?.("audio, video")
          .forEach((el) => trackMediaElement(el));
      });
      record.removedNodes?.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node instanceof HTMLMediaElement) untrackMediaElement(node);
        node
          .querySelectorAll?.("audio, video")
          .forEach((el) => untrackMediaElement(el));
      });
    }
  }

  function startObserver() {
    if (mutationObserver) return;
    mutationObserver = new MutationObserver(handleMutations);
    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function stopObserver() {
    if (!mutationObserver) return;
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  function patchAudioContext(BaseContext) {
    if (!BaseContext) return null;
    return class PatchedAudioContext extends BaseContext {
      constructor(...args) {
        super(...args);
        const gain = this.createGain();
        gain.gain.value = 1;
        gain.connect(super.destination);
        this.__muta7_gain = gain;
        audioContexts.add(this);
        updateAudioContext(this);
      }

      get destination() {
        return this.__muta7_gain || super.destination;
      }
    };
  }

  function updateAudioContext(ctx) {
    const gain = ctx?.__muta7_gain;
    if (!gain) return;
    gain.gain.value = getAttenuation(currentConfig);
  }

  function updateAllAudioContexts() {
    audioContexts.forEach((ctx) => updateAudioContext(ctx));
  }

  function applyConfig(config = {}) {
    currentConfig = {
      mode: MODES[config.mode] || MODES.none,
      level: Math.max(0, Math.min(100, Number(config.level ?? 60))),
    };

    if (currentConfig.mode === MODES.none) {
      stopObserver();
      mediaElements.forEach((el) => {
        restoreElement(el);
        detachEnforcement(el);
      });
      mediaElements.clear();
      originalVolumes.clear?.();
      updateAllAudioContexts();
      return;
    }

    scanExistingMedia();
    startObserver();
    mediaElements.forEach((el) => applyConfigToElement(el, currentConfig));
    updateAllAudioContexts();
  }

  function enable(config = {}) {
    applyConfig(config);
  }

  function disable() {
    applyConfig({ mode: MODES.none, level: 60 });
  }

  function update(config = {}) {
    applyConfig({
      mode: config.mode ?? currentConfig.mode,
      level: config.level ?? currentConfig.level,
    });
  }

  if (originalAudioContext) {
    window.AudioContext =
      patchAudioContext(originalAudioContext) ?? originalAudioContext;
  }
  if (originalWebkitAudioContext) {
    window.webkitAudioContext =
      patchAudioContext(originalWebkitAudioContext) ??
      originalWebkitAudioContext;
  }

  globalThis.Muta7HearingSimulatorModule = {
    enable,
    disable,
    update,
  };
})();

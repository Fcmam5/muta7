(() => {
  const STYLE_ID = "muta7-dyslexia-style";
  const OVERLAY_ID = "muta7-dyslexia-overlay";
  const WORD_CLASS = "m7-dyslexia-word";
  const NUMBER_CLASS = "m7-dyslexia-number";
  const SCRAMBLED_CLASS = "m7-dyslexia-scrambled";
  const DATA_ORIGINAL = "m7Original";
  const DATA_WRAPPED = "m7Wrapped";

  const EXCLUDED_SELECTOR = [
    "script",
    "style",
    "noscript",
    "textarea",
    "input",
    "select",
    "button",
    "code",
    "pre",
    "kbd",
    "samp",
    "svg",
    "math",
    "[contenteditable]",
    "a",
    "[role='button']",
    "[data-muta7-no-dyslexia]",
  ].join(",");

  const FUNCTION_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "then",
    "there",
    "these",
    "they",
    "this",
    "to",
    "was",
    "we",
    "were",
    "will",
    "with",
    "you",
    "your",
  ]);

  const LEVEL_PRESETS = {
    mild: {
      amplitudePx: 0.3,
      cycleMs: 5600,
      scramblePerMinute: 0,
      blurMinPx: 0.3,
      blurMaxPx: 0.44,
      pulseIntervalMinSec: 35,
      pulseIntervalMaxSec: 55,
      pulseDurationMinMs: 120,
      pulseDurationMaxMs: 170,
    },
    moderate: {
      amplitudePx: 0.6,
      cycleMs: 4400,
      scramblePerMinute: [12, 21],
      scrambleMinGapMs: 1900,
      blurMinPx: 0.38,
      blurMaxPx: 0.54,
      pulseIntervalMinSec: 20,
      pulseIntervalMaxSec: 40,
      pulseDurationMinMs: 150,
      pulseDurationMaxMs: 200,
    },
    severe: {
      amplitudePx: 1,
      cycleMs: 3200,
      scramblePerMinute: [27, 42],
      scrambleMinGapMs: 850,
      blurMinPx: 0.46,
      blurMaxPx: 0.66,
      pulseIntervalMinSec: 16,
      pulseIntervalMaxSec: 30,
      pulseDurationMinMs: 170,
      pulseDurationMaxMs: 230,
    },
  };

  let styleEl = null;
  let overlayEl = null;
  let observer = null;
  let scrambleTimer = null;
  let pulseTimer = null;
  let pulseEndTimer = null;
  let isProcessing = false;
  let rafPending = false;
  let pointerX = window.innerWidth * 0.5;
  let pointerY = window.innerHeight * 0.35;
  let bodyReadyListenerAttached = false;
  let lastScrambleAt = 0;
  let lastScrambledSpan = null;

  let config = {
    level: "moderate",
    spotlightEnabled: true,
    scramblingEnabled: true,
  };

  let measureCanvas = null;
  let measureCtx = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function normalizeConfig(input = {}) {
    const requestedLevel = String(input.level ?? "moderate").toLowerCase();
    const level = LEVEL_PRESETS[requestedLevel] ? requestedLevel : "moderate";
    return {
      level,
      spotlightEnabled:
        input.spotlightEnabled === undefined
          ? true
          : Boolean(input.spotlightEnabled),
      scramblingEnabled:
        input.scramblingEnabled === undefined
          ? true
          : Boolean(input.scramblingEnabled),
    };
  }

  function ensureMeasureContext() {
    if (measureCtx) return measureCtx;
    measureCanvas = document.createElement("canvas");
    measureCtx = measureCanvas.getContext("2d");
    return measureCtx;
  }

  function ensureStyle() {
    if (styleEl) return;
    styleEl = document.getElementById(STYLE_ID);
    if (styleEl) return;

    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      .${WORD_CLASS} {
        display: inline-block;
        transform-origin: center center;
        will-change: transform;
        animation-name: m7-dyslexia-jitter;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        animation-direction: alternate;
        animation-duration: var(--m7-dx-cycle, 4200ms);
        animation-delay: var(--m7-dx-delay, 0ms);
        --m7-dx-amp: var(--m7-dx-base-amp, 0.6px);
      }

      .${WORD_CLASS}.${NUMBER_CLASS} {
        --m7-dx-amp: calc(var(--m7-dx-base-amp, 0.6px) * 1.35);
      }

      @keyframes m7-dyslexia-jitter {
        0% {
          transform: translate3d(calc(var(--m7-dx-amp) * -0.12), calc(var(--m7-dx-amp) * 0.06), 0) rotate(-0.08deg);
        }
        24% {
          transform: translate3d(calc(var(--m7-dx-amp) * 0.32), calc(var(--m7-dx-amp) * -0.2), 0) rotate(0.16deg);
        }
        50% {
          transform: translate3d(calc(var(--m7-dx-amp) * -0.24), calc(var(--m7-dx-amp) * 0.18), 0) rotate(-0.12deg);
        }
        78% {
          transform: translate3d(calc(var(--m7-dx-amp) * 0.2), calc(var(--m7-dx-amp) * 0.12), 0) rotate(0.1deg);
        }
        100% {
          transform: translate3d(calc(var(--m7-dx-amp) * -0.1), calc(var(--m7-dx-amp) * -0.08), 0) rotate(-0.06deg);
        }
      }

      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483645;
        background: rgba(255, 255, 255, 0.001);
        --m7-dx-overlay-x: 50vw;
        --m7-dx-overlay-y: 35vh;
        --m7-dx-overlay-radius: 220px;
        --m7-dx-overlay-blur: 0.5px;
        backdrop-filter: blur(var(--m7-dx-overlay-blur));
        -webkit-backdrop-filter: blur(var(--m7-dx-overlay-blur));
        mask-image: radial-gradient(
          circle var(--m7-dx-overlay-radius) at var(--m7-dx-overlay-x) var(--m7-dx-overlay-y),
          transparent 0,
          transparent calc(var(--m7-dx-overlay-radius) - 10px),
          black calc(var(--m7-dx-overlay-radius) + 28px)
        );
        -webkit-mask-image: radial-gradient(
          circle var(--m7-dx-overlay-radius) at var(--m7-dx-overlay-x) var(--m7-dx-overlay-y),
          transparent 0,
          transparent calc(var(--m7-dx-overlay-radius) - 10px),
          black calc(var(--m7-dx-overlay-radius) + 28px)
        );
      }

      #${OVERLAY_ID}.m7-dx-no-spotlight {
        mask-image: none;
        -webkit-mask-image: none;
      }

      @media (prefers-reduced-motion: reduce) {
        .${WORD_CLASS} {
          animation-duration: 7000ms;
        }
      }
    `;
    document.documentElement.appendChild(styleEl);
  }

  function shouldSkipTextNode(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest(EXCLUDED_SELECTOR)) return true;
    if (parent.closest(`.${WORD_CLASS}`)) return true;
    if (parent.closest("[aria-hidden='true']")) return true;
    return false;
  }

  function isWordToken(token) {
    return /^\p{L}[\p{L}'’-]*$/u.test(token);
  }

  function isLongNumberToken(token) {
    return /^\d{5,}$/.test(token);
  }

  function shouldWrapWord(token) {
    if (!isWordToken(token)) return false;
    if (token.length < 4) return false;
    if (/^[A-Z]{2,4}$/.test(token)) return false;
    const normalized = token.toLowerCase();
    return !FUNCTION_WORDS.has(normalized);
  }

  function createWordSpan(token, isNumber = false) {
    const span = document.createElement("span");
    span.className = isNumber ? `${WORD_CLASS} ${NUMBER_CLASS}` : WORD_CLASS;
    span.dataset[DATA_ORIGINAL] = token;
    span.dataset[DATA_WRAPPED] = "1";
    span.textContent = token;
    return span;
  }

  function processTextNode(node) {
    if (!node || !node.nodeValue || shouldSkipTextNode(node)) return;

    const source = node.nodeValue;
    const tokens = source.split(/(\s+)/);
    if (tokens.length <= 1) return;

    let changed = false;
    const fragment = document.createDocumentFragment();

    for (const token of tokens) {
      if (!token) continue;
      if (/^\s+$/.test(token)) {
        fragment.appendChild(document.createTextNode(token));
        continue;
      }

      if (shouldWrapWord(token)) {
        fragment.appendChild(createWordSpan(token));
        changed = true;
        continue;
      }

      if (isLongNumberToken(token)) {
        fragment.appendChild(createWordSpan(token, true));
        changed = true;
        continue;
      }

      fragment.appendChild(document.createTextNode(token));
    }

    if (!changed) return;

    isProcessing = true;
    node.replaceWith(fragment);
    isProcessing = false;
  }

  function processSubtree(root) {
    if (!root || !document.body) return;

    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.closest(EXCLUDED_SELECTOR)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets = [];
    let current = walker.nextNode();
    while (current) {
      targets.push(current);
      current = walker.nextNode();
    }

    for (const textNode of targets) {
      processTextNode(textNode);
    }
  }

  function randomizeWordAnimation() {
    const preset = LEVEL_PRESETS[config.level] ?? LEVEL_PRESETS.moderate;
    const words = document.querySelectorAll(`.${WORD_CLASS}`);
    const baseAmplitude = preset.amplitudePx;

    words.forEach((word) => {
      const perWordScale = randomBetween(0.78, 1.22);
      word.style.setProperty(
        "--m7-dx-base-amp",
        `${(baseAmplitude * perWordScale).toFixed(3)}px`,
      );
      word.style.setProperty(
        "--m7-dx-cycle",
        `${Math.round(randomBetween(preset.cycleMs * 0.85, preset.cycleMs * 1.15))}ms`,
      );
      word.style.setProperty(
        "--m7-dx-delay",
        `-${Math.round(randomBetween(0, preset.cycleMs))}ms`,
      );
    });
  }

  function ensureOverlay() {
    if (overlayEl && overlayEl.isConnected) return;
    overlayEl = document.getElementById(OVERLAY_ID);
    if (!overlayEl) {
      overlayEl = document.createElement("div");
      overlayEl.id = OVERLAY_ID;
      document.documentElement.appendChild(overlayEl);
    }
    updateOverlayFromConfig();
    updateOverlayPosition();
  }

  function updateOverlayFromConfig() {
    if (!overlayEl) return;
    const preset = LEVEL_PRESETS[config.level] ?? LEVEL_PRESETS.moderate;
    overlayEl.classList.toggle("m7-dx-no-spotlight", !config.spotlightEnabled);
    overlayEl.style.setProperty(
      "--m7-dx-overlay-radius",
      config.spotlightEnabled ? "220px" : "0px",
    );
    overlayEl.style.setProperty(
      "--m7-dx-overlay-blur",
      `${preset.blurMinPx.toFixed(2)}px`,
    );
  }

  function updateOverlayPosition() {
    rafPending = false;
    if (!overlayEl || !config.spotlightEnabled) return;
    overlayEl.style.setProperty(
      "--m7-dx-overlay-x",
      `${pointerX.toFixed(1)}px`,
    );
    overlayEl.style.setProperty(
      "--m7-dx-overlay-y",
      `${pointerY.toFixed(1)}px`,
    );
  }

  function onPointerMove(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(updateOverlayPosition);
  }

  function clearTimers() {
    clearTimeout(scrambleTimer);
    clearTimeout(pulseTimer);
    clearTimeout(pulseEndTimer);
    scrambleTimer = null;
    pulseTimer = null;
    pulseEndTimer = null;
  }

  function getReadableLetterIndexes(word) {
    const indexes = [];
    for (let i = 1; i < word.length - 1; i += 1) {
      if (/\p{L}/u.test(word[i])) indexes.push(i);
    }
    return indexes;
  }

  function scrambleInternalLetters(word) {
    if (word.length < 4) return word;
    const indexes = getReadableLetterIndexes(word);
    if (indexes.length < 2) return word;

    const firstIndex = indexes[Math.floor(Math.random() * indexes.length)];
    let secondIndex = firstIndex;
    let safety = 0;
    while (secondIndex === firstIndex && safety < 8) {
      const offset = Math.random() < 0.7 ? 1 : 2;
      const direction = Math.random() < 0.5 ? -1 : 1;
      const candidate = firstIndex + offset * direction;
      secondIndex = indexes.includes(candidate)
        ? candidate
        : indexes[Math.floor(Math.random() * indexes.length)];
      safety += 1;
    }

    if (secondIndex === firstIndex) return word;

    const chars = word.split("");
    const temp = chars[firstIndex];
    chars[firstIndex] = chars[secondIndex];
    chars[secondIndex] = temp;
    return chars.join("");
  }

  function scrambleInternalDigits(numberToken) {
    if (!/^\d{5,}$/.test(numberToken)) return numberToken;

    const indexes = [];
    for (let i = 1; i < numberToken.length - 1; i += 1) {
      if (/\d/.test(numberToken[i])) indexes.push(i);
    }
    if (indexes.length < 2) return numberToken;

    const firstIndex = indexes[Math.floor(Math.random() * indexes.length)];
    let secondIndex = firstIndex;
    let safety = 0;
    while (secondIndex === firstIndex && safety < 8) {
      secondIndex = indexes[Math.floor(Math.random() * indexes.length)];
      safety += 1;
    }
    if (secondIndex === firstIndex) return numberToken;

    const chars = numberToken.split("");
    const temp = chars[firstIndex];
    chars[firstIndex] = chars[secondIndex];
    chars[secondIndex] = temp;
    return chars.join("");
  }

  function isWidthSafe(span, originalWord, scrambledWord) {
    const ctx = ensureMeasureContext();
    if (!ctx) return true;

    const computed = window.getComputedStyle(span);
    ctx.font = computed.font;
    const originalWidth = ctx.measureText(originalWord).width;
    if (!originalWidth) return true;
    const scrambledWidth = ctx.measureText(scrambledWord).width;
    const delta = Math.abs(scrambledWidth - originalWidth) / originalWidth;
    return delta <= 0.03;
  }

  function getScrambleContextLength(span) {
    if (!span) return 0;
    const context =
      span.closest("p, li, blockquote, article, section") ??
      span.closest("div") ??
      span.parentElement;
    if (!context) return 0;

    const rawText = context.innerText || context.textContent || "";
    return rawText.replace(/\s+/g, " ").trim().length;
  }

  function getContextScrambleWeight(contextLength) {
    if (contextLength >= 700) return 3;
    if (contextLength >= 420) return 2.3;
    if (contextLength >= 220) return 1.6;
    if (contextLength >= 120) return 1;
    if (contextLength >= 60) return 0.45;
    return 0.15;
  }

  function getNumberPriorityMultiplier() {
    if (config.level === "severe") return 2.1;
    if (config.level === "moderate") return 1.55;
    return 1;
  }

  function pickScrambleCandidate() {
    const includeNumbers = config.level !== "mild";
    const words = Array.from(
      document.querySelectorAll(`.${WORD_CLASS}:not(.${SCRAMBLED_CLASS})`),
    );

    const candidates = words.filter((word) => {
      const original = word.dataset[DATA_ORIGINAL] ?? word.textContent ?? "";
      const isNumber = word.classList.contains(NUMBER_CLASS);
      if (isNumber) {
        if (!includeNumbers) return false;
        if (!isLongNumberToken(original)) return false;
      }

      if (original.length < 5) return false;
      if (!isNumber && !shouldWrapWord(original)) return false;
      const rect = word.getBoundingClientRect();
      return rect.bottom >= 0 && rect.top <= window.innerHeight;
    });

    if (!candidates.length) return null;

    let pool = candidates;
    if (candidates.length > 1 && lastScrambledSpan?.isConnected) {
      const nonRepeated = candidates.filter(
        (candidate) => candidate !== lastScrambledSpan,
      );
      if (nonRepeated.length > 0) {
        pool = nonRepeated;
      }
    }

    const weightedPool = pool.map((candidate) => {
      const contextLength = getScrambleContextLength(candidate);
      const isNumber = candidate.classList.contains(NUMBER_CLASS);
      const numberBoost = isNumber ? getNumberPriorityMultiplier() : 1;
      return {
        candidate,
        weight: getContextScrambleWeight(contextLength) * numberBoost,
      };
    });

    const totalWeight = weightedPool.reduce(
      (sum, item) => sum + item.weight,
      0,
    );
    if (totalWeight <= 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }

    let pick = Math.random() * totalWeight;
    for (const item of weightedPool) {
      pick -= item.weight;
      if (pick <= 0) return item.candidate;
    }

    return weightedPool[weightedPool.length - 1]?.candidate ?? null;
  }

  function triggerScrambleOnce() {
    const preset = LEVEL_PRESETS[config.level] ?? LEVEL_PRESETS.moderate;
    if (!config.scramblingEnabled || !preset.scramblePerMinute) return false;

    const span = pickScrambleCandidate();
    if (!span) return false;

    const isNumberCandidate = span.classList.contains(NUMBER_CLASS);
    if (isNumberCandidate && config.level === "mild") return false;

    const contextLength = getScrambleContextLength(span);
    if (!isNumberCandidate) {
      if (contextLength < 60 && Math.random() < 0.82) return false;
      if (contextLength < 120 && Math.random() < 0.55) return false;
    }

    const originalWord = span.dataset[DATA_ORIGINAL] ?? span.textContent ?? "";
    const scrambledWord = isNumberCandidate
      ? scrambleInternalDigits(originalWord)
      : scrambleInternalLetters(originalWord);
    if (scrambledWord === originalWord) return false;
    if (!isWidthSafe(span, originalWord, scrambledWord)) return false;

    span.classList.add(SCRAMBLED_CLASS);
    span.textContent = scrambledWord;
    lastScrambleAt = Date.now();
    lastScrambledSpan = span;

    const revertInMs = Math.round(randomBetween(300, 800));
    window.setTimeout(() => {
      if (!span.isConnected) return;
      span.textContent = span.dataset[DATA_ORIGINAL] ?? originalWord;
      span.classList.remove(SCRAMBLED_CLASS);
    }, revertInMs);

    return true;
  }

  function getNextScrambleDelay({ retry = false } = {}) {
    const preset = LEVEL_PRESETS[config.level] ?? LEVEL_PRESETS.moderate;
    if (retry) {
      return Math.round(randomBetween(1800, 3600));
    }

    const [minRate, maxRate] = preset.scramblePerMinute;
    const targetPerMinute = randomBetween(minRate, maxRate);
    const baseDelayMs = 60_000 / Math.max(0.1, targetPerMinute);
    const jitteredDelayMs = baseDelayMs * randomBetween(0.92, 1.12);
    const minGapMs = preset.scrambleMinGapMs ?? 0;

    let nextDelayMs = Math.max(jitteredDelayMs, minGapMs);
    if (minGapMs > 0 && lastScrambleAt > 0) {
      const elapsed = Date.now() - lastScrambleAt;
      if (elapsed < minGapMs) {
        nextDelayMs = Math.max(
          nextDelayMs,
          minGapMs - elapsed + randomBetween(300, 900),
        );
      }
    }

    return Math.round(nextDelayMs);
  }

  function scheduleNextScramble({ retry = false } = {}) {
    clearTimeout(scrambleTimer);

    const preset = LEVEL_PRESETS[config.level] ?? LEVEL_PRESETS.moderate;
    if (!config.scramblingEnabled || !preset.scramblePerMinute) return;

    const nextInMs = getNextScrambleDelay({ retry });

    scrambleTimer = window.setTimeout(() => {
      const didScramble = triggerScrambleOnce();
      scheduleNextScramble({ retry: !didScramble });
    }, nextInMs);
  }

  function pulseFocusDrop() {
    const preset = LEVEL_PRESETS[config.level] ?? LEVEL_PRESETS.moderate;
    if (!overlayEl) return;

    const pulseBlur = randomBetween(
      preset.blurMaxPx - 0.04,
      preset.blurMaxPx + 0.08,
    );
    const pulseDuration = Math.round(
      randomBetween(preset.pulseDurationMinMs, preset.pulseDurationMaxMs),
    );

    overlayEl.style.setProperty(
      "--m7-dx-overlay-blur",
      `${pulseBlur.toFixed(2)}px`,
    );

    clearTimeout(pulseEndTimer);
    pulseEndTimer = window.setTimeout(() => {
      if (!overlayEl) return;
      overlayEl.style.setProperty(
        "--m7-dx-overlay-blur",
        `${preset.blurMinPx.toFixed(2)}px`,
      );
    }, pulseDuration);
  }

  function scheduleFocusPulse() {
    clearTimeout(pulseTimer);

    const preset = LEVEL_PRESETS[config.level] ?? LEVEL_PRESETS.moderate;
    const nextInMs = Math.round(
      randomBetween(preset.pulseIntervalMinSec, preset.pulseIntervalMaxSec) *
        1000,
    );

    pulseTimer = window.setTimeout(() => {
      pulseFocusDrop();
      scheduleFocusPulse();
    }, nextInMs);
  }

  function startObserver() {
    if (observer || !document.body) return;

    observer = new MutationObserver((mutations) => {
      if (isProcessing) return;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          processTextNode(mutation.target);
          continue;
        }

        for (const addedNode of mutation.addedNodes) {
          processSubtree(addedNode);
        }
      }

      randomizeWordAnimation();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function stopObserver() {
    observer?.disconnect();
    observer = null;
  }

  function unwrapWords() {
    const wrappedWords = document.querySelectorAll(`.${WORD_CLASS}`);
    wrappedWords.forEach((span) => {
      const original = span.dataset[DATA_ORIGINAL] ?? span.textContent ?? "";
      span.replaceWith(document.createTextNode(original));
    });
  }

  function enable(configInput = {}) {
    config = normalizeConfig(configInput);

    ensureStyle();
    ensureOverlay();

    if (!document.body) {
      if (!bodyReadyListenerAttached) {
        bodyReadyListenerAttached = true;
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            bodyReadyListenerAttached = false;
            enable(config);
          },
          { once: true },
        );
      }
      return;
    }

    processSubtree(document.body);
    randomizeWordAnimation();
    startObserver();

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    scheduleNextScramble();
    scheduleFocusPulse();
  }

  function disable() {
    clearTimers();
    stopObserver();
    window.removeEventListener("pointermove", onPointerMove);

    unwrapWords();

    overlayEl?.remove();
    overlayEl = null;
  }

  function update(newConfig = {}) {
    config = normalizeConfig({ ...config, ...newConfig });
    enable(config);
    updateOverlayFromConfig();
    randomizeWordAnimation();
    scheduleNextScramble();
    scheduleFocusPulse();
  }

  globalThis.Muta7CognitiveDyslexiaModule = {
    enable,
    disable,
    update,
  };
})();

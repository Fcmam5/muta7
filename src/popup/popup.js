// Main navigation functionality
const navButtons = document.querySelectorAll(".nav-button");
const pagePanels = document.querySelectorAll(".page-panel");

function switchPage(pageName) {
  // Update nav buttons
  navButtons.forEach((button) => {
    const isActive = button.dataset.page === pageName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive);
  });

  // Update page panels
  pagePanels.forEach((panel) => {
    const isActive = panel.id === `${pageName}-page`;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });
}

// Add main navigation event listeners
navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    switchPage(button.dataset.page);
  });
});

// Tab navigation functionality (for disabilities page)
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");

function switchDisabilityTab(tabName) {
  // Update tab buttons
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive);
  });

  // Update tab panels
  tabPanels.forEach((panel) => {
    const isActive = panel.id === `${tabName}-panel`;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });
}

// Add tab switching event listeners
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    switchDisabilityTab(button.dataset.tab);
  });
});

// Preset functionality
const presetCards = document.querySelectorAll(".preset-card");

const PRESETS = {
  elderly: {
    blur: { enabled: true, intensity: 40 },
    colorBlindness: { enabled: false, mode: "none" },
    motor: { mode: "mouse" },
    hearing: { mode: "hard", level: 70 },
  },
  colorblind: {
    blur: { enabled: false, intensity: 0 },
    colorBlindness: { enabled: true, mode: "deuteranopia" },
    motor: { mode: "none" },
    hearing: { mode: "none", level: 60 },
  },
  "motor-impaired": {
    blur: { enabled: false, intensity: 0 },
    colorBlindness: { enabled: false, mode: "none" },
    motor: { mode: "full" },
    hearing: { mode: "none", level: 60 },
  },
  "low-vision": {
    blur: { enabled: true, intensity: 70 },
    colorBlindness: { enabled: false, mode: "none" },
    motor: { mode: "none" },
    hearing: { mode: "none", level: 60 },
  },
  deaf: {
    blur: { enabled: false, intensity: 0 },
    colorBlindness: { enabled: false, mode: "none" },
    motor: { mode: "none" },
    hearing: { mode: "deaf", level: 60 },
  },
  adhd: {
    blur: { enabled: false, intensity: 0 },
    colorBlindness: { enabled: false, mode: "none" },
    motor: { mode: "none" },
    hearing: { mode: "none", level: 60 },
  },
};

function applyPreset(presetName) {
  const preset = PRESETS[presetName];
  if (!preset) return;

  // Update UI based on preset
  blurEnabledEl.checked = preset.blur.enabled;
  blurIntensityEl.value = preset.blur.intensity;
  blurIntensityValueEl.value = preset.blur.intensity;

  colorEnabledEl.checked = preset.colorBlindness.enabled;
  colorModeEl.value = preset.colorBlindness.mode;
  colorModeEl.disabled = !preset.colorBlindness.enabled;

  setMotorUiFromMode(preset.motor.mode);
  applyMotorFeatureUi();

  hearingModeEl.value = preset.hearing.mode;
  hearingLevelEl.value = preset.hearing.level;
  hearingLevelValueEl.value = preset.hearing.level;
  hearingLevelEl.disabled = preset.hearing.mode !== "hard";

  // Update visual state
  updateReminderBanner();

  // Send updates to background
  Promise.all([
    sendBlurUpdate(),
    sendColorUpdate(),
    sendMotorUpdate(),
    sendMotorJitterUpdate(),
    sendHearingUpdate(),
  ]);

  markNeedsRefresh();

  // Update preset card visual state
  presetCards.forEach((card) => {
    card.classList.toggle("active", card.dataset.preset === presetName);
  });
}

// Add preset event listeners
presetCards.forEach((card) => {
  card.addEventListener("click", () => {
    applyPreset(card.dataset.preset);
  });
});

// Original element references
const blurEnabledEl = document.getElementById("blur-enabled");
const blurIntensityEl = document.getElementById("blur-intensity");
const blurIntensityValueEl = document.getElementById("blur-intensity-value");
const colorEnabledEl = document.getElementById("color-blindness-enabled");
const colorModeEl = document.getElementById("color-blindness-mode");
const motorBlockMouseEl = document.getElementById("motor-block-mouse");
const motorBlockTouchEl = document.getElementById("motor-block-touch");
const motorBlockKeyboardEl = document.getElementById("motor-block-keyboard");
const motorJitterEnabledEl = document.getElementById("motor-jitter-enabled");
const motorJitterLevelInputs = document.querySelectorAll(
  'input[name="motor-jitter-level"]',
);
const hearingModeEl = document.getElementById("hearing-mode");
const hearingLevelEl = document.getElementById("hearing-level");
const hearingLevelValueEl = document.getElementById("hearing-level-value");
const settingsReminderEl = document.getElementById("settings-reminder");
const resetReminderEl = document.getElementById("reset-reminder");
const enableCurrentSiteEl = document.getElementById("enable-current-site");
const allowedUrlsEl = document.getElementById("allowed-urls");
const refreshNoticeEl = document.getElementById("refresh-notice");
const refreshPageEl = document.getElementById("refresh-page");
const resetAllEl = document.getElementById("reset-all");
const resetAllDisabilitiesEl = document.getElementById(
  "reset-all-disabilities",
);
const resetAllScopeEl = document.getElementById("reset-all-scope");

// Badge elements
const disabilitiesCountEl = document.getElementById("disabilities-count");
const scopeIndicatorEl = document.getElementById("scope-indicator");

// Individual disability badge elements
const visualCountEl = document.getElementById("visual-count");
const motorCountEl = document.getElementById("motor-count");
const hearingCountEl = document.getElementById("hearing-count");
const cognitiveIndicatorEl = document.getElementById("cognitive-indicator");

let activeTabId = null;
let activeTabUrl = "";
let needsRefresh = false;
let syncedState = {};

const COLOR_MODES = [
  "none",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "monochromacy",
];

const MOTOR_MODES = [
  "none",
  "mouse",
  "touch",
  "keyboard",
  "mouse-touch",
  "mouse-keyboard",
  "touch-keyboard",
];

const MOTOR_JITTER_LEVELS = {
  low: { magnitudePx: 4, frequencyHz: 4 },
  medium: { magnitudePx: 9, frequencyHz: 6 },
  high: { magnitudePx: 15, frequencyHz: 9 },
};

const DEFAULT_MOTOR_JITTER_STATE = {
  enabled: false,
  level: "low",
  magnitudePx: MOTOR_JITTER_LEVELS.low.magnitudePx,
  frequencyHz: MOTOR_JITTER_LEVELS.low.frequencyHz,
};

function normalizeColorMode(mode) {
  const normalized = String(mode ?? "none").toLowerCase();
  if (!COLOR_MODES.includes(normalized)) return "none";
  return normalized;
}

function normalizeMotorMode(mode) {
  const normalized = String(mode ?? "none").toLowerCase();
  if (!MOTOR_MODES.includes(normalized)) return "none";
  return normalized;
}

function normalizeMotorJitterLevel(level) {
  const normalized = String(level ?? "low").toLowerCase();
  if (!Object.keys(MOTOR_JITTER_LEVELS).includes(normalized)) {
    return "low";
  }
  return normalized;
}

function clampNumber(value, min, max, fallback = min) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function getCheckedRadioValue(nodeList, fallback) {
  for (const input of nodeList ?? []) {
    if (input?.checked) {
      return input.value;
    }
  }
  return fallback;
}

function setRadioGroupValue(nodeList, value) {
  const normalizedValue = String(value ?? "");
  for (const input of nodeList ?? []) {
    input.checked = input.value === normalizedValue;
  }
}

function getMotorFlagsFromMode(mode) {
  const normalizedMode = normalizeMotorMode(mode);

  if (normalizedMode === "mouse") {
    return { blockMouse: true, blockTouch: false, blockKeyboard: false };
  }

  if (normalizedMode === "touch") {
    return { blockMouse: false, blockTouch: true, blockKeyboard: false };
  }

  if (normalizedMode === "keyboard") {
    return { blockMouse: false, blockTouch: false, blockKeyboard: true };
  }

  if (normalizedMode === "mouse-touch") {
    return { blockMouse: true, blockTouch: true, blockKeyboard: false };
  }

  if (normalizedMode === "mouse-keyboard") {
    return { blockMouse: true, blockTouch: false, blockKeyboard: true };
  }

  if (normalizedMode === "touch-keyboard") {
    return { blockMouse: false, blockTouch: true, blockKeyboard: true };
  }

  if (normalizedMode === "full") {
    return { blockMouse: true, blockTouch: true, blockKeyboard: true };
  }

  return { blockMouse: false, blockTouch: false, blockKeyboard: false };
}

function getMotorModeFromFlags({
  blockMouse = false,
  blockTouch = false,
  blockKeyboard = false,
} = {}) {
  const mouse = Boolean(blockMouse);
  const touch = Boolean(blockTouch);
  const keyboard = Boolean(blockKeyboard);

  if (mouse && touch && keyboard) return "full";
  if (mouse && touch) return "mouse-touch";
  if (mouse && keyboard) return "mouse-keyboard";
  if (touch && keyboard) return "touch-keyboard";
  if (mouse) return "mouse";
  if (touch) return "touch";
  if (keyboard) return "keyboard";
  return "none";
}

function setMotorUiFromMode(mode) {
  const flags = getMotorFlagsFromMode(mode);
  if (motorBlockMouseEl) motorBlockMouseEl.checked = flags.blockMouse;
  if (motorBlockTouchEl) motorBlockTouchEl.checked = flags.blockTouch;
  if (motorBlockKeyboardEl) motorBlockKeyboardEl.checked = flags.blockKeyboard;
}

function applyMotorFeatureUi({ jitter = DEFAULT_MOTOR_JITTER_STATE } = {}) {
  const jitterState = {
    ...DEFAULT_MOTOR_JITTER_STATE,
    ...jitter,
    level: normalizeMotorJitterLevel(
      jitter.level ?? DEFAULT_MOTOR_JITTER_STATE.level,
    ),
  };

  motorJitterEnabledEl.checked = Boolean(jitterState.enabled);
  setRadioGroupValue(motorJitterLevelInputs, jitterState.level);
}

function sendHearingUpdate() {
  return new Promise(async (resolve) => {
    const tabId = activeTabId ?? (await getActiveTabId());
    const simulator = currentHearingStateFromUi();

    chrome.runtime.sendMessage(
      {
        type: "SET_HEARING_STATE",
        tabId,
        simulator,
      },
      () => resolve(),
    );
  });
}

function updateReminderBanner() {
  // Debug: Check actual UI element values
  console.log("UI element states:", {
    blurChecked: blurEnabledEl?.checked,
    blurValue: blurEnabledEl?.value,
    colorChecked: colorEnabledEl?.checked,
    colorValue: colorEnabledEl?.value,
    motorBlocker: currentMotorBlockerFromUi()?.mode,
    motorJitter: motorJitterEnabledEl?.checked,
    hearingValue: hearingModeEl?.value,
    hearingLevelValue: hearingLevelEl?.value,
  });

  const motorActive = isMotorSimulationActive();
  const hearingActive = hearingModeEl?.value !== "none";
  const anyEnabled =
    blurEnabledEl?.checked ||
    false ||
    colorEnabledEl?.checked ||
    false ||
    motorActive ||
    hearingActive;

  console.log("Reminder banner check:", {
    blurEnabled: blurEnabledEl?.checked,
    colorEnabled: colorEnabledEl?.checked,
    motorActive: motorActive,
    hearingActive: hearingActive,
    anyEnabled: anyEnabled,
  });

  if (settingsReminderEl) {
    const shouldHide = !anyEnabled;
    settingsReminderEl.hidden = shouldHide;
    console.log("Setting reminder banner hidden:", shouldHide);

    // Also check the actual display state
    setTimeout(() => {
      console.log(
        "Banner actual hidden state after timeout:",
        settingsReminderEl.hidden,
      );
      console.log(
        "Banner display style:",
        window.getComputedStyle(settingsReminderEl).display,
      );
    }, 100);
  }

  // Update disabilities count badge
  updateDisabilitiesBadge();
}

function updateDisabilitiesBadge() {
  let activeCount = 0;

  if (blurEnabledEl?.checked) activeCount++;
  if (colorEnabledEl?.checked) activeCount++;
  if (isMotorSimulationActive()) activeCount++;
  if (hearingModeEl?.value !== "none") activeCount++;

  if (activeCount > 0 && disabilitiesCountEl) {
    disabilitiesCountEl.textContent = activeCount;
    disabilitiesCountEl.classList.remove("hidden");
  } else if (disabilitiesCountEl) {
    disabilitiesCountEl.classList.add("hidden");
  }

  // Update individual disability badges
  updateIndividualDisabilityBadges();
}

function updateIndividualDisabilityBadges() {
  // Visual disabilities (blur + color blindness)
  const visualCount =
    (blurEnabledEl.checked ? 1 : 0) + (colorEnabledEl.checked ? 1 : 0);
  if (visualCount > 0 && visualCountEl) {
    visualCountEl.textContent = visualCount;
    visualCountEl.classList.remove("hidden");
  } else if (visualCountEl) {
    visualCountEl.classList.add("hidden");
  }

  // Motor disabilities
  if (isMotorSimulationActive() && motorCountEl) {
    motorCountEl.textContent = "1";
    motorCountEl.classList.remove("hidden");
  } else if (motorCountEl) {
    motorCountEl.classList.add("hidden");
  }

  // Hearing disabilities
  if (hearingModeEl.value !== "none" && hearingCountEl) {
    hearingCountEl.textContent = "1";
    hearingCountEl.classList.remove("hidden");
  } else if (hearingCountEl) {
    hearingCountEl.classList.add("hidden");
  }

  // Cognitive (always show indicator for future features)
  // For now, keep it hidden since cognitive features aren't implemented yet
  if (cognitiveIndicatorEl) {
    cognitiveIndicatorEl.classList.add("hidden");
  }
}

function updateScopeBadge() {
  const urls = parseAllowedUrlsInput(allowedUrlsEl.value);
  if (urls.length > 0 && scopeIndicatorEl) {
    scopeIndicatorEl.classList.remove("hidden");
  } else if (scopeIndicatorEl) {
    scopeIndicatorEl.classList.add("hidden");
  }
}

function showRefreshNotice(show) {
  needsRefresh = show;
  refreshNoticeEl.hidden = !show;
}

function markNeedsRefresh() {
  showRefreshNotice(true);
}

function applySyncedState(state) {
  syncedState = state ?? {};
  setUi(syncedState);
  showRefreshNotice(false);
}

function readBlurFromState(state) {
  return state?.visual?.blur ?? { enabled: false, intensity: 0 };
}

function readColorFromState(state) {
  const fallback = { enabled: false, mode: "none" };
  const incoming = state?.visual?.colorBlindness ?? fallback;
  const mode = normalizeColorMode(incoming.mode);
  const enabled = Boolean(incoming.enabled) && mode !== "none";
  return { enabled, mode };
}

function readScopeFromState(state) {
  return state?.scope ?? { allowedUrls: [] };
}

function readMotorJitterFromState(state) {
  const incoming = state?.motor?.jitter ?? {};
  const level = normalizeMotorJitterLevel(incoming.level);
  const fallback = MOTOR_JITTER_LEVELS[level] ?? MOTOR_JITTER_LEVELS.low;
  return {
    enabled: Boolean(incoming.enabled),
    level,
    magnitudePx: clampNumber(incoming.magnitudePx, 1, 25, fallback.magnitudePx),
    frequencyHz: clampNumber(incoming.frequencyHz, 1, 20, fallback.frequencyHz),
  };
}

function parseAllowedUrlsInput(value) {
  const lines = value
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);

  return Array.from(new Set(lines));
}

function setScopeUi(scope) {
  const urls = Array.isArray(scope.allowedUrls) ? scope.allowedUrls : [];
  allowedUrlsEl.value = urls.join("\n");
}

function setUi(state) {
  const blur = readBlurFromState(state);
  const color = readColorFromState(state);
  const motorMode = normalizeMotorMode(state?.motor?.blocker?.mode);
  const motorJitter = readMotorJitterFromState(state);
  const hearingMode = state?.hearing?.simulator?.mode ?? "none";
  const hearingLevel = Number(state?.hearing?.simulator?.level ?? 60);
  const scope = readScopeFromState(state);
  const intensity = Math.max(0, Math.min(100, Number(blur.intensity) || 0));
  blurEnabledEl.checked = Boolean(blur.enabled);
  blurIntensityEl.value = String(intensity);
  blurIntensityValueEl.value = String(intensity);
  colorEnabledEl.checked = Boolean(color.enabled);
  colorModeEl.value = normalizeColorMode(color.mode);
  colorModeEl.disabled = !colorEnabledEl.checked;
  setMotorUiFromMode(motorMode);
  applyMotorFeatureUi({
    jitter: motorJitter,
  });
  hearingModeEl.value = hearingMode;
  hearingLevelEl.value = String(hearingLevel);
  hearingLevelValueEl.value = String(hearingLevel);
  hearingLevelEl.disabled = hearingModeEl.value !== "hard";
  setScopeUi(scope);
  updateReminderBanner();

  // Update preset selection based on current state
  updatePresetSelection(state);

  // Update scope badge
  updateScopeBadge();
}

function updatePresetSelection(state) {
  const currentSettings = {
    blur: readBlurFromState(state),
    colorBlindness: readColorFromState(state),
    motor: { mode: state?.motor?.blocker?.mode ?? "none" },
    hearing: {
      mode: state?.hearing?.simulator?.mode ?? "none",
      level: Number(state?.hearing?.simulator?.level ?? 60),
    },
  };

  // Check if current settings match any preset
  let matchingPreset = null;
  for (const [presetName, presetConfig] of Object.entries(PRESETS)) {
    if (isSettingsMatch(currentSettings, presetConfig)) {
      matchingPreset = presetName;
      break;
    }
  }

  // Update preset card visual states
  presetCards.forEach((card) => {
    card.classList.toggle("active", card.dataset.preset === matchingPreset);
  });
}

function isSettingsMatch(current, preset) {
  return (
    current.blur.enabled === preset.blur.enabled &&
    current.blur.intensity === preset.blur.intensity &&
    current.colorBlindness.enabled === preset.colorBlindness.enabled &&
    current.colorBlindness.mode === preset.colorBlindness.mode &&
    current.motor.mode === preset.motor.mode &&
    current.hearing.mode === preset.hearing.mode &&
    current.hearing.level === preset.hearing.level
  );
}

function currentBlurFromUi() {
  return {
    enabled: blurEnabledEl.checked,
    intensity: Number(blurIntensityEl.value),
  };
}

function currentColorBlindnessFromUi() {
  const enabled = Boolean(colorEnabledEl.checked);
  const mode = normalizeColorMode(colorModeEl.value);
  return {
    enabled,
    mode: enabled ? mode : "none",
  };
}

function currentMotorBlockerFromUi() {
  const blockMouse = Boolean(motorBlockMouseEl?.checked);
  const blockTouch = Boolean(motorBlockTouchEl?.checked);
  const blockKeyboard = Boolean(motorBlockKeyboardEl?.checked);

  return {
    mode: getMotorModeFromFlags({ blockMouse, blockTouch, blockKeyboard }),
  };
}

function currentMotorJitterFromUi() {
  const enabled = Boolean(motorJitterEnabledEl?.checked);
  const level = normalizeMotorJitterLevel(
    getCheckedRadioValue(
      motorJitterLevelInputs,
      DEFAULT_MOTOR_JITTER_STATE.level,
    ),
  );
  const preset = MOTOR_JITTER_LEVELS[level] ?? MOTOR_JITTER_LEVELS.low;
  return {
    enabled,
    level,
    magnitudePx: preset.magnitudePx,
    frequencyHz: preset.frequencyHz,
  };
}

function isMotorSimulationActive() {
  const blockerActive = currentMotorBlockerFromUi().mode !== "none";
  const jitter = Boolean(motorJitterEnabledEl?.checked);
  return blockerActive || jitter;
}

function currentHearingStateFromUi() {
  return {
    mode: hearingModeEl.value,
    level: Number(hearingLevelEl.value),
  };
}

function getActiveTabId() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0]?.id ?? null);
    });
  });
}

function sendBlurUpdate() {
  return new Promise(async (resolve) => {
    const tabId = activeTabId ?? (await getActiveTabId());
    const blur = currentBlurFromUi();

    chrome.runtime.sendMessage(
      {
        type: "SET_BLUR_STATE",
        tabId,
        blur,
      },
      () => resolve(),
    );
  });
}

function sendColorUpdate() {
  return new Promise(async (resolve) => {
    const tabId = activeTabId ?? (await getActiveTabId());
    const colorBlindness = currentColorBlindnessFromUi();

    chrome.runtime.sendMessage(
      {
        type: "SET_COLOR_BLINDNESS_STATE",
        tabId,
        colorBlindness,
      },
      () => resolve(),
    );
  });
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response);
    });
  });
}

function sendMotorUpdate() {
  return new Promise(async (resolve) => {
    const tabId = activeTabId ?? (await getActiveTabId());
    const blocker = currentMotorBlockerFromUi();

    chrome.runtime.sendMessage(
      {
        type: "SET_MOTOR_BLOCKER_STATE",
        tabId,
        blocker,
      },
      () => resolve(),
    );
  });
}

function sendMotorJitterUpdate() {
  return new Promise(async (resolve) => {
    const tabId = activeTabId ?? (await getActiveTabId());
    const jitter = currentMotorJitterFromUi();

    chrome.runtime.sendMessage(
      {
        type: "SET_MOTOR_JITTER_STATE",
        tabId,
        jitter,
      },
      () => resolve(),
    );
  });
}

async function enableForCurrentWebsite() {
  if (!activeTabUrl) return;
  const response = await sendMessage({
    type: "ENABLE_CURRENT_SITE",
    tabId: activeTabId,
    url: activeTabUrl,
  });

  if (response?.extensionState) {
    applySyncedState(response.extensionState);
  }

  markNeedsRefresh();
  updateScopeBadge();
}

async function initializePopup() {
  const tabId = await getActiveTabId();
  activeTabId = tabId;

  if (!tabId) {
    enableCurrentSiteEl.disabled = true;
    showRefreshNotice(false);
    const response = await sendMessage({ type: "GET_STATE" });
    applySyncedState(response?.extensionState ?? {});
    return;
  }

  chrome.tabs.get(tabId, (tab) => {
    activeTabUrl = tab?.url ?? "";
    const canEnableCurrentSite =
      activeTabUrl.startsWith("http://") || activeTabUrl.startsWith("https://");
    enableCurrentSiteEl.disabled = !canEnableCurrentSite;
  });

  const response = await sendMessage({ type: "GET_STATE" });
  applySyncedState(response?.extensionState ?? {});
}

initializePopup();

blurEnabledEl.addEventListener("change", () => {
  updateReminderBanner();
  sendBlurUpdate();
  markNeedsRefresh();
});

blurIntensityEl.addEventListener("input", () => {
  blurIntensityValueEl.value = blurIntensityEl.value;
  if (!blurEnabledEl.checked) return;
  sendBlurUpdate();
  markNeedsRefresh();
});

colorEnabledEl.addEventListener("change", () => {
  colorModeEl.disabled = !colorEnabledEl.checked;
  updateReminderBanner();
  sendColorUpdate();
  markNeedsRefresh();
});

colorModeEl.addEventListener("change", () => {
  if (!colorEnabledEl.checked) return;
  sendColorUpdate();
  markNeedsRefresh();
});

motorBlockMouseEl.addEventListener("change", () => {
  updateReminderBanner();
  sendMotorUpdate();
  markNeedsRefresh();
});

motorBlockTouchEl.addEventListener("change", () => {
  updateReminderBanner();
  sendMotorUpdate();
  markNeedsRefresh();
});

motorBlockKeyboardEl.addEventListener("change", () => {
  updateReminderBanner();
  sendMotorUpdate();
  markNeedsRefresh();
});

motorJitterEnabledEl.addEventListener("change", () => {
  updateReminderBanner();
  sendMotorJitterUpdate();
  markNeedsRefresh();
});

motorJitterLevelInputs.forEach((input) => {
  input.addEventListener("change", () => {
    sendMotorJitterUpdate();
    markNeedsRefresh();
  });
});

hearingModeEl.addEventListener("change", () => {
  updateReminderBanner();
  hearingLevelEl.disabled = hearingModeEl.value !== "hard";
  sendHearingUpdate();
  markNeedsRefresh();
});

hearingLevelEl.addEventListener("input", () => {
  hearingLevelValueEl.value = hearingLevelEl.value;
  if (hearingModeEl.value !== "hard") return;
  sendHearingUpdate();
  markNeedsRefresh();
});

allowedUrlsEl.addEventListener("input", () => {
  markNeedsRefresh();
  updateScopeBadge();
  // Auto-save URLs when user stops typing
  clearTimeout(allowedUrlsEl.saveTimeout);
  allowedUrlsEl.saveTimeout = setTimeout(() => {
    autoSaveUrls();
  }, 1000); // Save after 1 second of no typing
});

// Auto-save URLs function
async function autoSaveUrls() {
  console.log("Auto-saving URLs...");
  const allowedUrls = parseAllowedUrlsInput(allowedUrlsEl.value);
  try {
    const response = await sendMessage({
      type: "SET_ALLOWED_URLS",
      tabId: activeTabId,
      allowedUrls,
    });

    if (response?.extensionState) {
      syncedState = response.extensionState;
      console.log("URLs auto-saved successfully");
    }
  } catch (error) {
    console.error("Error auto-saving URLs:", error);
  }
}

enableCurrentSiteEl.addEventListener("click", () => {
  enableForCurrentWebsite();
});

refreshPageEl.addEventListener("click", () => {
  if (!activeTabId) return;
  chrome.tabs.reload(activeTabId);
  showRefreshNotice(false);
});

// Add event listeners with debugging
resetAllEl.addEventListener("click", () => {
  console.log("Reset button clicked");
  resetSimulations();
});

if (resetReminderEl) {
  resetReminderEl.addEventListener("click", () => {
    console.log("Reset reminder clicked");
    resetSimulations();
  });
}

if (resetAllDisabilitiesEl) {
  resetAllDisabilitiesEl.addEventListener("click", () => {
    console.log("Reset disabilities clicked");
    resetSimulations();
  });
}

if (resetAllScopeEl) {
  resetAllScopeEl.addEventListener("click", () => {
    console.log("Reset scope clicked");
    resetSimulations();
  });
}

async function resetSimulations() {
  console.log("Reset simulations called");

  // Reset all controls to default state
  if (blurEnabledEl) {
    blurEnabledEl.checked = false;
    console.log("Blur disabled");
  }
  if (blurIntensityEl) {
    blurIntensityEl.value = "0";
    console.log("Blur intensity set to 0");
  }
  if (blurIntensityValueEl) {
    blurIntensityValueEl.value = "0";
    console.log("Blur intensity value set to 0");
  }
  if (colorEnabledEl) {
    colorEnabledEl.checked = false;
    console.log("Color disabled");
    colorModeEl.value = "none";
    colorModeEl.disabled = true;
    console.log("Color mode set to none");
  }
  if (motorBlockMouseEl) motorBlockMouseEl.checked = false;
  if (motorBlockTouchEl) motorBlockTouchEl.checked = false;
  if (motorBlockKeyboardEl) motorBlockKeyboardEl.checked = false;
  console.log("Motor inputs enabled");
  if (motorJitterEnabledEl) motorJitterEnabledEl.checked = false;
  setRadioGroupValue(motorJitterLevelInputs, "low");
  if (motorAccidentalEnabledEl) motorAccidentalEnabledEl.checked = false;
  setRadioGroupValue(motorAccidentalModeInputs, "down");
  if (motorMisclickEnabledEl) motorMisclickEnabledEl.checked = false;
  if (hearingModeEl) {
    hearingModeEl.value = "none";
    console.log("Hearing mode set to none");
  }
  if (hearingLevelEl) {
    hearingLevelEl.value = "60";
    console.log("Hearing level set to 60");
  }
  if (hearingLevelValueEl) {
    hearingLevelValueEl.value = "60";
    console.log("Hearing level value set to 60");
  }
  if (hearingLevelEl) {
    hearingLevelEl.disabled = true;
    console.log("Hearing level disabled");
  }

  // Clear preset selection
  if (presetCards) {
    presetCards.forEach((card) => {
      card.classList.remove("active");
    });
    console.log("Preset cards cleared");
  }

  // Update all badges and UI immediately
  console.log("Updating badges and UI...");
  updateReminderBanner();
  updateScopeBadge();

  // Send reset updates to background and wait for completion
  try {
    console.log("Sending reset updates to background...");

    // Send each reset command individually and wait for each
    await sendBlurUpdate();
    console.log("Blur reset sent");

    await sendColorUpdate();
    console.log("Color reset sent");

    await sendMotorUpdate();
    console.log("Motor reset sent");

    await sendMotorJitterUpdate();
    console.log("Motor jitter reset sent");

    await sendMotorAccidentalUpdate();
    console.log("Motor accidental reset sent");

    await sendHearingUpdate();
    console.log("Hearing reset sent");

    console.log("All reset updates sent successfully");

    // Wait a bit for background to process
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Force a state refresh to ensure persistence
    console.log("Forcing state refresh...");
    const response = await sendMessage({ type: "GET_STATE" });
    if (response?.extensionState) {
      console.log("State after reset:", response.extensionState);
      // Apply the state to ensure UI and background are in sync
      applySyncedState(response.extensionState);
    }

    markNeedsRefresh(); // Show refresh notice so user can refresh page
    console.log("Reset complete - showing refresh notice");
  } catch (error) {
    console.error("Error during reset:", error);
    markNeedsRefresh();
  }
}

const blurEnabledEl = document.getElementById("blur-enabled");
const blurIntensityEl = document.getElementById("blur-intensity");
const blurIntensityValueEl = document.getElementById("blur-intensity-value");
const colorEnabledEl = document.getElementById("color-blindness-enabled");
const colorModeEl = document.getElementById("color-blindness-mode");
const motorModeEl = document.getElementById("motor-mode");
const settingsReminderEl = document.getElementById("settings-reminder");
const enableCurrentSiteEl = document.getElementById("enable-current-site");
const allowedUrlsEl = document.getElementById("allowed-urls");
const saveAllowedUrlsEl = document.getElementById("save-allowed-urls");
const refreshNoticeEl = document.getElementById("refresh-notice");
const refreshPageEl = document.getElementById("refresh-page");
const resetAllEl = document.getElementById("reset-all");

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

function normalizeColorMode(mode) {
  const normalized = String(mode ?? "none").toLowerCase();
  if (!COLOR_MODES.includes(normalized)) return "none";
  return normalized;
}

function updateReminderBanner() {
  const motorActive = motorModeEl.value !== "none";
  const anyEnabled =
    blurEnabledEl.checked || colorEnabledEl.checked || motorActive;
  settingsReminderEl.hidden = !anyEnabled;
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
  const motorMode = state?.motor?.blocker?.mode ?? "none";
  const scope = readScopeFromState(state);
  const intensity = Math.max(0, Math.min(100, Number(blur.intensity) || 0));
  blurEnabledEl.checked = Boolean(blur.enabled);
  blurIntensityEl.value = String(intensity);
  blurIntensityValueEl.value = String(intensity);
  colorEnabledEl.checked = Boolean(color.enabled);
  colorModeEl.value = normalizeColorMode(color.mode);
  colorModeEl.disabled = !colorEnabledEl.checked;
  motorModeEl.value = motorMode;
  setScopeUi(scope);
  updateReminderBanner();
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
  return {
    mode: motorModeEl.value,
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
}

async function saveAllowedUrls() {
  const allowedUrls = parseAllowedUrlsInput(allowedUrlsEl.value);
  const response = await sendMessage({
    type: "SET_ALLOWED_URLS",
    tabId: activeTabId,
    allowedUrls,
  });

  if (response?.extensionState) {
    syncedState = response.extensionState;
    setUi(response.extensionState);
  }

  updateRefreshNotice();
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

motorModeEl.addEventListener("change", () => {
  updateReminderBanner();
  sendMotorUpdate();
  markNeedsRefresh();
});

allowedUrlsEl.addEventListener("input", () => {
  markNeedsRefresh();
});

enableCurrentSiteEl.addEventListener("click", () => {
  enableForCurrentWebsite();
});

saveAllowedUrlsEl.addEventListener("click", () => {
  saveAllowedUrls();
});

refreshPageEl.addEventListener("click", () => {
  if (!activeTabId) return;
  chrome.tabs.reload(activeTabId);
  showRefreshNotice(false);
});

resetAllEl.addEventListener("click", () => {
  resetSimulations();
});

async function resetSimulations() {
  blurEnabledEl.checked = false;
  blurIntensityEl.value = "0";
  blurIntensityValueEl.value = "0";
  colorEnabledEl.checked = false;
  colorModeEl.value = "none";
  colorModeEl.disabled = true;
  motorModeEl.value = "none";
  updateReminderBanner();

  await Promise.all([sendBlurUpdate(), sendColorUpdate(), sendMotorUpdate()]);

  const response = await sendMessage({ type: "GET_STATE" });
  if (response?.extensionState) {
    applySyncedState(response.extensionState);
  } else {
    showRefreshNotice(false);
  }
}

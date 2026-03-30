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
  "full",
];
const MOTOR_JITTER_LEVELS = ["low", "medium", "high"];
const HEARING_MODES = ["none", "deaf", "hard"];
const DYSLEXIA_LEVELS = ["mild", "moderate", "severe"];

const extensionState = {
  visual: {
    blur: {
      enabled: false,
      intensity: 0,
    },
    colorBlindness: {
      enabled: false,
      mode: "none",
    },
  },
  motor: {
    blocker: {
      mode: "none",
    },
    jitter: {
      enabled: false,
      level: "low",
      magnitudePx: 2,
      frequencyHz: 3,
    },
  },
  hearing: {
    simulator: {
      mode: "none",
      level: 60,
    },
  },
  cognitive: {
    dyslexia: {
      enabled: false,
      level: "moderate",
      spotlightEnabled: true,
      scramblingEnabled: true,
    },
  },
  scope: {
    allowedUrls: [],
  },
};

function normalizeBlurState(blur) {
  const intensityValue = Number(blur?.intensity ?? 0);
  const boundedIntensity = Number.isFinite(intensityValue)
    ? Math.max(0, Math.min(100, intensityValue))
    : 0;

  return {
    enabled: Boolean(blur?.enabled),
    intensity: Math.round(boundedIntensity),
  };
}

function clampNumber(value, min, max, fallback = min) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function refreshBadgeForActiveTab() {
  getStoredState().then((storedState) => {
    updateActionNotification(storedState);
  });
}

function normalizeColorBlindnessState(colorBlindness) {
  const requestedMode = String(colorBlindness?.mode ?? "none").toLowerCase();
  const mode = COLOR_MODES.includes(requestedMode) ? requestedMode : "none";
  const enabled = Boolean(colorBlindness?.enabled) && mode !== "none";

  return {
    enabled,
    mode,
  };
}

function normalizeMotorBlockerState(blocker) {
  const requestedMode = String(blocker?.mode ?? "none").toLowerCase();
  const mode = MOTOR_MODES.includes(requestedMode) ? requestedMode : "none";
  return { mode };
}

function normalizeMotorJitterState(jitter) {
  const enabled = Boolean(jitter?.enabled);
  const level = MOTOR_JITTER_LEVELS.includes(
    String(jitter?.level ?? "").toLowerCase(),
  )
    ? String(jitter.level).toLowerCase()
    : "low";
  const magnitudePx = clampNumber(jitter?.magnitudePx, 1, 25, 4);
  const frequencyHz = clampNumber(jitter?.frequencyHz, 1, 20, 4);
  return {
    enabled,
    level,
    magnitudePx,
    frequencyHz,
  };
}

function normalizeHearingState(simulator) {
  const requestedMode = String(simulator?.mode ?? "none").toLowerCase();
  const mode = HEARING_MODES.includes(requestedMode) ? requestedMode : "none";
  const levelValue = Number(simulator?.level ?? 60);
  const boundedLevel = Number.isFinite(levelValue)
    ? Math.max(0, Math.min(100, levelValue))
    : 60;
  return { mode, level: boundedLevel };
}

function normalizeDyslexiaState(dyslexia) {
  const level = DYSLEXIA_LEVELS.includes(
    String(dyslexia?.level ?? "").toLowerCase(),
  )
    ? String(dyslexia.level).toLowerCase()
    : "moderate";

  return {
    enabled: Boolean(dyslexia?.enabled),
    level,
    spotlightEnabled:
      dyslexia?.spotlightEnabled === undefined
        ? true
        : Boolean(dyslexia.spotlightEnabled),
    scramblingEnabled:
      dyslexia?.scramblingEnabled === undefined
        ? true
        : Boolean(dyslexia.scramblingEnabled),
  };
}

function normalizeUrlRule(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;

    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    if (!normalizedPath || normalizedPath === "/") {
      return parsed.origin;
    }

    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return null;
  }
}

function normalizeAllowedUrls(allowedUrls) {
  if (!Array.isArray(allowedUrls)) return [];

  const unique = new Set();
  for (const item of allowedUrls) {
    const normalizedRule = normalizeUrlRule(item);
    if (!normalizedRule) continue;
    unique.add(normalizedRule);
  }

  return Array.from(unique);
}

function normalizeScope(scope) {
  return {
    allowedUrls: normalizeAllowedUrls(scope?.allowedUrls),
  };
}

function doesUrlMatchRule(tabUrl, rule) {
  if (!tabUrl || !rule) return false;
  try {
    const current = new URL(tabUrl);
    const ruleUrl = new URL(rule);
    if (current.origin !== ruleUrl.origin) return false;
    return (
      ruleUrl.pathname === "/" || current.pathname.startsWith(ruleUrl.pathname)
    );
  } catch {
    return false;
  }
}

function isTabAllowed(tabUrl, state) {
  const allowedUrls = state?.scope?.allowedUrls ?? [];
  if (!Array.isArray(allowedUrls) || allowedUrls.length === 0) {
    return false;
  }
  return allowedUrls.some((rule) => doesUrlMatchRule(tabUrl, rule));
}

function mergeWithDefaultState(state) {
  const incomingBlur = state?.visual?.blur;
  const incomingColorBlindness = state?.visual?.colorBlindness;
  const incomingMotorBlocker = state?.motor?.blocker;
  const incomingHearing = state?.hearing?.simulator;
  const incomingDyslexia = state?.cognitive?.dyslexia;
  const incomingScope = state?.scope;
  return {
    visual: {
      blur: normalizeBlurState(incomingBlur),
      colorBlindness: normalizeColorBlindnessState(incomingColorBlindness),
    },
    motor: {
      blocker: normalizeMotorBlockerState(incomingMotorBlocker),
      jitter: normalizeMotorJitterState(state?.motor?.jitter),
    },
    hearing: {
      simulator: normalizeHearingState(incomingHearing),
    },
    cognitive: {
      dyslexia: normalizeDyslexiaState(incomingDyslexia),
    },
    scope: normalizeScope(incomingScope),
  };
}

function getStoredState() {
  return new Promise((resolve) => {
    chrome.storage.local.get("extensionState", (result) => {
      resolve(mergeWithDefaultState(result.extensionState ?? extensionState));
    });
  });
}

function setStoredState(nextState) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ extensionState: nextState }, () => resolve());
  });
}

function sendStateToTab(tabId, state) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, {
    type: "APPLY_STATE",
    extensionState: state,
  });
}

function isMotorSimulationEnabled(state) {
  const motor = state?.motor ?? {};
  const blockerActive = (motor.blocker?.mode ?? "none") !== "none";
  const jitterActive = Boolean(motor.jitter?.enabled);
  return blockerActive || jitterActive;
}

function isCognitiveSimulationEnabled(state) {
  return Boolean(state?.cognitive?.dyslexia?.enabled);
}

function updateActionNotification(state) {
  const blurEnabled = Number(Boolean(state?.visual?.blur?.enabled));
  const colorEnabled = Number(Boolean(state?.visual?.colorBlindness?.enabled));
  const motorEnabled = Number(isMotorSimulationEnabled(state));
  const hearingEnabled = Number(
    (state?.hearing?.simulator?.mode ?? "none") !== "none",
  );
  const cognitiveEnabled = Number(isCognitiveSimulationEnabled(state));
  const activeCount =
    blurEnabled +
    colorEnabled +
    motorEnabled +
    hearingEnabled +
    cognitiveEnabled;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs?.[0];
    const tabAllowed = activeTab?.url
      ? isTabAllowed(activeTab.url, state)
      : false;
    const badgeColor = tabAllowed ? "#1f8b4c" : "#6b7280";

    if (activeCount > 0) {
      chrome.action.setBadgeText({ text: String(activeCount) });
      chrome.action.setBadgeBackgroundColor({ color: badgeColor });
      chrome.action.setTitle({
        title: tabAllowed
          ? `Muta7 (${activeCount} simulation(s) active on this site)`
          : `Muta7 (${activeCount} simulation(s) configured; not active on this site)`,
      });
      return;
    }

    chrome.action.setBadgeText({ text: "" });
    chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    chrome.action.setTitle({
      title: tabAllowed ? "Muta7 (allowed on this site)" : "Muta7",
    });
  });
}

function toOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ extensionState });
  updateActionNotification(extensionState);
});

chrome.runtime.onStartup.addListener(() => {
  getStoredState().then((storedState) => {
    updateActionNotification(storedState);
  });
});

chrome.tabs.onActivated.addListener(() => {
  refreshBadgeForActiveTab();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.status === "complete") {
    refreshBadgeForActiveTab();
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  refreshBadgeForActiveTab();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_STATE") {
    getStoredState().then((storedState) => {
      updateActionNotification(storedState);
      sendResponse({ extensionState: storedState });
    });
    return true;
  }

  if (message?.type === "SET_DYSLEXIA_STATE") {
    getStoredState()
      .then((storedState) => {
        const nextState = {
          ...storedState,
          cognitive: {
            ...storedState.cognitive,
            dyslexia: normalizeDyslexiaState(message.dyslexia),
          },
        };

        return setStoredState(nextState).then(() => nextState);
      })
      .then((nextState) => {
        updateActionNotification(nextState);
        sendStateToTab(message.tabId, nextState);
        sendResponse({ ok: true, extensionState: nextState });
      });
    return true;
  }

  if (message?.type === "SET_MOTOR_BLOCKER_STATE") {
    getStoredState()
      .then((storedState) => {
        const nextState = {
          ...storedState,
          motor: {
            ...storedState.motor,
            blocker: normalizeMotorBlockerState(message.blocker),
          },
        };

        return setStoredState(nextState).then(() => nextState);
      })
      .then((nextState) => {
        updateActionNotification(nextState);
        sendStateToTab(message.tabId, nextState);
        sendResponse({ ok: true, extensionState: nextState });
      });
    return true;
  }

  if (message?.type === "SET_MOTOR_JITTER_STATE") {
    getStoredState()
      .then((storedState) => {
        const nextState = {
          ...storedState,
          motor: {
            ...storedState.motor,
            jitter: normalizeMotorJitterState(message.jitter),
          },
        };

        return setStoredState(nextState).then(() => nextState);
      })
      .then((nextState) => {
        updateActionNotification(nextState);
        sendStateToTab(message.tabId, nextState);
        sendResponse({ ok: true, extensionState: nextState });
      });
    return true;
  }

  if (message?.type === "SET_HEARING_STATE") {
    getStoredState()
      .then((storedState) => {
        const nextState = {
          ...storedState,
          hearing: {
            ...storedState.hearing,
            simulator: normalizeHearingState(message.simulator),
          },
        };

        return setStoredState(nextState).then(() => nextState);
      })
      .then((nextState) => {
        updateActionNotification(nextState);
        sendStateToTab(message.tabId, nextState);
        sendResponse({ ok: true, extensionState: nextState });
      });
    return true;
  }

  if (message?.type === "SET_BLUR_STATE") {
    getStoredState()
      .then((storedState) => {
        const nextState = {
          ...storedState,
          visual: {
            ...storedState.visual,
            blur: normalizeBlurState(message.blur),
          },
        };

        return setStoredState(nextState).then(() => nextState);
      })
      .then((nextState) => {
        updateActionNotification(nextState);
        sendStateToTab(message.tabId, nextState);
        sendResponse({ ok: true, extensionState: nextState });
      });
    return true;
  }

  if (message?.type === "SET_COLOR_BLINDNESS_STATE") {
    getStoredState()
      .then((storedState) => {
        const nextState = {
          ...storedState,
          visual: {
            ...storedState.visual,
            colorBlindness: normalizeColorBlindnessState(
              message.colorBlindness,
            ),
          },
        };

        return setStoredState(nextState).then(() => nextState);
      })
      .then((nextState) => {
        updateActionNotification(nextState);
        sendStateToTab(message.tabId, nextState);
        sendResponse({ ok: true, extensionState: nextState });
      });
    return true;
  }

  if (message?.type === "ENABLE_CURRENT_SITE") {
    getStoredState()
      .then((storedState) => {
        const origin = toOrigin(message.url);
        if (!origin) return storedState;

        const nextAllowedUrls = normalizeAllowedUrls([
          ...storedState.scope.allowedUrls,
          origin,
        ]);

        const nextState = {
          ...storedState,
          scope: {
            ...storedState.scope,
            allowedUrls: nextAllowedUrls,
          },
        };

        return setStoredState(nextState).then(() => nextState);
      })
      .then((nextState) => {
        sendStateToTab(message.tabId, nextState);
        sendResponse({
          ok: true,
          extensionState: nextState,
          requiresRefresh: true,
        });
      });
    return true;
  }

  if (message?.type === "SET_ALLOWED_URLS") {
    getStoredState()
      .then((storedState) => {
        const nextState = {
          ...storedState,
          scope: {
            ...storedState.scope,
            allowedUrls: normalizeAllowedUrls(message.allowedUrls),
          },
        };

        return setStoredState(nextState).then(() => nextState);
      })
      .then((nextState) => {
        sendStateToTab(message.tabId, nextState);
        sendResponse({
          ok: true,
          extensionState: nextState,
          requiresRefresh: true,
        });
      });
    return true;
  }
});

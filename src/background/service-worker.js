const COLOR_MODES = [
  "none",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "monochromacy",
];

const MOTOR_MODES = ["none", "mouse", "full"];

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
  const incomingScope = state?.scope;
  return {
    visual: {
      blur: normalizeBlurState(incomingBlur),
      colorBlindness: normalizeColorBlindnessState(incomingColorBlindness),
    },
    motor: {
      blocker: normalizeMotorBlockerState(incomingMotorBlocker),
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

function updateActionNotification(state) {
  const blurEnabled = Number(Boolean(state?.visual?.blur?.enabled));
  const colorEnabled = Number(Boolean(state?.visual?.colorBlindness?.enabled));
  const motorEnabled = Number(
    (state?.motor?.blocker?.mode ?? "none") !== "none",
  );
  const activeCount = blurEnabled + colorEnabled + motorEnabled;

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

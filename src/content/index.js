function parseRule(rule) {
  const normalized = String(rule ?? "").trim();
  if (!normalized) return null;

  const withScheme = /^https?:\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`;

  try {
    const parsed = new URL(withScheme);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;

    return {
      origin: parsed.origin,
      path: parsed.pathname.replace(/\/+$/, ""),
    };
  } catch {
    return null;
  }
}

function matchesRule(currentUrl, rule) {
  const parsedCurrent = new URL(currentUrl);
  const parsedRule = parseRule(rule);
  if (!parsedRule) return false;
  if (parsedCurrent.origin !== parsedRule.origin) return false;

  if (!parsedRule.path || parsedRule.path === "/") {
    return true;
  }

  return parsedCurrent.pathname.startsWith(parsedRule.path);
}

function isCurrentUrlAllowed(extensionState) {
  const currentUrl = window.location.href;
  const allowedUrls = extensionState?.scope?.allowedUrls ?? [];

  if (!Array.isArray(allowedUrls) || allowedUrls.length === 0) {
    return false;
  }

  return allowedUrls.some((rule) => matchesRule(currentUrl, rule));
}

function applyBlurState(blurState, allowed) {
  const module = globalThis.Muta7BlurModule;
  if (!module || !blurState) return;

  if (!allowed || !blurState.enabled) {
    module.disable?.();
    return;
  }

  module.update?.({ intensity: blurState.intensity });
}

function applyColorBlindnessState(colorState, allowed) {
  const module = globalThis.Muta7ColorBlindnessModule;
  if (!module || !colorState) return;

  if (!allowed || !colorState.enabled) {
    module.disable?.();
    return;
  }

  module.update?.({ mode: colorState.mode });
}

function applyMotorBlockerState(blockerState, allowed) {
  const module = globalThis.Muta7MotorBlockerModule;
  if (!module) return;

  const mode = blockerState?.mode ?? "none";
  if (!allowed || mode === "none") {
    module.disable?.();
    return;
  }

  module.update?.({ mode });
}

function applyMotorJitterState(jitterState, allowed) {
  const module = globalThis.Muta7MotorJitterModule;
  if (!module) return;

  if (!allowed || !jitterState?.enabled) {
    module.disable?.();
    return;
  }

  module.update?.(jitterState);
}

function applyHearingState(simulatorState, allowed) {
  const module = globalThis.Muta7HearingSimulatorModule;
  if (!module) return;

  const mode = simulatorState?.mode ?? "none";
  const level = Number(simulatorState?.level ?? 60);
  if (!allowed || mode === "none") {
    module.disable?.();
    return;
  }

  module.update?.({ mode, level });
}

function applyState(extensionState) {
  const allowed = isCurrentUrlAllowed(extensionState);
  applyBlurState(extensionState?.visual?.blur, allowed);
  applyColorBlindnessState(extensionState?.visual?.colorBlindness, allowed);
  const motorState = extensionState?.motor ?? {};
  applyMotorBlockerState(motorState.blocker, allowed);
  applyMotorJitterState(motorState.jitter, allowed);
  applyHearingState(extensionState?.hearing?.simulator, allowed);
}

chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
  if (!response?.extensionState) return;
  applyState(response.extensionState);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "APPLY_STATE") return;
  applyState(message.extensionState);
});

const OAUTH_POPUP_NAME = "snapfind_google_oauth";
const OAUTH_CHANNEL_NAME = "snapfind_oauth_channel";

export interface OAuthPopupPayload {
  type: "OAUTH_AUTH_CALLBACK" | "OAUTH_AUTH_ERROR" | "OAUTH_AUTH_HASH_TOKENS";
  callbackId: string;
  code?: string;
  flowId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  expiresIn?: number;
  error?: string;
  errorDescription?: string;
  isRecoveryCallback: boolean;
}

export function shouldInterceptOAuthPopupBeforeMount(): boolean {
  if (typeof window === "undefined") return false;
  const pathname = window.location.pathname || "/";
  const search = window.location.search || "";
  const hash = window.location.hash || "";
  const searchParams = new URLSearchParams(search);
  const hashParams =
    hash && (hash.includes("=") || hash.includes("access_token") || hash.includes("error"))
      ? new URLSearchParams(hash.replace(/^#\/?/, ""))
      : null;

  const isRecovery =
    searchParams.get("type") === "recovery" ||
    hashParams?.get("type") === "recovery" ||
    pathname === "/reset-password";
  if (isRecovery) return false;

  if (pathname === "/auth/callback" || pathname === "/auth-callback.html") {
    return true;
  }

  const isPopupContext =
    Boolean(window.opener && window.opener !== window) ||
    window.name === OAUTH_POPUP_NAME;

  if (!isPopupContext) return false;

  return Boolean(
    searchParams.get("code") ||
      searchParams.get("error") ||
      hashParams?.get("access_token") ||
      hashParams?.get("error")
  );
}

export function parseOAuthCallbackFromLocation(): OAuthPopupPayload {
  const searchParams = new URLSearchParams(window.location.search || "");
  const rawHash = window.location.hash || "";
  const hashParams =
    rawHash && (rawHash.includes("=") || rawHash.includes("access_token") || rawHash.includes("error"))
      ? new URLSearchParams(rawHash.replace(/^#\/?/, ""))
      : null;

  const errorCode = searchParams.get("error") || hashParams?.get("error") || "";
  const errorDescription =
    searchParams.get("error_description") ||
    hashParams?.get("error_description") ||
    searchParams.get("error_code") ||
    hashParams?.get("error_code") ||
    errorCode;

  const code = searchParams.get("code") || "";
  const flowId = searchParams.get("sb_flow_id") || undefined;
  const type = searchParams.get("type") || hashParams?.get("type") || "";
  const accessToken = hashParams?.get("access_token") || "";
  const refreshToken = hashParams?.get("refresh_token") || undefined;
  const expiresAtRaw = hashParams?.get("expires_at");
  const expiresInRaw = hashParams?.get("expires_in");
  const isRecoveryCallback = type === "recovery";
  const callbackId = `${code || accessToken || errorCode || "empty"}:${Date.now()}`;

  try {
    const cleanPath = window.location.pathname === "/auth/callback" ? "/auth/callback" : "/";
    window.history.replaceState({}, document.title, cleanPath);
  } catch {}

  if (errorCode) {
    return {
      type: "OAUTH_AUTH_ERROR",
      callbackId,
      error: errorCode,
      errorDescription: errorDescription || "Authentication failed.",
      isRecoveryCallback,
    };
  }

  if (code) {
    return {
      type: "OAUTH_AUTH_CALLBACK",
      callbackId,
      code,
      flowId,
      isRecoveryCallback,
    };
  }

  if (accessToken) {
    return {
      type: "OAUTH_AUTH_HASH_TOKENS",
      callbackId,
      accessToken,
      refreshToken,
      expiresAt: expiresAtRaw ? Number(expiresAtRaw) : undefined,
      expiresIn: expiresInRaw ? Number(expiresInRaw) : undefined,
      isRecoveryCallback,
    };
  }

  return {
    type: "OAUTH_AUTH_ERROR",
    callbackId,
    error: "missing_callback_params",
    errorDescription: "No authorization code was returned from Google Sign-In.",
    isRecoveryCallback: false,
  };
}

export function runLightweightOAuthPopupCallback(rootEl: HTMLElement | null): boolean {
  if (!shouldInterceptOAuthPopupBeforeMount()) return false;

  const payload = parseOAuthCallbackFromLocation();
  let delivered = false;
  const hasOpener = Boolean(window.opener && window.opener !== window);

  if (hasOpener) {
    try {
      window.opener.postMessage(payload, window.location.origin);
      delivered = true;
    } catch {
      delivered = false;
    }
  }

  if (!delivered && typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(OAUTH_CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
      delivered = true;
    } catch {}
  }

  if (rootEl) {
    rootEl.textContent = "";
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "min-height:100vh;display:flex;align-items:center;justify-content:center;background:#080908;color:#F7F8F5;padding:24px;font-family:system-ui,-apple-system,sans-serif;";
    const card = document.createElement("div");
    card.style.cssText =
      "max-width:380px;width:100%;background:#141714;border:1px solid #30362E;border-radius:16px;padding:24px;text-align:center;";
    const title = document.createElement("h1");
    title.style.cssText = "margin:0 0 8px 0;font-size:17px;font-weight:700;";
    title.textContent =
      payload.type === "OAUTH_AUTH_ERROR"
        ? "Google Sign-In could not complete"
        : delivered
        ? "Completing Google Sign-In..."
        : "Return to SnapFind AI";
    const desc = document.createElement("p");
    desc.style.cssText = "margin:0 0 16px 0;font-size:13px;line-height:1.5;color:#A5AAA1;";
    desc.textContent =
      payload.type === "OAUTH_AUTH_ERROR"
        ? "You can close this window and return to your SnapFind AI tab."
        : delivered
        ? "Authentication was sent to your SnapFind AI window. Closing automatically..."
        : "Could not reach the original SnapFind AI window. Please close this popup and try again.";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Close Window";
    btn.style.cssText =
      "width:100%;padding:10px 14px;border-radius:10px;border:none;background:#B7F36B;color:#080908;font-size:13px;font-weight:700;cursor:pointer;";
    btn.addEventListener("click", () => {
      try {
        window.close();
      } catch {}
    });

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(btn);
    wrapper.appendChild(card);
    rootEl.appendChild(wrapper);
  }

  try {
    window.close();
  } catch {}
  setTimeout(() => {
    try {
      if (!window.closed) window.close();
    } catch {}
  }, 150);

  return true;
}

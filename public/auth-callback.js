(function () {
  "use strict";

  var CHANNEL_NAME = "snapfind_oauth_channel";
  var titleEl = document.getElementById("oauth-status-title");
  var messageEl = document.getElementById("oauth-status-message");
  var closeBtn = document.getElementById("oauth-close-btn");

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      try {
        window.close();
      } catch (_) {}
    });
  }

  function showManualClose(titleText, bodyText) {
    if (titleEl) titleEl.textContent = titleText;
    if (messageEl) messageEl.textContent = bodyText;
    if (closeBtn) closeBtn.classList.add("visible");
  }

  function parseOAuthCallbackParams() {
    var searchParams = new URLSearchParams(window.location.search || "");
    var rawHash = window.location.hash || "";
    var hashParams =
      rawHash && (rawHash.indexOf("=") !== -1 || rawHash.indexOf("access_token") !== -1 || rawHash.indexOf("error") !== -1)
        ? new URLSearchParams(rawHash.replace(/^#\/?/, ""))
        : null;

    var errorCode = searchParams.get("error") || (hashParams && hashParams.get("error")) || "";
    var errorDescription =
      searchParams.get("error_description") ||
      (hashParams && hashParams.get("error_description")) ||
      searchParams.get("error_code") ||
      (hashParams && hashParams.get("error_code")) ||
      errorCode;

    var code = searchParams.get("code") || "";
    var flowId = searchParams.get("sb_flow_id") || "";
    var type = searchParams.get("type") || (hashParams && hashParams.get("type")) || "";
    var accessToken = (hashParams && hashParams.get("access_token")) || "";
    var refreshToken = (hashParams && hashParams.get("refresh_token")) || "";
    var expiresAt = (hashParams && hashParams.get("expires_at")) || "";
    var expiresIn = (hashParams && hashParams.get("expires_in")) || "";

    var isRecoveryCallback = type === "recovery";
    var callbackId = [code || accessToken || errorCode || "empty", String(Date.now())].join(":");

    try {
      window.history.replaceState({}, document.title, window.location.pathname || "/auth/callback");
    } catch (_) {}

    if (errorCode) {
      return {
        type: "OAUTH_AUTH_ERROR",
        callbackId: callbackId,
        error: errorCode,
        errorDescription: errorDescription || "Authentication failed.",
        isRecoveryCallback: isRecoveryCallback,
      };
    }

    if (code) {
      return {
        type: "OAUTH_AUTH_CALLBACK",
        callbackId: callbackId,
        code: code,
        flowId: flowId || undefined,
        isRecoveryCallback: isRecoveryCallback,
      };
    }

    if (accessToken) {
      return {
        type: "OAUTH_AUTH_HASH_TOKENS",
        callbackId: callbackId,
        accessToken: accessToken,
        refreshToken: refreshToken || undefined,
        expiresAt: expiresAt ? Number(expiresAt) : undefined,
        expiresIn: expiresIn ? Number(expiresIn) : undefined,
        isRecoveryCallback: isRecoveryCallback,
      };
    }

    return {
      type: "OAUTH_AUTH_ERROR",
      callbackId: callbackId,
      error: "missing_callback_params",
      errorDescription: "No authorization code was returned from Google Sign-In.",
      isRecoveryCallback: false,
    };
  }

  function deliverPayload(payload) {
    var deliveredToOpener = false;
    var hasOpener = Boolean(window.opener && window.opener !== window);

    if (hasOpener) {
      try {
        window.opener.postMessage(payload, window.location.origin);
        deliveredToOpener = true;
      } catch (_) {
        deliveredToOpener = false;
      }
    }

    if (!deliveredToOpener && typeof BroadcastChannel !== "undefined") {
      try {
        var channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage(payload);
        channel.close();
        deliveredToOpener = true;
      } catch (_) {}
    }

    if (payload.type === "OAUTH_AUTH_ERROR") {
      showManualClose(
        "Google Sign-In could not complete",
        deliveredToOpener
          ? "You can close this window and check your SnapFind AI tab."
          : "Please close this window and return to your SnapFind AI tab."
      );
    } else if (!deliveredToOpener) {
      showManualClose(
        "Return to SnapFind AI",
        "Could not reach the original SnapFind AI window. Please close this popup and try again."
      );
    }

    try {
      window.close();
    } catch (_) {}

    setTimeout(function () {
      try {
        if (!window.closed) {
          window.close();
        }
      } catch (_) {}
      if (!window.closed && payload.type !== "OAUTH_AUTH_ERROR") {
        showManualClose(
          "Sign-In Complete",
          "Authentication was sent to your SnapFind AI window. You can close this tab."
        );
      }
    }, 180);
  }

  var payload = parseOAuthCallbackParams();
  deliverPayload(payload);
})();

(function () {
  "use strict";

  const scriptTag = document.currentScript;
  if (!scriptTag) return;

  const botName = scriptTag.getAttribute("data-bot");
  if (!botName) {
    console.error("[BotWebAI] Missing data-bot attribute");
    return;
  }

  const widgetApiKey =
    scriptTag.getAttribute("data-api-key") ||
    scriptTag.getAttribute("data-key");
  if (!widgetApiKey) {
    console.warn("[BotWebAI] Missing data-api-key attribute. Visitor widget flows may fail.");
  }

  const backendUrl =
    scriptTag.getAttribute("data-api") ||
    scriptTag.src.replace(/\/api\/widget\/widget\.js.*$/, "").replace(/\/widget\.js.*$/, "");

  const suggestedQuestions = [
    "What do you do?",
    "How can you help me?",
    "Tell me more",
  ];

  let botConfig = null;
  let isOpen = false;
  let host = null;
  let shadow = null;
  let visitorProfile = null;
  let currentVisitorAccessToken = null;
  let visitorReady = false;
  let chatBootstrapped = false;
  let isRegistering = false;
  let activeTab = "home";
  let teaserDismissed = false;
  let liveChat = null; // { roomId, status, ws, timeoutId, intervalId, seenIds, localIds, typingIdleId, typingActive }

  const LIVE_ACCEPT_TIMEOUT_MS = 30000;
  const LIVE_TYPING_IDLE_MS = 1800;

  const storageKeys = {
    visitorToken: `ttw:visitor-token:${botName}`,
    visitorAccessToken: `ttw:visitor-access:${botName}`,
    visitorProfile: `ttw:visitor-profile:${botName}`,
    sessionId: `ttw:session-id:${botName}`,
  };

  const STYLES = `
    :host {
      all: initial;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    .ttw-root {
      --ttw-theme: #2563eb;
      --ttw-logo-bg: #ffffff;
      --ttw-widget-bg: #2678FF;
      --ttw-text: #1e293b;
      --ttw-muted: #64748b;
      --ttw-border: rgba(148, 163, 184, 0.12);
      --ttw-shadow: 0 20px 48px rgba(15, 23, 42, 0.16);
      --ttw-radius: 24px;
      --ttw-launcher-size: 64px;
      --ttw-launcher-gap: 16px;
      position: fixed;
      inset: auto 24px 24px auto;
      z-index: 2147483000;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: var(--ttw-text);
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    .ttw-root.left {
      inset: auto auto 24px 24px;
      align-items: flex-start;
    }

    .ttw-backdrop {
      position: absolute;
      inset: 0;
      z-index: 1;
      background: transparent;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    .ttw-root.center {
      --ttw-center-panel-h: min(520px, calc(100vh - 108px));
      --ttw-center-gap: 10px;
      --ttw-center-composer-h: 52px;
      --ttw-center-bottom: 24px;
      inset: 0;
      display: block;
      pointer-events: none;
    }

    .ttw-root.center.open {
      pointer-events: none;
    }

    .ttw-root.center.open .ttw-backdrop {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    .ttw-root.center .ttw-panel.open,
    .ttw-root.center .ttw-launcher,
    .ttw-root.center .ttw-center-composer.active {
      pointer-events: auto;
    }

    .ttw-root.center .ttw-panel {
      width: min(400px, calc(100vw - 32px));
      height: var(--ttw-center-panel-h);
      max-height: none;
      top: auto;
      right: auto;
      bottom: calc(
        var(--ttw-center-bottom) + var(--ttw-center-composer-h) + var(--ttw-center-gap)
      );
      left: 50%;
      z-index: 2;
      transform: translateX(-50%) scale(0.92) translateY(14px);
      transform-origin: bottom center;
    }

    .ttw-root.center .ttw-panel.open {
      transform: translateX(-50%) scale(1) translateY(0);
    }

    .ttw-root.center .ttw-teaser-stack {
      display: none;
    }

    .ttw-root.center .ttw-launcher {
      position: absolute;
      z-index: 3;
      left: 50%;
      top: auto;
      bottom: var(--ttw-center-bottom);
      width: min(400px, calc(100vw - 32px));
      height: 44px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: #ffffff;
      color: var(--ttw-muted);
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
      transform: translateX(-50%);
      pointer-events: auto;
    }

    .ttw-root.center.open .ttw-launcher {
      display: none;
    }

    .ttw-center-composer {
      display: none;
    }

    .ttw-root.center.open .ttw-center-composer.active {
      position: absolute;
      z-index: 3;
      top: auto;
      bottom: var(--ttw-center-bottom);
      left: 50%;
      display: block;
      width: min(400px, calc(100vw - 32px));
      transform: translateX(-50%);
    }

    .ttw-root.center .ttw-center-composer .ttw-input-shell {
      padding: 0;
      border: 0;
    }

    .ttw-root.center .ttw-center-composer .ttw-input-row {
      padding: 4px 6px;
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
    }

    .ttw-root.center .ttw-center-composer .ttw-footer {
      display: none;
    }

    .ttw-root.center:not(.open) .ttw-launcher {
      top: auto;
      bottom: var(--ttw-center-bottom);
      width: min(280px, calc(100vw - 32px));
      height: 42px;
      justify-content: space-between;
      gap: 10px;
      padding: 0 5px 0 14px;
      border: 1px solid rgba(255, 255, 255, 0.72);
      background: rgba(255, 255, 255, 0.68);
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.2), 0 1px 3px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      transform: translateX(-50%);
      transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease;
    }

    .ttw-root.center:not(.open) .ttw-launcher:hover {
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.26);
      transform: translateX(-50%) scale(1.04);
    }

    .ttw-root.center.open .ttw-launcher:hover {
      transform: translateX(-50%) scale(1.03);
    }

    .ttw-launcher-label {
      display: none;
      font-size: 12px;
      font-weight: 500;
    }

    .ttw-root.center:not(.open) .ttw-launcher-label {
      display: block;
    }

    .ttw-root.center:not(.open) .ttw-launcher-icon-chat {
      display: grid;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      place-items: center;
      background: #e9eaec;
      color: #6f747c;
    }

    .ttw-root.center:not(.open) .ttw-launcher-icon-chat svg,
    .ttw-root.center:not(.open) .ttw-launcher-icon-chat img {
      display: none;
    }

    .ttw-root.center:not(.open) .ttw-launcher-icon-chat::after {
      content: "↑";
      font-size: 15px;
      font-weight: 400;
      line-height: 1;
    }

    .ttw-root.center:not(.open) .ttw-launcher-label {
      flex: 1;
      color: #70747c;
      font-size: 13px;
      font-weight: 400;
      letter-spacing: -0.02em;
      overflow: hidden;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ttw-launcher {
      width: var(--ttw-launcher-size);
      height: var(--ttw-launcher-size);
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      background: transparent;
      box-shadow: none;
      transition: transform 250ms cubic-bezier(0.33, 0.00, 0.00, 1.00), box-shadow 180ms ease, background 200ms ease, color 200ms ease;
      position: relative;
      z-index: 2;
      flex-shrink: 0;
      pointer-events: auto;
      padding: 0;
      overflow: visible;
    }

    .ttw-launcher:hover {
      transform: scale(1.1);
    }

    .ttw-launcher.open {
      background: #ffffff;
      color: #1e293b;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
    }

    .ttw-launcher.open:hover {
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.22);
    }

    .ttw-launcher-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 180ms ease, transform 220ms cubic-bezier(0.33, 0.00, 0.00, 1.00);
    }

    .ttw-launcher-shape {
      position: relative;
      width: calc(var(--ttw-launcher-size) - 2px);
      height: calc(var(--ttw-launcher-size) - 2px);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ttw-launcher-bg-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.12));
    }

    .ttw-launcher-inner {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }

    .ttw-launcher-inner img {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      object-fit: cover;
      display: block;
      pointer-events: none;
      user-select: none;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      background: rgba(255, 255, 255, 0.2);
    }

    .ttw-launcher-icon[hidden] {
      display: none;
    }

    .ttw-panel {
      width: min(400px, calc(100vw - 24px));
      height: min(540px, calc(100vh - 24px));
      max-height: 520px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: var(--ttw-radius);
      background: #ffffff;
      box-shadow: var(--ttw-shadow);
      position: absolute;
      right: 0;
      bottom: calc(var(--ttw-launcher-size) + var(--ttw-launcher-gap));
      transform-origin: bottom right;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: scale(0.2) translateY(12px);
      transition:
        opacity 280ms cubic-bezier(0.33, 0.00, 0.00, 1.00),
        transform 280ms cubic-bezier(0.33, 0.00, 0.00, 1.00),
        visibility 280ms;
      z-index: 1;
    }

    .ttw-root.left .ttw-panel {
      right: auto;
      left: 0;
      transform-origin: bottom left;
    }

    .ttw-panel.open {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: scale(1) translateY(0);
    }

    .ttw-shell {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #ffffff;
    }

    .ttw-header {
      position: relative;
      flex-shrink: 0;
      padding: 12px 14px;
      background: linear-gradient(135deg, var(--ttw-theme) 0%, rgba(15, 23, 42, 0.88) 100%);
      color: #ffffff;
    }

    .ttw-header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .ttw-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }

    .ttw-header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.35);
      background: var(--ttw-logo-bg, rgba(255, 255, 255, 0.15));
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      overflow: hidden;
      flex-shrink: 0;
    }

    .ttw-header-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .ttw-header-avatar svg {
      width: 18px;
      height: 18px;
    }

    .ttw-brand-copy {
      min-width: 0;
    }

    .ttw-brand-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .ttw-brand-copy h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ttw-ai-badge {
      background: rgba(255, 255, 255, 0.2);
      text-transform: uppercase;
      font-size: 9px;
      font-weight: bold;
      padding: 2px 5px;
      border-radius: 4px;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }

    .ttw-close {
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: background 150ms;
      flex-shrink: 0;
    }

    .ttw-close:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .ttw-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 2px;
      white-space: nowrap;
    }

    .ttw-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.2);
      animation: ttw-pulse-dot 2s infinite;
    }

    @keyframes ttw-pulse-dot {
      0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4); }
      70% { box-shadow: 0 0 0 5px rgba(52, 211, 153, 0); }
      100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
    }

    .ttw-body {
      position: relative;
      z-index: 2;
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      padding: 14px 16px 12px;
      gap: 10px;
      background: #ffffff;
    }

    .ttw-loading {
      display: none;
      position: absolute;
      inset: 0;
      z-index: 30;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(2px);
    }

    .ttw-loading.active {
      display: flex;
    }

    .ttw-spinner {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 3px solid rgba(148, 163, 184, 0.25);
      border-top-color: var(--ttw-theme);
      animation: ttw-spin 0.75s linear infinite;
    }

    @keyframes ttw-spin {
      to { transform: rotate(360deg); }
    }

    .ttw-onboarding,
    .ttw-chat {
      display: none;
      min-height: 0;
    }

    .ttw-onboarding.active,
    .ttw-chat.active {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
      min-height: 0;
    }

    .ttw-card {
      border-radius: 20px;
      border: 1px solid var(--ttw-border);
      background: #f8fafc;
      box-shadow: 0 10px 24px rgba(148, 163, 184, 0.06);
      padding: 18px;
    }

    .ttw-card h4 {
      margin: 0 0 6px;
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }

    .ttw-card p {
      margin: 0;
      color: var(--ttw-muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .ttw-field-grid {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }

    .ttw-field label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--ttw-text);
    }

    .ttw-field input {
      width: 100%;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 13px;
      color: var(--ttw-text);
      background: #ffffff;
      outline: none;
    }

    .ttw-field input:focus {
      border-color: var(--ttw-theme);
      box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
    }

    .ttw-actions {
      display: flex;
      gap: 8px;
      margin-top: 14px;
    }

    .ttw-btn {
      border: 0;
      border-radius: 12px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 160ms ease, opacity 160ms ease;
    }

    .ttw-btn:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    .ttw-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .ttw-btn-primary {
      color: #ffffff;
      background: var(--ttw-theme);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
      flex: 1;
    }

    .ttw-btn-secondary {
      color: var(--ttw-text);
      background: #ffffff;
      border: 1px solid var(--ttw-border);
    }

    .ttw-error {
      min-height: 14px;
      color: #dc2626;
      font-size: 11px;
      margin-top: 6px;
    }

    .ttw-welcome-container {
      text-align: center;
      margin-top: 10px;
      margin-bottom: 6px;
    }

    .ttw-welcome-container h4 {
      margin: 0 0 6px;
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.35;
    }

    .ttw-welcome-container p {
      margin: 0;
      font-size: 13px;
      color: var(--ttw-muted);
      line-height: 1.5;
      padding: 0 8px;
    }

    .ttw-messages {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-right: 4px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scrollbar-width: thin;
      scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
    }

    .ttw-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ttw-row.user {
      align-items: flex-end;
    }

    .ttw-row.bot {
      align-items: flex-start;
    }

    .ttw-message-line {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      max-width: 100%;
      width: 100%;
    }

    .ttw-row.user .ttw-message-line {
      justify-content: flex-end;
    }

    .ttw-bubble-meta {
      font-size: 10px;
      color: var(--ttw-muted);
      padding: 0 4px;
      line-height: 1.2;
    }

    .ttw-row.bot .ttw-bubble-meta {
      padding-left: 40px; /* avatar (28) + gap (8) + bubble pad (4) */
    }

    .ttw-row.user .ttw-bubble-meta {
      text-align: right;
    }

    .ttw-fallback-contact {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      background: #ffffff;
      color: var(--ttw-theme);
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      width: fit-content;
      max-width: 100%;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    .ttw-fallback-contacts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-left: 36px;
      margin-top: 2px;
      max-width: calc(100% - 40px);
    }

    .ttw-fallback-contact:hover {
      background: rgba(15, 23, 42, 0.04);
      border-color: rgba(15, 23, 42, 0.2);
    }

    .ttw-fallback-contact svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .ttw-meta-time {
      white-space: nowrap;
      opacity: 0.85;
    }

    .ttw-message-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: #334155;
      background: var(--ttw-logo-bg, var(--ttw-theme));
      overflow: hidden;
      font-size: 10px;
      font-weight: bold;
      flex-shrink: 0;
    }

    .ttw-message-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .ttw-row.user .ttw-message-avatar {
      display: none;
    }

    .ttw-msg {
      width: fit-content;
      max-width: min(78%, 280px);
      flex: 0 0 auto;
      padding: 9px 13px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.45;
      word-break: normal;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      box-shadow: 0 2px 8px rgba(148, 163, 184, 0.06);
    }

    .ttw-msg.bot {
      color: var(--ttw-text);
      background: #f1f5f9;
      border: 1px solid rgba(148, 163, 184, 0.08);
      border-bottom-left-radius: 4px;
    }

    .ttw-msg.user {
      color: #ffffff;
      background: var(--ttw-theme);
      border-bottom-right-radius: 4px;
    }

    .ttw-msg.typing {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: var(--ttw-muted);
      white-space: nowrap;
      width: max-content;
      max-width: none;
      flex-shrink: 0;
      padding: 10px 14px;
    }

    .ttw-typing-label {
      font-size: 12px;
      line-height: 1;
      white-space: nowrap;
    }

    .ttw-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(100, 116, 139, 0.5);
      animation: ttw-bounce 1s infinite ease-in-out;
    }

    .ttw-dot:nth-child(2) { animation-delay: 0.15s; }
    .ttw-dot:nth-child(3) { animation-delay: 0.3s; }

    .ttw-suggestions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .ttw-suggestions.hidden {
      display: none;
    }

    .ttw-chip {
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 16px;
      padding: 12px 16px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 150ms ease;
    }

    .ttw-chip:hover {
      background: #f1f5f9;
      transform: translateY(-1px);
    }

    .ttw-chip-arrow {
      color: var(--ttw-muted);
      font-weight: bold;
    }

    .ttw-input-shell {
      padding-top: 4px;
      border-top: 1px solid var(--ttw-border);
    }

    .ttw-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 6px;
      border-radius: 100px;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.15);
    }

    .ttw-input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: none;
      background: transparent;
      font-size: 13px;
      color: var(--ttw-text);
      padding: 8px 6px 8px 12px;
    }

    .ttw-send {
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 50%;
      display: grid;
      place-items: center;
      cursor: pointer;
      color: #ffffff;
      background: var(--ttw-theme);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
      transition: transform 150ms ease;
      flex-shrink: 0;
    }

    .ttw-send:hover:not(:disabled) {
      transform: scale(1.05);
    }

    .ttw-send:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      box-shadow: none;
    }

    .ttw-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px 8px 0;
      font-size: 10px;
      color: var(--ttw-muted);
    }

    .ttw-powered {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .ttw-powered a {
      color: inherit;
      font-weight: 600;
      text-decoration: none;
    }

    .ttw-powered a:hover {
      text-decoration: underline;
    }

    .ttw-tab-bar {
      display: flex;
      align-items: center;
      justify-content: space-around;
      height: 56px;
      border-top: 1px solid var(--ttw-border);
      background: #f8fafc;
      z-index: 10;
      flex-shrink: 0;
    }

    .ttw-tab-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: 0;
      color: var(--ttw-muted);
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      flex: 1;
      padding: 6px 0;
      transition: color 150ms ease;
    }

    .ttw-tab-item.active {
      color: var(--ttw-theme);
    }

    .ttw-tab-icon {
      width: 18px;
      height: 18px;
    }

    @keyframes ttw-bounce {
      0%, 80%, 100% {
        transform: scale(0.7);
        opacity: 0.55;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }

    @media (max-width: 640px) {
      .ttw-root {
        inset: auto 12px 12px auto;
        --ttw-launcher-size: 58px;
        --ttw-launcher-gap: 12px;
      }

      .ttw-root.left {
        inset: auto auto 12px 12px;
        --ttw-launcher-size: 58px;
        --ttw-launcher-gap: 12px;
      }

      .ttw-panel {
        width: calc(100vw - 24px);
        height: min(78vh, 600px);
        max-height: calc(100vh - 92px);
        border-radius: 20px;
      }
    }


     @keyframes ttw-spin {
       to { transform: rotate(360deg); }
     }

    .ttw-teaser-stack {
      position: absolute;
      bottom: calc(var(--ttw-launcher-size) + var(--ttw-launcher-gap) + 8px);
      right: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      z-index: 2147483001;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 300ms ease, transform 300ms ease;
      pointer-events: none;
      max-width: min(320px, calc(100vw - 24px));
    }

    .ttw-teaser-stack.show {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    .ttw-root.left .ttw-teaser-stack {
      right: auto;
      left: 0;
      align-items: flex-start;
    }

    .ttw-teaser {
      position: relative;
      width: max-content;
      max-width: 100%;
      background: #1a1a1a;
      color: #ffffff;
      padding: 8px 34px 8px 12px;
      border-radius: 14px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.3;
      border: 1px solid rgba(255, 255, 255, 0.06);
      cursor: pointer;
    }

    .ttw-teaser-logo {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      overflow: hidden;
      display: grid;
      place-items: center;
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 1px;
    }

    .ttw-teaser-logo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .ttw-teaser-logo svg {
      width: 13px;
      height: 13px;
    }

    .ttw-teaser-text {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .ttw-teaser-meta {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.55);
      font-weight: 500;
      line-height: 1.2;
    }

    .ttw-teaser-close {
      position: absolute;
      right: 8px;
      top: 8px;
      background: rgba(255, 255, 255, 0.08);
      border: none;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3px;
      border-radius: 999px;
      transition: background-color 150ms ease, color 150ms ease;
    }

    .ttw-teaser-close:hover {
      background-color: rgba(255, 255, 255, 0.16);
      color: #ffffff;
    }

    .ttw-teaser-close svg {
      width: 11px;
      height: 11px;
    }

    .ttw-teaser-suggestions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      width: 100%;
    }

    .ttw-root.left .ttw-teaser-suggestions {
      align-items: flex-start;
    }

    .ttw-teaser-chip {
      background: #1a1a1a;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.25;
      cursor: pointer;
      max-width: 100%;
      text-align: left;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
      transition: transform 150ms ease, background-color 150ms ease;
      font-family: inherit;
    }

    .ttw-teaser-chip:hover {
      background: #2a2a2a;
      transform: translateY(-1px);
    }

    .ttw-human-row {
      display: none;
      margin-top: 8px;
    }

    .ttw-human-row.ttw-visible {
      display: block;
    }

    .ttw-human-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.35);
      background: rgba(255, 255, 255, 0.14);
      color: #ffffff;
      border-radius: 999px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
    }

    .ttw-human-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.24);
      border-color: rgba(255, 255, 255, 0.55);
      transform: translateY(-1px);
    }

    .ttw-human-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none;
    }

    .ttw-human-btn svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .ttw-live-banner {
      display: none;
      flex-direction: column;
      gap: 4px;
      align-items: center;
      text-align: center;
      padding: 10px 12px;
      border-radius: 14px;
      background: #f8fafc;
      border: 1px solid var(--ttw-border);
      font-size: 12px;
      color: var(--ttw-muted);
      flex-shrink: 0;
    }

    .ttw-live-banner.active {
      display: flex;
    }

    .ttw-live-banner .ttw-live-title {
      font-weight: 700;
      color: var(--ttw-text);
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ttw-live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f59e0b;
      animation: ttw-pulse-dot 1.2s infinite;
      flex-shrink: 0;
    }

    .ttw-live-banner.active .ttw-live-dot {
      background: #34d399;
    }

    .ttw-live-back {
      background: none;
      border: 0;
      color: var(--ttw-muted);
      font-size: 11px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      text-decoration: underline;
      padding: 2px;
      margin-top: 2px;
    }

    .ttw-live-back:hover {
      color: var(--ttw-theme);
    }

     `;

  const TEMPLATE = `
    <div class="ttw-root" id="ttw-root">
      <div class="ttw-backdrop" id="ttw-backdrop" aria-hidden="true"></div>
      <div class="ttw-panel" id="ttw-panel" aria-hidden="true">
        <div class="ttw-shell">
          <div class="ttw-header">
            <div class="ttw-header-top">
              <div class="ttw-brand">
                <div class="ttw-header-avatar" id="ttw-header-avatar" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2.75a4.25 4.25 0 0 0-4.25 4.25v1.1A5.75 5.75 0 0 0 4.5 13.25V15A2.75 2.75 0 0 0 7.25 17.75h1.17l-.54 2.15a.75.75 0 0 0 1.16.8l4.02-2.95h3.69A2.75 2.75 0 0 0 19.5 15v-1.75a5.75 5.75 0 0 0-3.25-5.15V7A4.25 4.25 0 0 0 12 2.75Z" fill="currentColor"/>
                  </svg>
                </div>
                <div class="ttw-brand-copy">
                  <div class="ttw-brand-title-row">
                    <h3 id="ttw-title">AI Assistant</h3>
                    <span class="ttw-ai-badge">AI</span>
                  </div>
                  <div class="ttw-status" id="ttw-status-bar">
                    <span class="ttw-status-dot"></span>
                    <span>AI agent • online</span>
                  </div>
                </div>
              </div>
              <div class="ttw-header-actions" style="display: flex; gap: 6px;">
                <button class="ttw-close" id="ttw-close" type="button" aria-label="Close chat">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="ttw-human-row" id="ttw-human-row">
              <button class="ttw-human-btn" id="ttw-human-btn" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>Chat with a real person</span>
              </button>
            </div>
          </div>

          <div class="ttw-body">
            <div class="ttw-loading" id="ttw-loading" aria-live="polite" aria-busy="true">
              <div class="ttw-spinner" role="status" aria-label="Loading"></div>
            </div>
            <div class="ttw-onboarding active" id="ttw-onboarding">
              <div class="ttw-card">
                <h4>Start your chat</h4>
                <p>Share your name and email before chatting. You can skip this step if you prefer.</p>
                <div class="ttw-field-grid">
                  <div class="ttw-field">
                    <label for="ttw-name">Name</label>
                    <input id="ttw-name" type="text" placeholder="Your name" maxlength="80" />
                  </div>
                  <div class="ttw-field">
                    <label for="ttw-email">Email</label>
                    <input id="ttw-email" type="email" placeholder="you@example.com" maxlength="120" />
                  </div>
                </div>
                <div class="ttw-error" id="ttw-form-error"></div>
                <div class="ttw-actions">
                  <button class="ttw-btn ttw-btn-primary" id="ttw-start-btn" type="button">Continue to chat</button>
                  <button class="ttw-btn ttw-btn-secondary" id="ttw-skip-btn" type="button">Skip</button>
                </div>
              </div>
            </div>

            <div class="ttw-chat" id="ttw-chat">
              <div class="ttw-welcome-container" id="ttw-welcome-container">
                <h4 id="ttw-welcome-title">Hi, I'm an AI agent 👋</h4>
                <p id="ttw-welcome-subtitle">I can answer anything about how we work, what it costs, or how we compare.</p>
              </div>
              <div class="ttw-messages" id="ttw-messages"></div>
              <div class="ttw-suggestions" id="ttw-suggestions"></div>
              <div class="ttw-live-banner" id="ttw-live-banner">
                <span class="ttw-live-title"><span class="ttw-live-dot"></span><span id="ttw-live-title-text">Connecting you to a real person…</span></span>
                <span id="ttw-live-subtext">A support agent will join shortly. Please wait.</span>
                <button class="ttw-live-back" id="ttw-live-back" type="button">Back to AI conversation</button>
              </div>
              <div class="ttw-input-shell">
                <div class="ttw-input-row">
                  <input id="ttw-input" class="ttw-input" type="text" maxlength="1000" placeholder="Type your message..." />
                  <button id="ttw-send" class="ttw-send" type="button" aria-label="Send message">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 20.25L21 12 3 3.75V10.5L14 12 3 13.5V20.25Z" fill="currentColor"/>
                    </svg>
                  </button>
                </div>
                <div class="ttw-footer">
                  <div class="ttw-powered">
                    <span>Powered by <a href="https://botwebai.com" target="_blank" rel="noopener noreferrer">BotWebAI</a></span>
                  </div>
                </div>
              </div>
            </div>

          </div>
          
          <div class="ttw-tab-bar" id="ttw-tab-bar" style="display: none;">
            <button class="ttw-tab-item active" id="ttw-tab-home" type="button">
              <svg class="ttw-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span>Home</span>
            </button>
            <button class="ttw-tab-item" id="ttw-tab-messages" type="button">
              <svg class="ttw-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>Messages</span>
            </button>
          </div>
        </div>
      </div>

      <div class="ttw-center-composer" id="ttw-center-composer"></div>

      <div class="ttw-teaser-stack" id="ttw-teaser-stack">
        <div class="ttw-teaser" id="ttw-teaser" role="button" tabindex="0" aria-label="Open chat">
          <div class="ttw-teaser-logo" id="ttw-teaser-logo" aria-hidden="true"></div>
          <span class="ttw-teaser-text" id="ttw-teaser-text"></span>
          <div class="ttw-teaser-meta" id="ttw-teaser-meta"></div>
          <button class="ttw-teaser-close" id="ttw-teaser-close" type="button" aria-label="Close message">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="ttw-teaser-suggestions" id="ttw-teaser-suggestions"></div>
      </div>

      <button class="ttw-launcher" id="ttw-launcher" type="button" aria-label="Open chat">
        <span class="ttw-launcher-label">Continue conversation</span>
        <span class="ttw-launcher-icon ttw-launcher-icon-chat" id="ttw-launcher-icon-chat" aria-hidden="true">
          <div class="ttw-launcher-shape">
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="ttw-launcher-bg-svg" id="ttw-launcher-bg-svg">
              <path d="M26 4H48C53.76 4 56 6.24 56 10V30C56 42.15 46.15 52 34 52H26C13.85 52 4 42.15 4 30V26C4 13.85 13.85 4 26 4Z" fill="var(--ttw-widget-bg, #2678FF)" />
              <g id="ttw-launcher-shared-icon">
                <rect x="18" y="20" width="24" height="20" rx="5" fill="#ffffff" />
                <rect x="22.5" y="26" width="15" height="3" rx="1.5" fill="var(--ttw-widget-bg, #2678FF)" />
                <rect x="22.5" y="32.5" width="9" height="3" rx="1.5" fill="var(--ttw-widget-bg, #2678FF)" />
              </g>
            </svg>
            <div class="ttw-launcher-inner" id="ttw-launcher-inner" hidden></div>
          </div>
        </span>
        <span class="ttw-launcher-icon ttw-launcher-icon-close" hidden aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </button>
    </div>
    `;

  function query(selector) {
    return shadow.querySelector(selector);
  }

  function safeStorageGet(type, key) {
    try {
      return window[type].getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function safeStorageSet(type, key, value) {
    try {
      window[type].setItem(key, value);
    } catch (_error) {
      return null;
    }
    return value;
  }

  function getVisitorToken() {
    let token = safeStorageGet("localStorage", storageKeys.visitorToken);
    if (!token) {
      token = "visitor_" + Math.random().toString(36).substring(2, 15);
      safeStorageSet("localStorage", storageKeys.visitorToken, token);
    }
    return token;
  }

  function getVisitorAccessToken() {
    return currentVisitorAccessToken || safeStorageGet("localStorage", storageKeys.visitorAccessToken);
  }

  function setVisitorAccessToken(token) {
    currentVisitorAccessToken = token;
    safeStorageSet("localStorage", storageKeys.visitorAccessToken, token);
  }

  function liveRequestHeaders(extra) {
    var token = getVisitorAccessToken();
    return requestHeaders(Object.assign({}, extra || {}, token ? { "X-Visitor-Access-Token": token } : {}));
  }

  function getSessionId() {
    let sessionId = safeStorageGet("sessionStorage", storageKeys.sessionId);
    if (!sessionId) {
      sessionId = "sess_" + Math.random().toString(36).substring(2, 15);
      safeStorageSet("sessionStorage", storageKeys.sessionId, sessionId);
    }
    return sessionId;
  }

  function getStoredVisitorProfile() {
    const raw = safeStorageGet("localStorage", storageKeys.visitorProfile);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  function setStoredVisitorProfile(profile) {
    safeStorageSet("localStorage", storageKeys.visitorProfile, JSON.stringify(profile));
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getClientProfile(overrides) {
    const userAgent = navigator.userAgent || "";
    const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "Unknown";
    const lowerUserAgent = userAgent.toLowerCase();
    const deviceType = /iphone|android.+mobile|mobile|ipad/.test(lowerUserAgent)
      ? "Phone"
      : /tablet/.test(lowerUserAgent)
        ? "Tablet"
        : "Laptop/Desktop";

    return {
      name: (overrides && overrides.name) || undefined,
      email: (overrides && overrides.email) || undefined,
      skippedProfile: Boolean(overrides && overrides.skippedProfile),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
      language: navigator.language || undefined,
      platform,
      deviceType,
      userAgent,
    };
  }

  function formatTimeAgo(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 45) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes === 1 ? "1 min ago" : minutes + " mins ago";

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? "1 hour ago" : hours + " hours ago";

    const days = Math.floor(hours / 24);
    if (days < 30) return days === 1 ? "1 day ago" : days + " days ago";

    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? "1 month ago" : months + " months ago";

    const years = Math.floor(days / 365);
    return years === 1 ? "1 year ago" : years + " years ago";
  }

  function createMessageRow(role, content, extraClass, createdAt) {
    const row = document.createElement("div");
    row.className = "ttw-row " + role;

    const line = document.createElement("div");
    line.className = "ttw-message-line";

    if (role === "bot") {
      const avatar = document.createElement("div");
      avatar.className = "ttw-message-avatar";
      if (botConfig && botConfig.logo) {
        avatar.innerHTML = '<img src="' + escapeHtml(botConfig.logo) + '" alt="" />';
      } else if (botConfig && botConfig.name) {
        avatar.textContent = botConfig.name.substring(0, 1).toUpperCase();
      } else {
        avatar.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.75a4.25 4.25 0 0 0-4.25 4.25v1.1A5.75 5.75 0 0 0 4.5 13.25V15A2.75 2.75 0 0 0 7.25 17.75h1.17l-.54 2.15a.75.75 0 0 0 1.16.8l4.02-2.95h3.69A2.75 2.75 0 0 0 19.5 15v-1.75a5.75 5.75 0 0 0-3.25-5.15V7A4.25 4.25 0 0 0 12 2.75Z" fill="currentColor"/></svg>';
      }
      line.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "ttw-msg " + role + (extraClass ? " " + extraClass : "");
    bubble.innerHTML = content;
    line.appendChild(bubble);
    row.appendChild(line);

    if (createdAt) {
      const meta = document.createElement("div");
      meta.className = "ttw-bubble-meta";
      const timeEl = document.createElement("span");
      timeEl.className = "ttw-meta-time";
      const iso = createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);
      timeEl.setAttribute("data-ts", iso);
      timeEl.textContent = formatTimeAgo(iso);
      meta.appendChild(timeEl);
      row.appendChild(meta);
    }

    return row;
  }

  function playChatSound(role) {
    try {
      var src = backendUrl + (role === "user" ? "/user.mp3" : "/bot.mp3");
      var audio = new Audio(src);
      audio.volume = 0.6;
      var playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () { });
      }
    } catch (_e) { }
  }

  function appendMessage(role, text, createdAt) {
    const messagesEl = query("#ttw-messages");
    const safe = escapeHtml(text).replace(/\n/g, "<br>");
    const row = createMessageRow(role, safe, null, createdAt || new Date().toISOString());
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  function appendTyping() {
    const messagesEl = query("#ttw-messages");
    const label = "Typing…";
    const typingMarkup = '<span class="ttw-dot"></span><span class="ttw-dot"></span><span class="ttw-dot"></span><span class="ttw-typing-label">' + label + '</span>';
    const row = createMessageRow("bot", typingMarkup, "typing");
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  function setMessageTimestamp(row, createdAt) {
    if (!row) return;

    const iso = createdAt
      ? (createdAt instanceof Date ? createdAt.toISOString() : String(createdAt))
      : new Date().toISOString();

    var meta = row.querySelector(".ttw-bubble-meta");
    if (!meta) {
      meta = document.createElement("div");
      meta.className = "ttw-bubble-meta";
      row.appendChild(meta);
    }

    var timeEl = meta.querySelector(".ttw-meta-time");
    if (!timeEl) {
      timeEl = document.createElement("span");
      timeEl.className = "ttw-meta-time";
      meta.appendChild(timeEl);
    }
    timeEl.setAttribute("data-ts", iso);
    timeEl.textContent = formatTimeAgo(iso);
  }

  function refreshMessageTimestamps() {
    const messagesEl = query("#ttw-messages");
    if (!messagesEl) return;
    messagesEl.querySelectorAll(".ttw-meta-time[data-ts]").forEach(function (el) {
      el.textContent = formatTimeAgo(el.getAttribute("data-ts"));
    });
  }

  function updateBotMessageRow(row, text, createdAt) {
    if (!row) return;
    const bubble = row.querySelector(".ttw-msg");
    if (!bubble) return;
    bubble.classList.remove("typing");
    bubble.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
    if (createdAt !== undefined) {
      setMessageTimestamp(row, createdAt);
    }
    const messagesEl = query("#ttw-messages");
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function fallbackContactHref(type, value) {
    if (!type || !value) return null;
    if (type === "EMAIL") return "mailto:" + value;
    if (type === "WHATSAPP") return "https://wa.me/" + String(value).replace(/\D/g, "");
    if (type === "TELEGRAM") return "https://t.me/" + String(value).replace(/^@/, "");
    if (type === "PHONE") return "tel:" + value;
    return null;
  }

  function fallbackContactLabel(type) {
    if (type === "EMAIL") return "Email";
    if (type === "WHATSAPP") return "WhatsApp";
    if (type === "TELEGRAM") return "Telegram";
    if (type === "PHONE") return "Call";
    return "Contact";
  }

  function fallbackContactIcon(type) {
    if (type === "EMAIL") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';
    }
    if (type === "WHATSAPP") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';
    }
    if (type === "TELEGRAM") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  }

  function attachFallbackContact(row, contactOrContacts) {
    if (!row || !contactOrContacts) return;

    var contacts = Array.isArray(contactOrContacts)
      ? contactOrContacts
      : contactOrContacts.type && contactOrContacts.value
        ? [contactOrContacts]
        : [];
    if (!contacts.length) return;

    var existing = row.querySelector(".ttw-fallback-contacts");
    if (existing) existing.remove();

    var wrap = document.createElement("div");
    wrap.className = "ttw-fallback-contacts";

    contacts.forEach(function (contact) {
      if (!contact || !contact.type || !contact.value) return;
      var href = fallbackContactHref(contact.type, contact.value);
      if (!href) return;

      var link = document.createElement("a");
      link.className = "ttw-fallback-contact";
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.innerHTML =
        fallbackContactIcon(contact.type) +
        "<span>" +
        escapeHtml(fallbackContactLabel(contact.type)) +
        "</span>";
      wrap.appendChild(link);
    });

    if (!wrap.childNodes.length) return;

    var meta = row.querySelector(".ttw-bubble-meta");
    if (meta) {
      row.insertBefore(wrap, meta);
    } else {
      row.appendChild(wrap);
    }

    var messagesEl = query("#ttw-messages");
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function streamChatResponse(requestBody, typingRow) {
    const response = await fetch(backendUrl + "/api/chat", {
      method: "POST",
      headers: requestHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      var errData = null;
      try { errData = await response.json(); } catch (_e) { }
      throw new Error((errData && errData.error) || "Request failed");
    }

    if (!response.body || !response.body.getReader) {
      var fallback = await response.json();
      playChatSound("bot");
      return fallback;
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var fullText = "";
    var finalResult = null;
    var started = false;
    var botSoundPlayed = false;

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      var parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (var i = 0; i < parts.length; i++) {
        var lines = parts[i].split("\n");
        var dataLine = null;
        for (var j = 0; j < lines.length; j++) {
          var trimmed = lines[j].trim();
          if (trimmed.indexOf("data:") === 0) {
            dataLine = trimmed;
            break;
          }
        }
        if (!dataLine) continue;

        var payload;
        try {
          payload = JSON.parse(dataLine.slice(5).trim());
        } catch (_e) {
          continue;
        }

        if (payload.type === "token" && payload.text) {
          if (!started) {
            started = true;
            if (!botSoundPlayed) {
              botSoundPlayed = true;
              playChatSound("bot");
            }
            if (typingRow) {
              typingRow.querySelector(".ttw-msg") && typingRow.querySelector(".ttw-msg").classList.remove("typing");
            }
          }
          fullText += payload.text;
          updateBotMessageRow(typingRow, fullText);
        } else if (payload.type === "done") {
          finalResult = payload;
          if (!botSoundPlayed) {
            botSoundPlayed = true;
            playChatSound("bot");
          }
          if (payload.response) {
            fullText = payload.response;
            updateBotMessageRow(typingRow, fullText);
          }
        } else if (payload.type === "error") {
          throw new Error(payload.error || "Failed to generate response");
        }
      }
    }

    if (!finalResult) {
      throw new Error("Stream ended without a response");
    }

    return {
      id: finalResult.id,
      response: finalResult.response || fullText,
      createdAt: finalResult.createdAt,
      visitorId: finalResult.visitorId || null,
      visitorAccessToken: finalResult.visitorAccessToken || null,
      fallbackContact: finalResult.fallbackContact || null,
      fallbackContacts: finalResult.fallbackContacts || null,
    };
  }

  function hideTeaser(dismiss) {
    const teaserStack = query("#ttw-teaser-stack");
    if (teaserStack) {
      teaserStack.classList.remove("show");
    }
    if (dismiss) {
      teaserDismissed = true;
    }
  }

  function getTeaserLogoMarkup() {
    if (botConfig && botConfig.logo) {
      return '<img src="' + escapeHtml(botConfig.logo) + '" alt="" />';
    }
    if (botConfig && botConfig.name) {
      return "<span>" + escapeHtml(botConfig.name.substring(0, 1).toUpperCase()) + "</span>";
    }
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.75a4.25 4.25 0 0 0-4.25 4.25v1.1A5.75 5.75 0 0 0 4.5 13.25V15A2.75 2.75 0 0 0 7.25 17.75h1.17l-.54 2.15a.75.75 0 0 0 1.16.8l4.02-2.95h3.69A2.75 2.75 0 0 0 19.5 15v-1.75a5.75 5.75 0 0 0-3.25-5.15V7A4.25 4.25 0 0 0 12 2.75Z" fill="currentColor"/></svg>';
  }

  function renderTeaserSuggestions() {
    const suggestionsEl = query("#ttw-teaser-suggestions");
    if (!suggestionsEl) return;
    suggestionsEl.innerHTML = "";

    suggestedQuestions.forEach(function (question) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ttw-teaser-chip";
      button.textContent = question;
      button.addEventListener("click", function (e) {
        e.stopPropagation();
        handleTeaserSuggestion(question);
      });
      suggestionsEl.appendChild(button);
    });
  }

  let pendingTeaserQuestion = null;

  function flushPendingTeaserQuestion() {
    if (!pendingTeaserQuestion || !visitorReady || !chatBootstrapped) return;
    var questionToSend = pendingTeaserQuestion;
    pendingTeaserQuestion = null;
    var input = query("#ttw-input");
    if (input) {
      input.value = questionToSend;
    }
    setWidgetTab("messages");
    sendMessage();
  }

  function handleTeaserSuggestion(question) {
    hideTeaser(true);
    pendingTeaserQuestion = question;

    if (!isOpen) {
      toggleWidget(true);
      return;
    }

    // Widget already open — send once visitor/history bootstrap is done
    if (visitorReady && chatBootstrapped) {
      flushPendingTeaserQuestion();
    } else {
      ensureVisitorReady()
        .then(function () {
          flushPendingTeaserQuestion();
        })
        .catch(function () { });
    }
  }

  function showTeaser() {
    const teaserStack = query("#ttw-teaser-stack");
    const root = query("#ttw-root");
    if (!teaserStack || root.classList.contains("center") || isOpen || teaserDismissed) return;
    teaserStack.classList.add("show");
    playChatSound("bot");
  }

  function clearMessages() {
    query("#ttw-messages").innerHTML = "";
  }

  function renderSuggestions() {
    const suggestionsEl = query("#ttw-suggestions");
    suggestionsEl.innerHTML = "";

    suggestedQuestions.forEach(function (question) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ttw-chip";
      button.textContent = question;
      button.addEventListener("click", function () {
        query("#ttw-input").value = question;
        sendMessage();
      });
      suggestionsEl.appendChild(button);
    });
  }

  function hideSuggestions() {
    query("#ttw-suggestions").classList.add("hidden");
  }

  function showSuggestions() {
    query("#ttw-suggestions").classList.remove("hidden");
  }

  function requestHeaders(baseHeaders) {
    const headers = Object.assign({}, baseHeaders || {});
    if (widgetApiKey) {
      headers["X-Widget-Api-Key"] = widgetApiKey;
    }
    return headers;
  }

  function canShowHumanRow() {
    return !!(botConfig && botConfig.liveChatAvailable === true && !liveChat);
  }

  function syncHumanRowVisibility() {
    const humanRow = query("#ttw-human-row");
    if (!humanRow) return;
    humanRow.classList.toggle("ttw-visible", canShowHumanRow());
  }

  function setWidgetTab(tabName) {
    activeTab = tabName;
    const homeTab = query("#ttw-tab-home");
    const msgsTab = query("#ttw-tab-messages");
    if (homeTab) homeTab.classList.toggle("active", tabName === "home");
    if (msgsTab) msgsTab.classList.toggle("active", tabName === "messages");

    const welcome = query("#ttw-welcome-container");
    const suggestions = query("#ttw-suggestions");
    const messages = query("#ttw-messages");

    if (tabName === "home") {
      if (welcome) welcome.style.display = "block";
      if (suggestions) suggestions.style.display = "flex";
      if (messages) messages.style.display = "none";
    } else {
      if (welcome) welcome.style.display = "none";
      if (suggestions) suggestions.style.display = "none";
      if (messages) messages.style.display = "flex";
    }
    syncHumanRowVisibility();
  }

  function setMode(mode) {
    query("#ttw-onboarding").classList.toggle("active", mode === "onboarding");
    query("#ttw-chat").classList.toggle("active", mode === "chat");
    const centerComposer = query("#ttw-center-composer");
    if (centerComposer) {
      centerComposer.classList.toggle("active", mode === "chat");
    }

    const title = query("#ttw-title");
    const tabBar = query("#ttw-tab-bar");
    if (tabBar) tabBar.style.display = (mode === "chat" ? "flex" : "none");
    title.textContent = (botConfig && botConfig.name) || "AI Assistant";

    if (mode === "chat") {
      setWidgetTab(activeTab);
    }
  }

  async function loadConversationHistory() {
    if (!botConfig || !botConfig.id) return;

    try {
      const accessToken = getVisitorAccessToken();
      if (!accessToken) throw new Error("No visitor session");

      const response = await fetch(
        backendUrl + "/api/chat/" + botConfig.id,
        {
          headers: requestHeaders({ "X-Visitor-Access-Token": accessToken }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load conversations");
      }

      const conversations = await response.json();

      clearMessages();

      if (!Array.isArray(conversations) || conversations.length === 0) {
        appendMessage("bot", "Hi! How can I help you today?");
        showSuggestions();
        setWidgetTab("home");
        return;
      }

      hideSuggestions();
      conversations.forEach(function (conversation) {
        const createdAt = conversation.createdAt || null;
        appendMessage("user", conversation.userMessage, createdAt);
        appendMessage("bot", conversation.aiResponse, createdAt);
      });
      // Show the messages tab so restored history is visible after refresh
      setWidgetTab("messages");
      const messagesEl = query("#ttw-messages");
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (_error) {
      clearMessages();
      appendMessage("bot", "Hi! How can I help you today?");
      showSuggestions();
      setWidgetTab("home");
    }
  }

  async function registerVisitor(overrides) {
    if (isRegistering) return false;
    isRegistering = true;
    setPanelLoading(true);
    query("#ttw-form-error").textContent = "";
    query("#ttw-start-btn").disabled = true;
    query("#ttw-skip-btn").disabled = true;

    try {
      const response = await fetch(backendUrl + "/api/chat/visitor/register", {
        method: "POST",
        headers: requestHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          botName: botConfig.botName,
          widgetApiKey: widgetApiKey,
          visitorId: visitorProfile && visitorProfile.id,
          visitorToken: getVisitorToken(),
          visitorAccessToken: getVisitorAccessToken(),
          sessionId: getSessionId(),
          profile: getClientProfile(overrides),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to register visitor");
      }

      const data = await response.json();
      if (data.visitorAccessToken) {
        setVisitorAccessToken(data.visitorAccessToken);
      }
      visitorProfile = {
        id: data.id,
        name: data.name,
        email: data.email,
        skippedProfile: data.skippedProfile,
        timezone: data.timezone,
        language: data.language,
        platform: data.platform,
        deviceType: data.deviceType,
        country: data.country,
      };
      setStoredVisitorProfile(visitorProfile);
      visitorReady = true;
      setMode("chat");
      await loadConversationHistory();
      chatBootstrapped = true;
      flushPendingTeaserQuestion();
      return true;
    } catch (error) {
      query("#ttw-form-error").textContent = "Could not start the chat. Please try again.";
      console.error("[BotWebAI] Visitor registration failed:", error);
      return false;
    } finally {
      isRegistering = false;
      setPanelLoading(false);
      query("#ttw-start-btn").disabled = false;
      query("#ttw-skip-btn").disabled = false;
    }
  }

  async function ensureVisitorReady() {
    if (visitorReady) {
      setMode("chat");
      if (!chatBootstrapped) {
        await loadConversationHistory();
        chatBootstrapped = true;
      }
      flushPendingTeaserQuestion();
      return;
    }

    const storedVisitor = getStoredVisitorProfile();
    if (storedVisitor && storedVisitor.id) {
      visitorProfile = storedVisitor;
      setMode("chat");
      const success = await registerVisitor({
        name: storedVisitor.name && storedVisitor.name !== "Anonymous User" ? storedVisitor.name : undefined,
        email: storedVisitor.email || undefined,
        skippedProfile: Boolean(storedVisitor.skippedProfile),
      });
      if (success) {
        return;
      }
    }

    setMode("onboarding");
  }

  function setPanelLoading(isLoading) {
    const loadingEl = query("#ttw-loading");
    if (!loadingEl) return;
    loadingEl.classList.toggle("active", Boolean(isLoading));
    loadingEl.setAttribute("aria-busy", String(Boolean(isLoading)));
  }

  function toggleWidget(forceOpen) {
    const panel = query("#ttw-panel");
    const launcher = query("#ttw-launcher");
    const root = query("#ttw-root");
    isOpen = typeof forceOpen === "boolean" ? forceOpen : !isOpen;

    root.classList.toggle("open", isOpen);
    panel.classList.toggle("open", isOpen);
    panel.setAttribute("aria-hidden", String(!isOpen));
    launcher.classList.toggle("open", isOpen);
    launcher.setAttribute("aria-label", isOpen ? "Close chat" : "Open chat");

    const chatIcon = launcher.querySelector(".ttw-launcher-icon-chat");
    const closeIcon = launcher.querySelector(".ttw-launcher-icon-close");
    if (chatIcon) chatIcon.hidden = isOpen;
    if (closeIcon) closeIcon.hidden = !isOpen;

    const teaser = query("#ttw-teaser-stack") || query("#ttw-teaser");
    if (teaser && isOpen) {
      hideTeaser(true);
    }

    if (isOpen) {
      // Show chat UI + center input immediately for returning visitors;
      // history/registration can finish in the background.
      const storedVisitor = getStoredVisitorProfile();
      if (visitorReady || (storedVisitor && storedVisitor.id)) {
        setMode("chat");
        const input = query("#ttw-input");
        if (input) input.focus();
      }
      if (!chatBootstrapped) setPanelLoading(true);
      ensureVisitorReady()
        .then(function () {
          setPanelLoading(false);
          flushPendingTeaserQuestion();
          const target = visitorReady ? query("#ttw-input") : query("#ttw-name");
          if (target) target.focus();
        })
        .catch(function () {
          setPanelLoading(false);
        });
    } else {
      setPanelLoading(false);
    }
  }

  async function sendMessage() {
    const input = query("#ttw-input");
    const sendButton = query("#ttw-send");
    const message = input.value.trim();
    if (!message || sendButton.disabled || !visitorReady) return;

    if (liveChat) {
      if (liveChat.status === "active") {
        sendLiveMessage();
      }
      return;
    }

    input.value = "";
    hideSuggestions();

    // Automatically switch to messages tab when chatting
    setWidgetTab("messages");

    appendMessage("user", message);
    playChatSound("user");
    sendButton.disabled = true;
    input.disabled = true;

    const typingRow = appendTyping();

    // Check if there are no knowledge bases
    if (botConfig && typeof botConfig.knowledgeSourcesCount === "number" && botConfig.knowledgeSourcesCount === 0) {
      await new Promise(function (resolve) { setTimeout(resolve, 800); });
      typingRow.remove();
      appendMessage("bot", "⚠️ Please add a knowledge base so that the AI can answer your questions.");
      playChatSound("bot");
      sendButton.disabled = false;
      input.disabled = false;
      input.focus();
      return;
    }

    try {
      const data = await streamChatResponse({
        botName: botConfig.botName,
        widgetApiKey: widgetApiKey,
        message: message,
        sessionId: getSessionId(),
        visitorId: visitorProfile.id,
        visitorToken: getVisitorToken(),
        visitorAccessToken: getVisitorAccessToken(),
        visitorProfile: getClientProfile({
          name: visitorProfile.name,
          email: visitorProfile.email,
          skippedProfile: visitorProfile.skippedProfile,
        }),
      }, typingRow);

      if (!data.response) {
        updateBotMessageRow(typingRow, "Sorry, I could not generate a response.", data.createdAt || new Date().toISOString());
      } else {
        setMessageTimestamp(typingRow, data.createdAt || new Date().toISOString());
      }
      if (data.fallbackContacts || data.fallbackContact) {
        attachFallbackContact(typingRow, data.fallbackContacts || data.fallbackContact);
      }
      if (data.visitorId && visitorProfile.id !== data.visitorId) {
        visitorProfile.id = data.visitorId;
        setStoredVisitorProfile(visitorProfile);
      }
      if (data.visitorAccessToken) {
        setVisitorAccessToken(data.visitorAccessToken);
      }
    } catch (_error) {
      if (typingRow && typingRow.parentNode) {
        updateBotMessageRow(typingRow, "Sorry, something went wrong. Please try again.", new Date().toISOString());
      } else {
        appendMessage("bot", "Sorry, something went wrong. Please try again.");
      }
      playChatSound("bot");
    } finally {
      sendButton.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  function liveWsUrl() {
    var base = (backendUrl || "").replace(/\/+$/, "");
    if (/^https?:\/\//i.test(base)) {
      return base.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:") + "/api/live/ws";
    }
    var proto = location.protocol === "https:" ? "wss:" : "ws:";
    var host = location.host;
    if (base.charAt(0) === "/") return proto + "//" + host + base + "/api/live/ws";
    return proto + "//" + host + "/api/live/ws";
  }

  function setLiveMode(enabled) {
    const banner = query("#ttw-live-banner");
    const tabBar = query("#ttw-tab-bar");
    if (banner) banner.classList.toggle("active", enabled);
    if (tabBar) tabBar.style.display = enabled ? "none" : "";
    syncHumanRowVisibility();
  }

  function setLiveBadge(active) {
    const badge = query(".ttw-ai-badge");
    const statusEl = query("#ttw-status-bar");
    if (badge) badge.textContent = active ? "LIVE" : "AI";
    if (statusEl) {
      statusEl.innerHTML = '<span class="ttw-status-dot"></span><span>' +
        (active ? "Support agent • online" : "AI agent • online") +
        '</span>';
    }
  }

  function updateLiveBanner(active) {
    const titleText = query("#ttw-live-title-text");
    const sub = query("#ttw-live-subtext");
    const dot = query("#ttw-live-banner .ttw-live-dot");
    if (active) {
      if (titleText) titleText.textContent = "Live chat • agent online";
      if (sub) sub.textContent = "You're connected with a support agent.";
      if (dot) dot.style.background = "#34d399";
    } else {
      if (titleText) titleText.textContent = "Connecting you to a real person…";
      if (sub) sub.textContent = "A support agent will join shortly. Please wait.";
      if (dot) dot.style.background = "#f59e0b";
    }
  }

  function clearAcceptTimeout() {
    if (!liveChat) return;
    if (liveChat.timeoutId) {
      window.clearTimeout(liveChat.timeoutId);
      liveChat.timeoutId = null;
    }
  }

  function clearLiveTimer() {
    if (!liveChat) return;
    clearAcceptTimeout();
    if (liveChat.intervalId) {
      window.clearInterval(liveChat.intervalId);
      liveChat.intervalId = null;
    }
  }

  function ensureLivePolling() {
    if (!liveChat || liveChat.intervalId) return;
    liveChat.intervalId = window.setInterval(pollLiveChat, 3000);
  }

  function connectLiveSocket(roomId) {
    if (!window.WebSocket) return;
    var ws;
    try {
      ws = new WebSocket(liveWsUrl());
    } catch (_e) {
      return;
    }

    liveChat.ws = ws;

    ws.onopen = function () {
      if (!liveChat || liveChat.roomId !== roomId) {
        try { ws.close(); } catch (_e) { }
        return;
      }
      ws.send(JSON.stringify({
        type: "hello",
        role: "visitor",
        botId: botConfig.id,
        roomId: roomId,
        visitorAccessToken: getVisitorAccessToken(),
      }));
    };

    ws.onmessage = function (event) {
      var payload;
      try { payload = JSON.parse(event.data); } catch (_e) { return; }
      handleLiveSocketMessage(payload);
    };

    ws.onclose = function () {
      if (liveChat && liveChat.ws === ws) liveChat.ws = null;
    };
  }

  function handleLiveSocketMessage(payload) {
    if (!liveChat || !payload) return;

    if (payload.type === "accepted") {
      // Require ACTIVE — owner joining a WAITING room must not unlock chat.
      if (liveChat.status === "waiting" && payload.room && payload.room.status === "ACTIVE") {
        enterLiveActive();
      }
    } else if (payload.type === "expired") {
      if (liveChat.status === "waiting" || liveChat.status === "active") {
        enterLiveExpired(payload.reason || "The chat has ended.");
      }
    } else if (payload.type === "closed") {
      if (liveChat.status !== "expired") enterLiveExpired("The chat has ended.");
    } else if (payload.type === "message" && payload.message) {
      if (liveChat.status !== "active") return;
      if (payload.message.roomId && payload.message.roomId !== liveChat.roomId) return;
      syncLiveMessages([payload.message]);
    } else if (payload.type === "typing") {
      if (payload.sender === "OWNER" && liveChat.status === "active") {
        handleOwnerTyping(payload.isTyping);
      }
    }
  }

  function handleOwnerTyping(isTyping) {
    const msgsEl = query("#ttw-messages");
    if (!msgsEl) return;
    let typingRow = msgsEl.querySelector(".ttw-row.typing-live");
    if (isTyping) {
      if (typingRow) return;
      const row = createMessageRow("bot", '<span class="ttw-dot"></span><span class="ttw-dot"></span><span class="ttw-dot"></span><span class="ttw-typing-label">Support agent typing…</span>', "typing");
      row.classList.add("typing-live");
      msgsEl.appendChild(row);
      msgsEl.scrollTop = msgsEl.scrollHeight;
    } else if (typingRow) {
      typingRow.remove();
    }
  }

  function clearLiveTypingTimer() {
    if (!liveChat) return;
    if (liveChat.typingIdleId) {
      window.clearTimeout(liveChat.typingIdleId);
      liveChat.typingIdleId = null;
    }
  }

  function emitLiveTyping(isTyping) {
    if (!liveChat || liveChat.status !== "active") return;
    if (liveChat.typingActive === isTyping) return;
    liveChat.typingActive = isTyping;

    if (liveChat.ws && liveChat.ws.readyState === 1) {
      try {
        liveChat.ws.send(JSON.stringify({
          type: "typing",
          roomId: liveChat.roomId,
          isTyping: isTyping,
        }));
        return;
      } catch (_e) { }
    }

    if (!visitorProfile || !visitorProfile.id) return;
    fetch(backendUrl + "/api/live/rooms/" + liveChat.roomId + "/typing", {
      method: "POST",
      headers: liveRequestHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        isTyping: isTyping,
      }),
    }).catch(function () { });
  }

  function notifyVisitorTypingActivity() {
    if (!liveChat || liveChat.status !== "active") return;
    emitLiveTyping(true);
    clearLiveTypingTimer();
    liveChat.typingIdleId = window.setTimeout(function () {
      emitLiveTyping(false);
    }, LIVE_TYPING_IDLE_MS);
  }

  function appendLiveMessage(message) {
    if (!message || !message.content) return;
    if (message.sender === "VISITOR") {
      if (liveChat.localIds && liveChat.localIds[message.id]) return;
      appendMessage("user", message.content, message.createdAt);
    } else {
      const typingRow = query("#ttw-messages .ttw-row.typing-live");
      if (typingRow) typingRow.remove();
      appendMessage("bot", message.content, message.createdAt);
      playChatSound("bot");
    }
  }

  function syncLiveMessages(messages) {
    if (!Array.isArray(messages)) return;
    liveChat.seenIds = liveChat.seenIds || {};
    messages.forEach(function (m) {
      if (liveChat.seenIds[m.id]) return;
      liveChat.seenIds[m.id] = true;
      appendLiveMessage(m);
    });
  }

  function enterLiveActive() {
    if (!liveChat || liveChat.status !== "waiting") return;
    liveChat.status = "active";
    // Stop the waiting timeout, but keep (or restart) REST polling.
    // WebSockets only work with `vercel dev` / Vercel production — under plain
    // `next dev` polling is the only way the visitor receives owner messages.
    clearAcceptTimeout();
    ensureLivePolling();
    updateLiveBanner(true);
    setLiveBadge(true);
    appendMessage("bot", "A support agent has joined. You're now in a live chat — they can help you directly.");
    playChatSound("bot");
    const input = query("#ttw-input");
    const send = query("#ttw-send");
    if (input) { input.disabled = false; }
    if (send) { send.disabled = false; }
    if (input) input.focus();
  }

  function enterLiveExpired(messageText) {
    if (!liveChat) return;
    const wasActive = liveChat.status === "active";
    liveChat.status = "expired";
    clearLiveTimer();

    const typingRow = query("#ttw-messages .ttw-row.typing-live");
    if (typingRow) typingRow.remove();

    if (!wasActive) {
      appendMessage("bot", "Customer Care is busy right now. Please try again later, or reach us directly:");
      const rows = query("#ttw-messages").querySelectorAll(".ttw-row.bot");
      if (rows.length && botConfig && botConfig.fallbackContacts && botConfig.fallbackContacts.length) {
        attachFallbackContact(rows[rows.length - 1], botConfig.fallbackContacts);
      }
      playChatSound("bot");
    } else {
      appendMessage("bot", messageText || "The chat has ended. Thanks for reaching out!");
      playChatSound("bot");
    }

    const humanBtn = query("#ttw-human-btn");
    if (humanBtn) humanBtn.disabled = false;

    stopLiveChat(false);
    setMode("chat");
    showSuggestions();
    setLiveBadge(false);
    const input = query("#ttw-input");
    if (input) input.disabled = false;
    const send = query("#ttw-send");
    if (send) send.disabled = false;
  }

  async function pollLiveChat() {
    if (!liveChat || !visitorProfile || !visitorProfile.id) return;
    const roomId = liveChat.roomId;
    try {
      const res = await fetch(
        backendUrl + "/api/live/rooms/" + roomId,
        { headers: liveRequestHeaders() }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data.room) return;
      const room = data.room;

      if (room.status === "ACTIVE" && liveChat.status === "waiting") {
        enterLiveActive();
      } else if ((room.status === "EXPIRED" || room.status === "CLOSED") &&
        (liveChat.status === "waiting" || liveChat.status === "active")) {
        enterLiveExpired();
        return;
      }

      if (liveChat && liveChat.status === "active") {
        syncLiveMessages(data.messages);
        if (data.typing) {
          handleOwnerTyping(Boolean(data.typing.owner));
        }
      }
    } catch (_error) { }
  }

  async function expireLocalLiveChat() {
    if (!liveChat || liveChat.status !== "waiting") return;
    try {
      await fetch(backendUrl + "/api/live/rooms/" + liveChat.roomId + "/expire", {
        method: "POST",
        headers: liveRequestHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ reason: "visitor-timeout" }),
      });
    } catch (_error) { }
    enterLiveExpired();
  }

  async function startLiveChat() {
    if (!botConfig || liveChat) return;

    if (botConfig.liveChatAvailable !== true) {
      setWidgetTab("messages");
      appendMessage("bot", "Live chat with a real person is not available for this assistant right now.");
      playChatSound("bot");
      return;
    }

    const humanBtn = query("#ttw-human-btn");
    if (humanBtn) humanBtn.disabled = true;

    try {
      await ensureVisitorReady();
    } catch (_e) { }
    if (!visitorReady || !visitorProfile || !visitorProfile.id) {
      setWidgetTab("messages");
      appendMessage("bot", "Please share your details first so we can connect you with a person.");
      playChatSound("bot");
      if (humanBtn) humanBtn.disabled = false;
      return;
    }

    let room;
    try {
      const res = await fetch(backendUrl + "/api/live/rooms", {
        method: "POST",
        headers: liveRequestHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          botName: botConfig.botName,
          widgetApiKey: widgetApiKey,
          sessionId: getSessionId(),
          visitorAccessToken: getVisitorAccessToken(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err && err.error) || "Could not start live chat");
      }
      room = await res.json();
      if (room.visitorAccessToken) setVisitorAccessToken(room.visitorAccessToken);
    } catch (error) {
      setWidgetTab("messages");
      const msg = error && error.message ? String(error.message) : "";
      appendMessage(
        "bot",
        msg.toLowerCase().indexOf("plan") >= 0
          ? "Live chat is a Pro plan feature. Please ask the owner to upgrade."
          : "Sorry, we couldn't connect you to a real person right now. Please try again in a moment."
      );
      playChatSound("bot");
      if (humanBtn) humanBtn.disabled = false;
      return;
    }

    liveChat = {
      roomId: room.id,
      status: "waiting",
      ws: null,
      timeoutId: null,
      intervalId: null,
      seenIds: {},
      localIds: {},
      typingIdleId: null,
      typingActive: false,
    };

    setLiveMode(true);
    setLiveBadge(false);
    updateLiveBanner(false);
    hideSuggestions();
    setWidgetTab("messages");

    appendMessage("bot", "Connecting you to a real person… one moment please.");
    playChatSound("bot");

    const input = query("#ttw-input");
    const send = query("#ttw-send");
    if (input) input.disabled = true;
    if (send) send.disabled = true;

    connectLiveSocket(room.id);

    liveChat.timeoutId = window.setTimeout(function () {
      if (liveChat && liveChat.status === "waiting") {
        expireLocalLiveChat();
      }
    }, LIVE_ACCEPT_TIMEOUT_MS + 1500);

    ensureLivePolling();
  }

  function stopLiveChat(notifyServer, reason) {
    clearLiveTimer();
    clearLiveTypingTimer();
    if (liveChat && liveChat.typingActive) {
      emitLiveTyping(false);
    }
    if (liveChat && liveChat.ws) {
      try {
        liveChat.ws.onclose = null;
        liveChat.ws.close();
      } catch (_e) { }
    }
    if (liveChat && notifyServer !== false && visitorProfile && visitorProfile.id) {
      var expireReason =
        reason ||
        (liveChat.status === "waiting" ? "visitor-timeout" : "visitor-left");
      fetch(backendUrl + "/api/live/rooms/" + liveChat.roomId + "/expire", {
        method: "POST",
        headers: liveRequestHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          reason: expireReason,
        }),
      }).catch(function () { });
    }
    liveChat = null;
    setLiveMode(false);
    syncHumanRowVisibility();
  }

  async function sendLiveMessage() {
    const input = query("#ttw-input");
    const sendButton = query("#ttw-send");
    const message = input.value.trim();
    if (!message || sendButton.disabled || !liveChat || liveChat.status !== "active") return;

    input.value = "";
    appendMessage("user", message);
    playChatSound("user");
    sendButton.disabled = true;

    clearLiveTypingTimer();
    emitLiveTyping(false);

    try {
      const res = await fetch(backendUrl + "/api/live/rooms/" + liveChat.roomId + "/messages", {
        method: "POST",
        headers: liveRequestHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ content: message }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err && err.error) || "Failed to send");
      }
      const data = await res.json();
      if (data.message && data.message.id) {
        liveChat.localIds = liveChat.localIds || {};
        liveChat.localIds[data.message.id] = true;
      }
    } catch (_error) {
      appendMessage("bot", "Could not send your message. Please try again.");
      playChatSound("bot");
    } finally {
      sendButton.disabled = false;
      input.focus();
    }
  }

  async function init() {
    try {
      const res = await fetch(backendUrl + "/api/widget/config/" + botName, {
        headers: requestHeaders(),
      });
      if (!res.ok) throw new Error("Bot not found");
      botConfig = await res.json();
    } catch (error) {
      console.error("[BotWebAI] Failed to load bot config:", error);
      return;
    }

    host = document.createElement("div");
    host.id = "ttw-widget-host";
    shadow = host.attachShadow({ mode: "open" });

    const styleEl = document.createElement("style");
    styleEl.textContent = STYLES;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = TEMPLATE;

    shadow.appendChild(styleEl);
    shadow.appendChild(wrapper);
    document.body.appendChild(host);

    const root = query("#ttw-root");
    root.classList.toggle("left", botConfig.widgetPosition === "BOTTOM_LEFT");
    root.classList.toggle("center", botConfig.widgetPosition === "CENTER");
    if (botConfig.widgetPosition === "CENTER") {
      const inputShell = query(".ttw-input-shell");
      const centerComposer = query("#ttw-center-composer");
      if (inputShell && centerComposer) {
        centerComposer.appendChild(inputShell);
      }
    }

    // Apply dynamic theme color & logo background color
    if (botConfig.themeColor) {
      root.style.setProperty("--ttw-theme", botConfig.themeColor);
    }
    if (botConfig.logoBgColor) {
      root.style.setProperty("--ttw-logo-bg", botConfig.logoBgColor);
    }
    // Widget launcher background: shared blue when unset/white and no custom launcher logo
    var rawWidgetBg = botConfig.widgetLogoBgColor || "#2678FF";
    var widgetBgNorm = String(rawWidgetBg).trim().toLowerCase();
    var widgetBg =
      !botConfig.widgetLogo && (widgetBgNorm === "#fff" || widgetBgNorm === "#ffffff")
        ? "#2678FF"
        : rawWidgetBg;
    root.style.setProperty("--ttw-widget-bg", widgetBg);

    // Free plans show BotWebAI branding; paid plans hide it
    const poweredEl = query(".ttw-powered");
    if (poweredEl) {
      poweredEl.style.display = botConfig.showBranding === false ? "none" : "";
    }

    // Configure custom logo / avatar
    const avatarContainer = query("#ttw-header-avatar");
    if (avatarContainer) {
      if (botConfig.logo) {
        avatarContainer.innerHTML = `<img src="${botConfig.logo}" alt="Logo" />`;
      } else {
        const letter = botConfig.name ? botConfig.name.substring(0, 1).toUpperCase() : "A";
        avatarContainer.innerHTML = `<span>${letter}</span>`;
      }
    }

    // Configure custom launcher icon: custom center logo, else shared chat-card SVG
    const launcherInner = query("#ttw-launcher-inner");
    const sharedIcon = query("#ttw-launcher-shared-icon");
    if (launcherInner) {
      const launcherLogo = botConfig.widgetLogo;
      if (launcherLogo) {
        if (sharedIcon) sharedIcon.setAttribute("hidden", "true");
        launcherInner.hidden = false;
        launcherInner.innerHTML = `<img src="${launcherLogo}" alt="Logo" style="background-color: var(--ttw-widget-bg, transparent);" />`;
      } else {
        if (sharedIcon) sharedIcon.removeAttribute("hidden");
        launcherInner.hidden = true;
        launcherInner.innerHTML = "";
      }
    }

    // Configure custom welcome headings
    const welcomeTitleEl = query("#ttw-welcome-title");
    if (welcomeTitleEl) {
      welcomeTitleEl.textContent = botConfig.welcomeTitle || `Hi, I'm ${botConfig.name || "AI"}'s agent 👋`;
    }
    const welcomeSubtitleEl = query("#ttw-welcome-subtitle");
    if (welcomeSubtitleEl) {
      welcomeSubtitleEl.textContent = botConfig.welcomeSubtitle || "I can answer anything about how we work, what it costs, or how we compare.";
    }

    // Load custom quick questions first (used by home + teaser chips)
    if (botConfig.quickQuestions) {
      suggestedQuestions.length = 0;
      const qList = botConfig.quickQuestions.split(",").map(function (q) { return q.trim(); }).filter(Boolean);
      qList.forEach(function (q) {
        suggestedQuestions.push(q);
      });
    }

    // Configure teaser message (logo on top + suggested chips)
    const teaserStack = query("#ttw-teaser-stack");
    const teaserEl = query("#ttw-teaser");
    const teaserTextEl = query("#ttw-teaser-text");
    const teaserLogoEl = query("#ttw-teaser-logo");
    const teaserMetaEl = query("#ttw-teaser-meta");
    if (teaserStack && teaserEl && teaserTextEl && botConfig.teaserMessage) {
      teaserTextEl.textContent = botConfig.teaserMessage;
      if (teaserLogoEl) {
        teaserLogoEl.innerHTML = getTeaserLogoMarkup();
      }
      if (teaserMetaEl) {
        teaserMetaEl.textContent = (botConfig.name || "AI") + " • Just now";
      }
      renderTeaserSuggestions();

      teaserEl.addEventListener("click", function () {
        hideTeaser(true);
        if (!isOpen) toggleWidget(true);
      });

      // Clear any older session flag so refresh always shows the teaser again
      try {
        window.sessionStorage.removeItem("ttw-teaser-closed:" + botName);
      } catch (_err) { }

      const delayMs = (typeof botConfig.teaserDelay === "number" ? botConfig.teaserDelay : 5) * 1000;
      setTimeout(function () {
        showTeaser();
      }, delayMs);
    }

    const teaserCloseBtn = query("#ttw-teaser-close");
    if (teaserCloseBtn) {
      teaserCloseBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        hideTeaser(true);
      });
    }

    query("#ttw-title").textContent = botConfig.name || "AI Assistant";

    renderSuggestions();

    const storedVisitor = getStoredVisitorProfile();
    if (storedVisitor) {
      visitorProfile = storedVisitor;
      query("#ttw-name").value = storedVisitor.name && storedVisitor.name !== "Anonymous User" ? storedVisitor.name : "";
      query("#ttw-email").value = storedVisitor.email || "";
    }

    query("#ttw-launcher").addEventListener("click", function () {
      toggleWidget();
    });
    query("#ttw-close").addEventListener("click", function () {
      toggleWidget(false);
    });
    query("#ttw-backdrop").addEventListener("click", function () {
      if (isOpen) toggleWidget(false);
    });
    query("#ttw-send").addEventListener("click", sendMessage);
    query("#ttw-input").addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
    query("#ttw-input").addEventListener("input", function () {
      if (liveChat && liveChat.status === "active") {
        notifyVisitorTypingActivity();
      }
    });
    query("#ttw-start-btn").addEventListener("click", function () {
      const name = query("#ttw-name").value.trim();
      const email = query("#ttw-email").value.trim();
      registerVisitor({ name, email, skippedProfile: false });
    });
    query("#ttw-skip-btn").addEventListener("click", function () {
      registerVisitor({ skippedProfile: true });
    });

    // Add Tab events
    const tabHome = query("#ttw-tab-home");
    const tabMessages = query("#ttw-tab-messages");
    if (tabHome) {
      tabHome.addEventListener("click", function () {
        setWidgetTab("home");
      });
    }
    if (tabMessages) {
      tabMessages.addEventListener("click", function () {
        setWidgetTab("messages");
      });
    }

    // Keep relative "time ago" labels fresh while the page is open
    setInterval(refreshMessageTimestamps, 60000);

    // Human live chat (Pro plan) — only show when the owner has it enabled
    syncHumanRowVisibility();
    const humanBtn = query("#ttw-human-btn");
    if (humanBtn) {
      humanBtn.addEventListener("click", startLiveChat);
    }
    const liveBackBtn = query("#ttw-live-back");
    if (liveBackBtn) {
      liveBackBtn.addEventListener("click", function () {
        stopLiveChat(true, "visitor-switched-to-ai");
        appendMessage("bot", "You've switched back to AI conversation. How can I help?");
        setMode("chat");
        setLiveBadge(false);
        showSuggestions();
        syncHumanRowVisibility();
        const input = query("#ttw-input");
        if (input) input.disabled = false;
        const send = query("#ttw-send");
        if (send) send.disabled = false;
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

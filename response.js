// MCP tool-response helpers — the single source of truth for the
// `{ content: [...] }` envelope shape every tool returns.
//
// Before this module the envelope was hand-written ~90× across index.js in
// three slightly different styles (`text: result`, a defensive
// `typeof result === 'string' ? … : JSON.stringify(result)`, and an
// unconditional `JSON.stringify`). `textResult` folds all three into one:
// strings pass through unchanged (byte-identical to the old dominant form),
// non-strings are JSON-stringified instead of becoming "[object Object]".

/** Text response. Strings pass through; everything else is JSON-stringified. */
export const textResult = (r) => ({
  content: [{ type: "text", text: typeof r === "string" ? r : JSON.stringify(r) }],
});

/** Pretty-printed JSON response, for structured payloads worth indenting. */
export const jsonResult = (r) => ({
  content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
});

/** Image response (base64 + mime type). */
export const imageResult = (data, mimeType = "image/jpeg") => ({
  content: [{ type: "image", data, mimeType }],
});

/** Error response — sets `isError` so the MCP client renders it as a failure. */
export const errorResult = (msg) => ({
  content: [{ type: "text", text: msg }],
  isError: true,
});

function firstMatch(message, cases) {
  return cases.find(({ test }) => test.test(message));
}

function formatTrace(trace) {
  const events = trace?.events || [];
  if (events.length === 0) return "";
  const lines = [`Dependency trace: ${trace.id || "untracked"}`];
  for (const event of events.slice(-8)) {
    const bits = [
      `- ${event.dependency}: ${event.outcome}`,
      event.command ? `command=${event.command}` : null,
      Number.isFinite(event.durationMs) ? `${event.durationMs}ms` : null,
      event.error ? `error=${event.error}` : null,
      event.reason ? `reason=${event.reason}` : null,
    ].filter(Boolean);
    lines.push(bits.join(" | "));
  }
  return lines.join("\n");
}

/** Convert low-level Safari/macOS failures into actionable MCP error text. */
export function explainFailure(error, context = {}) {
  const original = error?.message || String(error || "Unknown error");
  const message = original.replace(/\s+/g, " ").trim();
  const tool = context.toolName ? ` while running ${context.toolName}` : "";
  const matched = firstMatch(message, [
    {
      test: /Safari is not running|Safari not running|Application isn.t running|-600/i,
      title: "Safari is not running.",
      cause: "Safari MCP can only drive an existing Safari process.",
      next: "Open Safari manually, make sure at least one window exists, then retry the tool.",
    },
    {
      test: /-1743|not authoriz|Automation permission denied|Apple Events/i,
      title: "macOS blocked Safari automation.",
      cause: "The host app running this MCP server does not currently have Automation permission to control Safari, or Safari's Apple Events setting is off.",
      next: "Enable System Settings > Privacy & Security > Automation for your terminal/editor and Safari > Develop > Allow JavaScript from Apple Events, then restart the MCP client.",
    },
    {
      test: /safari-helper timeout|AppleScript execution timed out|daemon wedged|blocked past their timeout/i,
      title: "Safari's AppleScript helper timed out.",
      cause: "A Safari AppleScript call did not return in time. This usually points to a wedged Safari tab/page, a saturated helper daemon, or a long-running page script rather than a selector problem.",
      next: "Run safari_doctor, close or reload the active Safari tab if it is hung, then retry. If repeated helper timeouts appear, restart the MCP client to force a clean helper daemon.",
    },
    {
      test: /safari-helper not available|helper process exited|helper process error|preflight timeout|unparseable preflight/i,
      title: "The native safari-helper daemon is not healthy.",
      cause: "The helper process was missing, restarting, or returned an invalid response.",
      next: "Run safari_doctor. If it still reports helper trouble, reinstall safari-mcp so postinstall can re-sign safari-helper, then restart the MCP client.",
    },
    {
      test: /Extension timeout|Extension disconnected|Extension not connected|HTTP poll timeout|Proxy error/i,
      title: "The Safari extension bridge did not respond.",
      cause: "The browser extension transport is disconnected or stalled, so Safari MCP may need to fall back to AppleScript.",
      next: "Reload the Safari MCP extension, keep Safari open, or retry with the AppleScript fallback. Run safari_doctor if fallback also fails.",
    },
    {
      test: /Screen Recording|screencapture|empty|screenshots will be blank|permission may have been lost/i,
      title: "Screenshot capture is blocked by macOS permissions.",
      cause: "macOS Screen Recording permission is missing or stale for the app that launched Safari MCP.",
      next: "Enable System Settings > Privacy & Security > Screen Recording for your terminal/editor, then restart that app and retry.",
    },
    {
      test: /Tab safety|Tab tracking lost|not opened by this MCP session|refusing .* current tab/i,
      title: "Safari MCP refused to operate on an unowned tab.",
      cause: "The active Safari tab was not opened or explicitly selected by this MCP session. This guard prevents accidental actions in your personal tabs.",
      next: "Use safari_new_tab, safari_tabs with action new/switch, or switch back to a tab this session owns before retrying.",
    },
    {
      test: /Safari profile .* window not found|window not found|stale Safari window|Failed to parse Safari window geometry|Cannot get Safari window ID/i,
      title: "Safari MCP could not identify the target Safari window.",
      cause: "The expected Safari window/profile is closed, stale, minimized in a way automation cannot inspect, or Safari returned unusable window geometry.",
      next: "Open the target Safari window/profile, bring it to a normal visible state, then retry. If using SAFARI_PROFILE, verify that profile window is open.",
    },
    {
      test: /native click timeout|native hover timeout|native keyboard timeout|CGEvent|native clicks silently/i,
      title: "Native input did not complete.",
      cause: "The macOS CGEvent path needs Accessibility permission and can silently fail on some macOS/Safari combinations.",
      next: "Run safari_doctor. Prefer safari_click or safari_evaluate when possible; use native input only for trust-gated UI that requires real events.",
    },
    {
      test: /Timeout waiting for|async script did not settle|waitFor requires/i,
      title: "The requested page condition did not happen before the timeout.",
      cause: "The page may still be loading, the selector/text may not match, or the app may have changed state.",
      next: "Take a fresh safari_snapshot or safari_read_page, verify the selector/ref/text, and retry with a longer timeout only if the page is genuinely slow.",
    },
  ]);

  if (!matched) {
    return [
      `Safari MCP failed${tool}.`,
      "",
      `What happened: ${message || "The tool threw an unknown error."}`,
      "Likely root cause: The failure did not match a known Safari MCP/macOS failure signature.",
      "Try next: Run safari_doctor, then retry with a fresh safari_snapshot so the next action targets current page state.",
      formatTrace(context.trace),
    ].filter(Boolean).join("\n");
  }

  return [
    `Safari MCP failed${tool}: ${matched.title}`,
    "",
    `What happened: ${message}`,
    `Likely root cause: ${matched.cause}`,
    `Try next: ${matched.next}`,
    formatTrace(context.trace),
  ].filter(Boolean).join("\n");
}

export const diagnosticErrorResult = (error, context) => errorResult(explainFailure(error, context));

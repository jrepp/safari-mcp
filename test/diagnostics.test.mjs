import assert from "node:assert/strict";
import test from "node:test";
import { explainFailure } from "../response.js";

test("helper timeout explains daemon saturation instead of returning a terse timeout", () => {
  const text = explainFailure(new Error("safari-helper timeout"), { toolName: "safari_click" });
  assert.match(text, /Safari MCP failed while running safari_click/);
  assert.match(text, /AppleScript helper timed out/);
  assert.match(text, /saturated helper daemon|wedged Safari tab/);
  assert.match(text, /Run safari_doctor/);
});

test("automation denial points at macOS Automation and Safari Apple Events settings", () => {
  const text = explainFailure(new Error("AppleScript error: Not authorized to send Apple events to Safari. (-1743)"));
  assert.match(text, /macOS blocked Safari automation/);
  assert.match(text, /Privacy & Security > Automation/);
  assert.match(text, /Allow JavaScript from Apple Events/);
});

test("tab safety failures explain the ownership guard", () => {
  const text = explainFailure(new Error("Tab safety: refusing click — current tab was not opened by this MCP session"));
  assert.match(text, /unowned tab/);
  assert.match(text, /prevents accidental actions/);
  assert.match(text, /safari_new_tab/);
});

test("unknown failures still produce root-cause guidance", () => {
  const text = explainFailure(new Error("unexpected low-level error"));
  assert.match(text, /did not match a known Safari MCP\/macOS failure signature/);
  assert.match(text, /Run safari_doctor/);
});

test("diagnostics include downstream dependency trace events", () => {
  const text = explainFailure(new Error("safari-helper timeout"), {
    toolName: "safari_read_page",
    trace: {
      id: "trace-1",
      events: [
        { dependency: "extension.bridge", outcome: "failed", command: "read_page", durationMs: 10, error: "Extension not connected" },
        { dependency: "applescript.fallback", outcome: "start", command: "read_page" },
        { dependency: "safari-helper", outcome: "timeout", command: "AppleScript", durationMs: 5001, error: "safari-helper timeout" },
      ],
    },
  });

  assert.match(text, /Dependency trace: trace-1/);
  assert.match(text, /extension\.bridge: failed/);
  assert.match(text, /applescript\.fallback: start/);
  assert.match(text, /safari-helper: timeout/);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCliCommand } from "../cli-contract.js";

test("open creates a new owned Safari tab", () => {
  assert.deepEqual(parseCliCommand(["open", "http://127.0.0.1:4173"]), {
    tool: "safari_new_tab",
    args: { url: "http://127.0.0.1:4173" },
  });
});

test("snapshot refs are accepted with an agent-browser-shaped at prefix", () => {
  assert.deepEqual(parseCliCommand(["click", "@4_12"]), {
    tool: "safari_click",
    args: { ref: "4_12" },
  });
});

test("ordinary click targets remain selectors", () => {
  assert.deepEqual(parseCliCommand(["click", "#selftest-result"]), {
    tool: "safari_click",
    args: { selector: "#selftest-result" },
  });
});

test("fill and type retain agent-browser argument order", () => {
  assert.deepEqual(parseCliCommand(["fill", "@1_3", "hello"]), {
    tool: "safari_fill",
    args: { ref: "1_3", value: "hello" },
  });
  assert.deepEqual(parseCliCommand(["type", "input", "world"]), {
    tool: "safari_type_text",
    args: { selector: "input", text: "world" },
  });
});

test("key chords map common agent-browser modifier names", () => {
  assert.deepEqual(parseCliCommand(["press", "Control+Shift+a"]), {
    tool: "safari_press_key",
    args: { key: "a", modifiers: ["ctrl", "shift"] },
  });
});

test("wait distinguishes durations from selectors", () => {
  assert.deepEqual(parseCliCommand(["wait", "250"]), {
    tool: "safari_wait",
    args: { ms: 250 },
  });
  assert.deepEqual(parseCliCommand(["wait", "#ready"]), {
    tool: "safari_wait_for",
    args: { selector: "#ready" },
  });
  assert.deepEqual(parseCliCommand(["wait", "#ready", "--timeout", "45000"]), {
    tool: "safari_wait_for",
    args: { selector: "#ready", timeout: 45000 },
  });
});

test("screenshot records path and full-page intent outside tool arguments", () => {
  assert.deepEqual(parseCliCommand(["screenshot", "out/cloud.jpg", "--full"]), {
    tool: "safari_screenshot",
    args: { fullPage: true },
    outputPath: "out/cloud.jpg",
  });
});

test("get and is commands produce bounded page expressions", () => {
  const count = parseCliCommand(["get", "count", ".card"]);
  assert.equal(count.tool, "safari_evaluate");
  assert.match(count.args.script, /querySelectorAll\("\\\.card"\)|querySelectorAll\("\.card"\)/);

  const visible = parseCliCommand(["is", "visible", "#lab"]);
  assert.equal(visible.tool, "safari_evaluate");
  assert.match(visible.args.script, /getBoundingClientRect/);
});

test("tab commands mirror the common agent-browser shape", () => {
  assert.deepEqual(parseCliCommand(["tab"]), { tool: "safari_list_tabs", args: {} });
  assert.deepEqual(parseCliCommand(["tab", "3"]), {
    tool: "safari_switch_tab",
    args: { index: 3 },
  });
});

test("metrics and vitals share the Safari performance probe", () => {
  const expected = { tool: "safari_performance_metrics", args: {} };
  assert.deepEqual(parseCliCommand(["metrics"]), expected);
  assert.deepEqual(parseCliCommand(["vitals"]), expected);
});

test("raw is limited to Safari tool names and parses structured arguments", () => {
  assert.deepEqual(parseCliCommand(["raw", "safari_css_coverage", '{"limit":2}']), {
    tool: "safari_css_coverage",
    args: { limit: 2 },
  });
  assert.throws(() => parseCliCommand(["raw", "not_a_tool", "{}"]), /must start with safari_/);
});

test("unsupported commands and incomplete calls fail visibly", () => {
  assert.throws(() => parseCliCommand(["open"]), /requires a URL/);
  assert.throws(() => parseCliCommand(["trace", "start"]), /Unknown command/);
});

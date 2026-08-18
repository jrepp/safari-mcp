const refPattern = /^@?(\d+_\d+)$/;

function requireArg(value, message) {
  if (value === undefined || value === "") throw new Error(message);
  return value;
}

function targetArgs(target) {
  const value = requireArg(target, "A selector or Safari snapshot ref is required.");
  const match = value.match(refPattern);
  return match ? { ref: match[1] } : { selector: value };
}

function js(value) {
  return JSON.stringify(String(value));
}

function parsePress(value) {
  const parts = requireArg(value, "A key is required.").split("+").filter(Boolean);
  const key = parts.pop();
  const aliases = { control: "ctrl", command: "cmd", option: "alt", meta: "cmd" };
  return { key, modifiers: parts.map((part) => aliases[part.toLowerCase()] || part.toLowerCase()) };
}

function takeFlag(args, ...names) {
  const index = args.findIndex((arg) => names.includes(arg));
  if (index < 0) return false;
  args.splice(index, 1);
  return true;
}

function takeOption(args, ...names) {
  const index = args.findIndex((arg) => names.includes(arg));
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (value === undefined) throw new Error(`${args[index]} requires a value.`);
  args.splice(index, 2);
  return value;
}

export function parseCliCommand(input) {
  const argv = [...input];
  const command = argv.shift();

  switch (command) {
    case "open":
      return { tool: "safari_new_tab", args: { url: requireArg(argv[0], "open requires a URL.") } };
    case "snapshot": {
      const selector = takeOption(argv, "-s", "--selector");
      return { tool: "safari_snapshot", args: selector ? { selector } : {} };
    }
    case "click":
      return { tool: "safari_click", args: targetArgs(argv[0]) };
    case "dblclick":
      return { tool: "safari_double_click", args: selectorArgs(argv[0]) };
    case "fill":
      return {
        tool: "safari_fill",
        args: { ...targetArgs(argv[0]), value: requireArg(argv[1], "fill requires text.") },
      };
    case "type":
      return {
        tool: "safari_type_text",
        args: { ...targetArgs(argv[0]), text: requireArg(argv[1], "type requires text.") },
      };
    case "press":
      return { tool: "safari_press_key", args: parsePress(argv[0]) };
    case "hover":
      return { tool: "safari_hover", args: targetArgs(argv[0]) };
    case "scroll": {
      const direction = argv[0] || "down";
      if (!new Set(["up", "down"]).has(direction)) {
        throw new Error(
          "Safari currently supports scroll up/down; use eval for horizontal scrolling."
        );
      }
      return { tool: "safari_scroll", args: { direction, amount: Number(argv[1] || 500) } };
    }
    case "scrollintoview":
      return { tool: "safari_scroll_to_element", args: selectorArgs(argv[0]) };
    case "wait": {
      const target = requireArg(argv[0], "wait requires milliseconds or a selector.");
      if (/^\d+$/.test(target)) return { tool: "safari_wait", args: { ms: Number(target) } };
      const timeout = takeOption(argv, "--timeout");
      return {
        tool: "safari_wait_for",
        args: { selector: target, ...(timeout ? { timeout: Number(timeout) } : {}) },
      };
    }
    case "screenshot": {
      const fullPage = takeFlag(argv, "--full", "--full-page");
      return { tool: "safari_screenshot", args: { fullPage }, outputPath: argv[0] || null };
    }
    case "pdf":
      return {
        tool: "safari_save_pdf",
        args: { path: requireArg(argv[0], "pdf requires an output path.") },
      };
    case "eval":
      return {
        tool: "safari_evaluate",
        args: { script: requireArg(argv.join(" "), "eval requires JavaScript.") },
      };
    case "back":
      return { tool: "safari_go_back", args: {} };
    case "forward":
      return { tool: "safari_go_forward", args: {} };
    case "reload":
      return { tool: "safari_reload", args: { hard: takeFlag(argv, "--hard") } };
    case "get":
      return parseGet(argv);
    case "is":
      return parseIs(argv);
    case "tab":
      return parseTab(argv);
    case "metrics":
    case "vitals":
      return { tool: "safari_performance_metrics", args: {} };
    case "console":
      if (takeFlag(argv, "--clear")) return { tool: "safari_clear_console", args: {} };
      if (takeFlag(argv, "--start")) return { tool: "safari_start_console", args: {} };
      return { tool: "safari_get_console", args: {} };
    case "errors":
      return { tool: "safari_console_filter", args: { level: "error" } };
    case "network":
      return parseNetwork(argv);
    case "doctor":
      return { tool: "safari_doctor", args: {} };
    case "close":
      return takeFlag(argv, "--all")
        ? { local: "shutdown" }
        : { tool: "safari_close_tab", args: {} };
    case "raw": {
      const tool = requireArg(argv[0], "raw requires a safari_* tool name.");
      if (!/^safari_[a-z0-9_]+$/.test(tool))
        throw new Error("raw tool names must start with safari_.");
      const raw = argv[1] || "{}";
      return { tool, args: JSON.parse(raw) };
    }
    case "help":
    case "--help":
    case "-h":
    case undefined:
      return { local: "help" };
    default:
      throw new Error(`Unknown command: ${command}. Run safari-browser help.`);
  }
}

function parseGet(argv) {
  const what = requireArg(argv.shift(), "get requires a property.");
  const selector = argv[0];
  switch (what) {
    case "text":
      return { tool: "safari_read_page", args: selector ? { selector } : {} };
    case "html":
      return selector
        ? {
            tool: "safari_evaluate",
            args: { script: `document.querySelector(${js(selector)})?.outerHTML ?? null` },
          }
        : { tool: "safari_get_source", args: {} };
    case "title":
      return { tool: "safari_evaluate", args: { script: "document.title" } };
    case "url":
      return { tool: "safari_evaluate", args: { script: "location.href" } };
    case "value":
      return {
        tool: "safari_evaluate",
        args: {
          script: `document.querySelector(${js(requireArg(selector, "get value requires a selector."))})?.value ?? null`,
        },
      };
    case "attr": {
      const name = requireArg(argv.shift(), "get attr requires an attribute name.");
      const target = requireArg(argv.shift(), "get attr requires a selector.");
      return {
        tool: "safari_evaluate",
        args: {
          script: `document.querySelector(${js(target)})?.getAttribute(${js(name)}) ?? null`,
        },
      };
    }
    case "count":
      return {
        tool: "safari_evaluate",
        args: {
          script: `document.querySelectorAll(${js(requireArg(selector, "get count requires a selector."))}).length`,
        },
      };
    case "box":
      return {
        tool: "safari_get_element",
        args: { selector: requireArg(selector, "get box requires a selector.") },
      };
    case "styles":
      return {
        tool: "safari_get_computed_style",
        args: { selector: requireArg(selector, "get styles requires a selector.") },
      };
    default:
      throw new Error(`Unsupported get property: ${what}.`);
  }
}

function selectorArgs(target) {
  const parsed = targetArgs(target);
  return parsed.ref ? { selector: `[data-mcp-ref="${parsed.ref}"]` } : parsed;
}

function parseIs(argv) {
  const what = requireArg(argv.shift(), "is requires visible, enabled, or checked.");
  const selector = requireArg(argv.shift(), `is ${what} requires a selector.`);
  const element = `document.querySelector(${js(selector)})`;
  const expressions = {
    visible: `(()=>{const e=${element};if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"})()`,
    enabled: `(()=>{const e=${element};return !!e&&!e.disabled&&e.getAttribute("aria-disabled")!=="true"})()`,
    checked: `!!(${element}?.checked)`,
  };
  if (!expressions[what]) throw new Error(`Unsupported state check: ${what}.`);
  return { tool: "safari_evaluate", args: { script: expressions[what] } };
}

function parseTab(argv) {
  const action = argv[0] || "list";
  if (action === "list") return { tool: "safari_list_tabs", args: {} };
  if (action === "new") return { tool: "safari_new_tab", args: argv[1] ? { url: argv[1] } : {} };
  if (action === "close") return { tool: "safari_close_tab", args: {} };
  if (/^\d+$/.test(action)) return { tool: "safari_switch_tab", args: { index: Number(action) } };
  throw new Error("tab accepts list, new [url], close, or a numeric tab index.");
}

function parseNetwork(argv) {
  const action = argv.shift() || "requests";
  if (action === "requests") return { tool: "safari_network", args: {} };
  if (action === "start") return { tool: "safari_start_network_capture", args: {} };
  if (action === "details") return { tool: "safari_network_details", args: {} };
  if (action === "clear") return { tool: "safari_clear_network", args: {} };
  throw new Error("network accepts requests, start, details, or clear.");
}

export const cliHelp = `safari-browser - configuration-free Safari automation for agents

Usage: safari-browser [--session name] [--json] <command> [args]

Core commands:
  open <url>                 Open an owned Safari tab
  snapshot [-s selector]    Accessibility snapshot with refs
  click <selector|@ref>     Click an element
  dblclick <selector|@ref>  Double-click an element
  fill <target> <text>      Replace an input value
  type <target> <text>      Type with key events
  press <key>               Press a key, e.g. Control+a
  hover <target>            Hover an element
  scroll <up|down> [px]     Scroll the page
  wait <selector|ms>        Wait for a condition or duration; supports --timeout
  screenshot [path] [--full] Save a screenshot
  eval <javascript>         Evaluate JavaScript
  get <property> [selector] Read text/html/title/url/value/count/box/styles
  is <state> <selector>     Check visible/enabled/checked
  tab [list|new|close|N]    Manage the session's Safari tabs
  metrics | vitals          Navigation, Web Vitals, resources, and memory
  console [--start|--clear] Read or manage console capture
  errors                    Read captured console errors
  network <action>          requests/start/details/clear
  run <path.json> [--bail]  Execute a repeatable command trajectory
  raw <safari_tool> <json>  Escape hatch to any Safari MCP tool
  doctor                    Diagnose Safari/macOS capabilities
  close [--all]             Close a tab or stop the named CLI session

Refs are emitted as 0_5 and may be passed as 0_5 or @0_5. Named sessions keep
one Safari MCP process alive, so chained CLI invocations retain tab ownership.
No MCP client configuration is required.`;

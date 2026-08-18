# Configuration-free CLI automation

`safari-browser` is an agent-oriented CLI facade over Safari MCP. It does not require an MCP entry in an editor, agent, or project configuration.

The CLI deliberately resembles the common `agent-browser` command shape:

```bash
safari-browser open http://127.0.0.1:4173
safari-browser snapshot
safari-browser click @0_5
safari-browser wait '#selftest-result[data-pass="true"]'
safari-browser metrics --json
safari-browser screenshot artifacts/safari/beauty.jpg --full
safari-browser close --all
```

## Session model

The first command for a named session auto-starts a local daemon under `~/.safari-mcp/cli/`. The daemon owns one long-lived Safari MCP stdio process, so independent CLI invocations retain:

- the exact Safari tab identity;
- tab-ownership safety checks;
- snapshot refs until the next snapshot;
- console and network capture installed in the page;
- the extension-first, AppleScript-fallback behavior;
- cleanup of tabs opened by that session.

Use `--session` when parallel agents need independent trajectories:

```bash
safari-browser --session startup open http://127.0.0.1:4173
safari-browser --session startup metrics --json
safari-browser --session reaction open 'http://127.0.0.1:4173/?scenario=backlit'
```

`safari-browser close --all` stops only the named session and closes the tabs it opened. Session sockets, process identifiers, and logs use lowercase filenames beneath `~/.safari-mcp/cli/`.

## Repeatable profiling paths

`run` executes a JSON trajectory through one persistent browser session. Each step is either an argv array or an object with `command` and `args`:

```json
[
  ["open", "http://127.0.0.1:4173/?automation=1"],
  ["console", "--start"],
  ["wait", "#selftest-result[data-pass=\"true\"]"],
  { "command": "eval", "args": ["window.__lcs?.reset?.()"] },
  ["wait", "250"],
  ["metrics"],
  ["screenshot", "artifacts/safari/default.jpg", "--full"]
]
```

Run it with structured output and fail at the first bad step:

```bash
safari-browser --session startup --json run paths/startup.json --bail
```

The package includes [`examples/cli-startup-trajectory.json`](../examples/cli-startup-trajectory.json) as a minimal correct LCS baseline: it waits for an explicit passing self-test, calls the project's structured `captureStartupProfile()` contract, then records Safari navigation and resource metrics. Start the target app on port 4173 and run:

```bash
safari-browser --session startup --json run examples/cli-startup-trajectory.json --bail
```

The JSON response records each command, success state, returned data, and error. A project harness can normalize those rows into its own append-only measurement ledger.

## Compatibility boundary

The CLI covers the high-value shared surface: navigation, snapshots and refs, click/fill/type, keyboard input, waits, screenshots, page queries, tabs, console/network capture, and performance metrics. `raw` exposes every remaining `safari_*` tool without adding a dedicated CLI spelling:

```bash
safari-browser raw safari_css_coverage '{}'
```

This is a command-shape compatibility layer, not an engine emulation layer. Safari has no Chrome DevTools Protocol, and Safari MCP does not currently expose a Web Inspector timeline trace or JavaScript sampling profile. For profiling paths, use page-owned marks/measures, the structured application probe, resource timing, Web Vitals, screenshots, and the application's WebGPU timestamp queries. Use a Chrome-specific profiler when a CDP trace or CPU profile is required.

## Output and failures

`--json` returns one stable envelope:

```json
{
  "ok": true,
  "data": {}
}
```

Human-readable mode prints the command text directly. JSON mode omits that duplicate text representation so trajectory output can be stored without recording each structured payload twice.

Tool failures exit nonzero. Screenshot data is decoded inside the daemon and written to the requested local path instead of printing base64. `doctor` preserves the existing actionable macOS permission report:

```bash
safari-browser doctor
```

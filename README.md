<div align="center">

<img src="social-preview.png" alt="Safari MCP Server — native browser automation tools for AI agents on macOS" width="100%">

<br/>

# 🦁 Safari MCP

**The browser for your coding agent.**

*Your real Safari, logged in — no Chrome, no heat, no headless.*

[![npm version](https://img.shields.io/npm/v/safari-mcp)](https://www.npmjs.com/package/safari-mcp)
[![npm downloads](https://img.shields.io/npm/dm/safari-mcp)](https://www.npmjs.com/package/safari-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![macOS](https://img.shields.io/badge/macOS-only-blue)](https://www.apple.com/macos/)

[![Glama AAA](https://img.shields.io/badge/Glama-AAA_Score-22c55e?logo=ai)](https://glama.ai/mcp/servers/@achiya-automation/safari-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-Verified-2563eb)](https://registry.modelcontextprotocol.io/v0/servers?search=achiya-automation)
[![Smithery](https://img.shields.io/badge/Smithery-Listed-7c3aed)](https://smithery.ai/server/@achiya-automation/safari-mcp)
[![MCP Score](https://mcpscoreboard.com/badge/05977769-8762-4e89-aff3-a0c5776843bb.svg)](https://mcpscoreboard.com/server/05977769-8762-4e89-aff3-a0c5776843bb/)

<a href="vscode:mcp/install?%7B%22safari-mcp%22%3A%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22safari-mcp%22%5D%7D%7D"><img src="https://img.shields.io/badge/VS_Code-Install_Server-0078d4?logo=visual-studio-code&logoColor=white" alt="Install in VS Code"></a>
<a href="https://insiders.vscode.dev/redirect?url=vscode-insiders:mcp/install?%7B%22safari-mcp%22%3A%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22safari-mcp%22%5D%7D%7D"><img src="https://img.shields.io/badge/VS_Code_Insiders-Install_Server-24bfa5?logo=visual-studio-code&logoColor=white" alt="Install in VS Code Insiders"></a>
<a href="cursor://anysphere.cursor-deeplink/mcp/install?name=safari-mcp&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22safari-mcp%22%5D%7D"><img src="https://img.shields.io/badge/Cursor-Install_Server-f97316?logo=cursor&logoColor=white" alt="Install in Cursor"></a>

**19 compact tools** · **No Chrome/Puppeteer/Playwright needed** · **~5ms per command** · **60% less CPU than Chrome**

[Quick Start](#quick-start) · [Tools](#tools-19) · [Examples](examples/) · [Why Safari MCP?](#safari-mcp-vs-alternatives) · [Architecture](#architecture) · [Changelog](CHANGELOG.md)

![Safari MCP Demo](https://github.com/achiya-automation/safari-mcp/raw/main/assets/safari-mcp-promo.gif)

</div>

## ❌ Without Safari MCP

Your AI agent needs to browse. So it either:

- **Spins up Chromium via Playwright** — with no logins, no cookies, no sessions
- **Uses Chrome DevTools MCP** — and melts your fan running a second browser
- **Relies on headless scrapers** — blocked by Cloudflare, reCAPTCHA, and bot detection

## ✅ With Safari MCP

Your AI drives the **Safari you're already logged into** — Gmail, GitHub, Ahrefs, Slack, banking.

Native WebKit. ~60% less CPU. Background operation. Compact tool surface. One `npx` command. macOS only.

> 📰 **Featured on HackerNoon:** [I Had to Reverse-Engineer React, Shadow DOM, and CSP to Automate Safari Without Chrome](https://hackernoon.com/i-had-to-reverse-engineer-react-shadow-dom-and-csp-to-automate-safari-without-chrome)

---

## Highlights

- **19 compact tools** — navigation, clicks, forms, screenshots, network, storage, accessibility, and more
- **Zero heat** — native WebKit on Apple Silicon, ~60% less CPU than Chrome
- **Your real browser** — keeps all logins, cookies, sessions (Gmail, GitHub, Ahrefs, etc.)
- **Background operation** — Safari stays in the background, no window stealing
- **No browser dependencies** — no Puppeteer, no Playwright, no WebDriver, no Chrome
- **Persistent process** — reuses a single osascript process (~5ms per command vs ~80ms)
- **Framework-compatible** — React, Vue, Angular, Svelte form filling via native setters

---

## Quick Start

### Prerequisites

- macOS (any version with Safari)
- Node.js 18+
- Safari → Settings → Advanced → **Show features for web developers** ✓
- Safari → Develop → **Allow JavaScript from Apple Events** ✓

### Install (one command)

```bash
npx safari-mcp
```

That's it — no global install needed. Or install permanently:

```bash
npm install -g safari-mcp
```

### Configure your MCP client

All clients run Safari MCP the same way — `npx safari-mcp`. Pick your editor:

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add safari -- npx safari-mcp
```

Or edit `~/.mcp.json`:

```json
{
  "mcpServers": {
    "safari": {
      "command": "npx",
      "args": ["safari-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Claude Desktop</b></summary>

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "safari": {
      "command": "npx",
      "args": ["safari-mcp"]
    }
  }
}
```

Restart Claude Desktop after saving.
</details>

<details>
<summary><b>Cursor</b></summary>

One-click: [**Install in Cursor**](cursor://anysphere.cursor-deeplink/mcp/install?name=safari-mcp&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22safari-mcp%22%5D%7D)

Or edit `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "safari": {
      "command": "npx",
      "args": ["safari-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>VS Code / VS Code Insiders</b></summary>

One-click: [**Install in VS Code**](vscode:mcp/install?%7B%22safari-mcp%22%3A%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22safari-mcp%22%5D%7D%7D)

Or edit `.vscode/mcp.json`:

```json
{
  "servers": {
    "safari": {
      "type": "stdio",
      "command": "npx",
      "args": ["safari-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Windsurf</b></summary>

Edit `.windsurf/mcp.json` in your project (or `~/.codeium/windsurf/mcp_config.json` globally):

```json
{
  "mcpServers": {
    "safari": {
      "command": "npx",
      "args": ["safari-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Cline</b></summary>

Open Cline in VS Code → click the MCP icon → **Edit MCP Settings** → add:

```json
{
  "mcpServers": {
    "safari": {
      "command": "npx",
      "args": ["safari-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Continue</b></summary>

Edit `~/.continue/config.yaml` (or `.continue/config.yaml` in workspace):

```yaml
mcpServers:
  - name: safari
    command: npx
    args:
      - safari-mcp
```
</details>

<details>
<summary><b>Goose</b></summary>

Edit `~/.config/goose/config.yaml`:

```yaml
extensions:
  safari:
    name: safari
    type: stdio
    cmd: npx
    args:
      - safari-mcp
    enabled: true
```
</details>

<details>
<summary><b>LM Studio</b></summary>

Open LM Studio → **Settings** → **MCP Servers** → **Add Server**:

- **Name:** `safari`
- **Command:** `npx`
- **Args:** `safari-mcp`
</details>

<details>
<summary><b>Zed</b></summary>

Open Zed → **Settings** → search for "Context Servers" and add:

```json
{
  "context_servers": {
    "safari": {
      "command": {
        "path": "npx",
        "args": ["safari-mcp"]
      }
    }
  }
}
```
</details>

<details>
<summary><b>Alternative: Homebrew</b></summary>

```bash
brew install achiya-automation/tap/safari-mcp
```
</details>

<details>
<summary><b>Alternative: from source</b></summary>

```bash
git clone https://github.com/achiya-automation/safari-mcp.git
cd safari-mcp && npm install
```
</details>

---

## Usage Workflow

The recommended pattern for AI agents using Safari MCP:

```
1. safari_snapshot        → Get page state (accessibility tree)
2. safari_click/fill/...  → Interact with elements by ref
3. safari_snapshot        → Verify the result
```

**Element targeting** — tools accept multiple targeting strategies:

| Strategy | Example | Best for |
|----------|---------|----------|
| CSS selector | `#login-btn`, `.submit` | Unique elements |
| Visible text | `"Sign In"`, `"Submit"` | Buttons, links |
| Coordinates | `x: 100, y: 200` | Canvas, custom widgets |
| Ref from snapshot | `ref: "e42"` | Any element from accessibility tree |

> **Tip:** Start with `safari_snapshot` to get element refs, then use refs for precise targeting. This is faster and more reliable than CSS selectors.

---

## Tools (19)

<details>
<summary><b>Click to expand the compact tool list</b></summary>

| Tool | Description |
|------|-------------|
| `safari_navigate` | Navigate the active MCP-owned tab |
| `safari_read_page` | Read text or HTML source (`format: "source"`) |
| `safari_snapshot` | Structured page state with refs for interaction |
| `safari_click` | Click by ref, selector, text, or coordinates; supports native/double/right/wait/read options |
| `safari_fill` | Fill text directly or through native paste; optional state verification |
| `safari_screenshot` | Viewport/full-page screenshot, or element screenshot with `selector`; optional `overlay` diagnostics |
| `safari_wait` | Wait for selector/text or fixed milliseconds |
| `safari_evaluate` | Execute JavaScript in the current page |
| `safari_tabs` | `list`, `search`, `new`, `switch`, `close`, `wait_for_new`; prefer `search` with `activate: true` before opening a new tab |
| `safari_history` | `back`, `forward`, `reload` |
| `safari_pointer` | `hover`, `drag`, and `hit_test`, with native hover support |
| `safari_keyboard` | `press`, `type`, `replace_editor`, with native support |
| `safari_form` | `clear`, `select`, `fill_all`, `submit`, `verify`, `detect`, react-select helpers |
| `safari_extract` | Element/query/style/layout/dom_tree/canvas/visual/a11y/tables/meta/images/links/analyze/performance/CSS coverage |
| `safari_storage` | Cookies, localStorage, sessionStorage, IndexedDB, export/import |
| `safari_network` | Overview, capture, details, clear, mock, clear mocks, throttle |
| `safari_console` | Start, get, filter by level, clear console capture |
| `safari_browser` | Scroll, dialog, resize, layout observation, emulation, files, PDF, clipboard, geolocation, extension reload |
| `safari_run_script` | Batch multiple lower-level `safari.js` actions in one call |

</details>

---

## Security

Safari MCP runs locally on your Mac with minimal attack surface:

| Aspect | Detail |
|--------|--------|
| Network | **No remote connections** — all communication is local (stdio + localhost) |
| Permissions | macOS system permissions required (Screen Recording for screenshots) |
| Data | No telemetry, no analytics, no data sent anywhere |
| Extension | Communicates only with `localhost:9224`, validated by Safari |
| Code | Fully open source (MIT) — audit every line |

---

## Safari MCP vs Alternatives

| Feature | Safari MCP | Chrome DevTools MCP | Playwright MCP |
|---------|:----------:|:-------------------:|:--------------:|
| CPU/Heat | 🟢 Minimal | 🔴 High | 🟡 Medium |
| Your logins | ✅ Yes | ✅ Yes | ❌ No |
| macOS native | ✅ WebKit | ❌ Chromium | ❌ Chromium/WebKit |
| Browser dependencies | None | Chrome + debug port | Playwright runtime |
| Tools | 80 | ~30 | ~25 |
| File upload | JS (no dialog) | CDP | Playwright API |
| Image paste | JS (no clipboard) | CDP | Playwright API |
| Focus steal | ❌ Background | ❌ Background | ❌ Headless |
| Network mocking | ✅ | ❌ | ✅ |
| Lighthouse | ❌ | ✅ | ❌ |
| Performance trace | ❌ | ✅ | ❌ |

> **Tip:** Use Safari MCP for daily browsing tasks (95% of work) and Chrome DevTools MCP only for Lighthouse/Performance audits.

### Why Safari MCP and Not the Other Safari MCP Projects?

There are several "safari-mcp" projects floating around. Here's how they compare:

| Feature | **🦁 safari-mcp** *(this repo)* | [lxman/safari-mcp-server](https://github.com/lxman/safari-mcp-server) | [Epistates/MCPSafari](https://github.com/Epistates/MCPSafari) | [HayoDev/safari-devtools-mcp](https://github.com/HayoDev/safari-devtools-mcp) |
|---------|:------------------------------:|:----------------------:|:------------:|:----------------------:|
| **Tools** | **80** | ~10 | 23 | ~15 |
| **Install** | `npx safari-mcp` | Manual | Binary | `npx` |
| **Engine** | **Dual** (Extension + AppleScript) | WebDriver | Extension only | DevTools Protocol |
| **Keeps your real Safari logins** | ✅ Yes | ⚠️ Limited | ✅ Yes | ❌ Debug session |
| **Background (no focus steal)** | ✅ Yes | ❌ No | ⚠️ Sometimes | ✅ Yes |
| **Storage tools** (cookies, localStorage, IndexedDB) | **10** | 0 | 0 | 2 |
| **Data extraction** (tables, meta, images, links) | **4** | 0 | 0 | 0 |
| **Network mocking** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Device emulation** (iPhone, iPad, Pixel) | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **File upload** (no dialog) | ✅ JS DataTransfer | ❌ No | ❌ No | ❌ No |
| **Image paste** (no clipboard touch) | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **PDF export** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Console capture** | **4 tools** | 0 | 1 | 1 |
| **Performance metrics + Web Vitals** | ✅ Yes | ❌ No | ❌ No | ⚠️ Partial |
| **Active maintenance** | ✅ Multiple releases/week | 🟡 Sporadic | 🟡 Slow | 🟡 Slow |
| **License** | **MIT** | MIT | None specified | MIT |
| **In MCP Registry** | ✅ | ❌ | ❌ | ✅ |
| **In Awesome MCP** | ✅ | ❌ | ❌ | ❌ |

> **TL;DR** — if you want the most complete Safari MCP with the smoothest install, the most tools, and active maintenance, **this is the one**.

---

## Architecture

Safari MCP uses a **dual-engine** architecture — the Extension is preferred for speed and advanced capabilities, with AppleScript as an always-available fallback:

```
Claude/Cursor/AI Agent
        ↓ MCP Protocol (stdio)
   Safari MCP Server (Node.js)
        ↓                    ↓
   Extension (HTTP)     AppleScript + Swift daemon
   (~5-20ms/cmd)        (~5ms/cmd, always available)
        ↓                    ↓
   Content Script       do JavaScript in tab N
        ↓                    ↓
   Page DOM ←←←←←←←←←← Page DOM
```

**Key design decisions:**
- **Dual engine with automatic fallback** — Extension is preferred; if not connected, AppleScript handles everything seamlessly
- **Persistent Swift helper** — one long-running process instead of spawning per command (16x faster)
- **Tab-indexed operations** — all JS runs on a specific tab by index, never steals visual focus
- **JS-first approach** — typing, clicking, file upload all use JavaScript events (no System Events keyboard conflicts)
- **No `activate`** — Safari is never brought to foreground

---

## Safari Extension (Optional)

The Safari MCP Extension is **optional but recommended**. Without it, ~80% of functionality works via AppleScript alone. The extension adds capabilities that AppleScript cannot provide:

### What the Extension Adds

| Capability | With Extension | AppleScript Only |
|-----------|:--------------:|:----------------:|
| Closed Shadow DOM (Reddit, Web Components) | ✅ Full access | ❌ Invisible |
| Strict CSP sites | ✅ Bypasses via MAIN world | ❌ Often blocked |
| React/Vue/Angular state manipulation | ✅ Deep (Fiber, ProseMirror) | ⚠️ Basic |
| Loading state detection (spinners, skeletons) | ✅ Smart detection | ❌ No |
| Dialog handling (alert/confirm) | ❌ | ✅ Only AppleScript |
| Native OS-level click (CGEvent) | ❌ | ✅ Only AppleScript |
| PDF export | ❌ | ✅ Only AppleScript |

> **When do you need the extension?** If you're automating modern SPAs with closed shadow DOM (e.g., Reddit), sites with strict Content Security Policy, or framework-heavy editors (Draft.js, ProseMirror, Slate).

### Installing the Extension

The extension requires a one-time build with Xcode (free, included with macOS).

> **Note for npm users:** The `xcode/` directory is not included in the npm package.
> Clone the [GitHub repository](https://github.com/achiya-automation/safari-mcp) to build from source.

**Prerequisites:** Xcode (install from App Store — free)

```bash
# 1. Clone the repo (the npm package does not include the Xcode project)
git clone https://github.com/achiya-automation/safari-mcp.git
cd safari-mcp

# 2. Build the extension
xcodebuild -project "xcode/Safari MCP/Safari MCP.xcodeproj" \
  -scheme "Safari MCP (macOS)" -configuration Release build

# 3. Ad-hoc sign the built app so Safari will load it
# (xcodebuild without a signing identity produces a bundle Safari silently rejects)
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/Safari_MCP-*/Build/Products/Release -name "Safari MCP.app" -maxdepth 2 | head -1)
codesign --sign - --force --deep "$APP_PATH"

# 4. Re-sign safari-helper with the Apple Events entitlement
# (helps macOS surface the TCC Automation prompt reliably)
codesign --sign - --force --entitlements safari-helper.entitlements safari-helper

# 4. Open the app (needed once so Safari registers the extension)
open "$APP_PATH"
```

Alternatively, open `xcode/Safari MCP/Safari MCP.xcodeproj` directly in Xcode, select your Apple ID under Signing & Capabilities, and click Run. A free personal Apple Developer account is sufficient for local use.

Then in Safari:
1. Safari → Settings → Advanced → enable **Show features for web developers**
2. Safari → Develop → **Allow Unsigned Extensions** (required each Safari restart)
3. Safari → Settings → Extensions → enable **Safari MCP Bridge**

The extension connects automatically to the MCP server on port `9224`.

> **Note:** "Allow Unsigned Extensions" resets every time Safari restarts. You'll need to re-enable it in the Develop menu after each restart. The extension itself stays installed.

**Toolbar icon status:**
- **ON** — connected to MCP server
- **OFF** — manually disabled via popup
- *(no badge)* — server not running, will auto-reconnect

---

## macOS Permissions

Safari MCP needs these one-time permissions:

| Permission | Where | Why |
|-----------|-------|-----|
| JavaScript from Apple Events | Safari → Develop menu | Required for `do JavaScript` |
| Automation → Safari | System Settings → Privacy & Security → Automation | Required for all AppleScript-backed tools |
| Screen Recording | System Settings → Privacy & Security → Screen Recording | Required for `safari_screenshot` |
| Accessibility (safari-helper) | System Settings → Privacy & Security → Accessibility | Required for `safari_click` with `native: true`, `safari_keyboard` with `native: true`, `safari_pointer` native hover, and `safari_browser` `save_pdf` |

### Granting Accessibility to safari-helper

Native click, keyboard, hover, and PDF actions inject OS-level `CGEvent` events into Safari without stealing focus. macOS requires the underlying helper binary to be approved in **Accessibility** before those events can reach a non-frontmost window.

1. Open **System Settings → Privacy & Security → Accessibility**.
2. Click `+` (unlock with your password if needed).
3. Navigate to the helper binary and add it:
   - npm global install: `$(npm root -g)/safari-mcp/safari-helper`
   - npx / project install: `./node_modules/safari-mcp/safari-helper`
   - From source clone: `/path/to/safari-mcp/safari-helper`
4. Make sure the toggle next to it is **ON**.

The postinstall script re-signs the helper with a stable identifier (`com.achiya-automation.safari-mcp`) so this permission survives future upgrades — without that step, every `npm update` would silently revoke approval because the binary's adhoc-signed identifier changes per build.

If `safari_click` with `native: true` reports success but the page doesn't react (no `isTrusted: true` click events fire), the helper is most likely missing this approval. Non-native actions don't need it.

### Granting Automation → Safari (important for IDE users)

macOS TCC grants Automation permission to the **parent process** that spawns the MCP server, not to `safari-mcp` itself. So you need to grant **Automation → Safari** to the app that runs Claude Code / Cursor / Windsurf — typically **Visual Studio Code** or **Terminal**.

If the permission dialog never appears automatically, run this command once from a Terminal that already has Automation permission:

```bash
osascript -e 'tell application "Safari" to get URL of current tab of window 1'
```

That call registers the Terminal app in the Automation database and then triggers the prompt for Safari. After you approve it, subsequent MCP calls from any child process chain will work.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "AppleScript error" | Enable "Allow JavaScript from Apple Events" in Safari → Develop |
| "Not authorized to send Apple events to Safari" | Grant Automation → Safari to your IDE (see above) |
| "Not authorized" after `npm update` | Updating changes the binary's cdhash — macOS silently revokes Automation permission. Re-run the `osascript` one-liner above to re-grant it |
| Native click reports success but page doesn't react | Add `safari-helper` to **System Settings → Privacy & Security → Accessibility** (see [Granting Accessibility](#granting-accessibility-to-safari-helper) above). Confirm by attaching a `click` listener with `{capture:true}` in the page console — without the grant, no `isTrusted: true` event fires |
| Screenshots empty | Grant Screen Recording permission to Terminal/VS Code |
| Tab not found | Call `safari_tabs` with `action: "list"` to refresh tab indices |
| Hebrew keyboard issues | All typing uses JS events — immune to keyboard layout |
| HTTPS blocked | `safari_navigate` auto-tries HTTPS first, falls back to HTTP |
| Safari steals focus | Ensure you're on latest version — `newTab` restores your active tab |

---

## Works With

Safari MCP works with any MCP-compatible client:

| Client | Status |
|--------|--------|
| [Claude Code](https://claude.ai/claude-code) | ✅ Tested daily |
| [Claude Desktop](https://claude.ai/download) | ✅ Tested |
| [Cursor](https://cursor.sh) | ✅ Tested |
| [Windsurf](https://codeium.com/windsurf) | ✅ Compatible |
| [VS Code + Continue](https://continue.dev) | ✅ Compatible |

---

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.

The codebase is two files:
- `safari.js` — Safari automation layer (AppleScript + JavaScript)
- `index.js` — MCP server with tool definitions

---

## Sponsors

Safari MCP is free and open source. If it saves you time or CPU cycles, consider supporting its development:

<a href="https://paypal.me/achiyaC123"><img src="https://img.shields.io/badge/Sponsor-PayPal-blue?logo=paypal" alt="Sponsor via PayPal"></a>

Your support funds:
- 🧪 Testing across macOS versions and Safari releases
- 🛠️ New tools and features
- 📖 Documentation and examples

[Become the first sponsor!](https://paypal.me/achiyaC123)

---

## Commercial Support

**Need Safari MCP integrated into your product or agent stack?** [Achiya Automation](https://achiya-automation.com/en/blog/safari-mcp-browser-automation/) offers:

- **Priority bug fixes** and custom tool development for your use case
- **Integration consulting** — wiring Safari MCP into production agent systems (Claude, Cursor, n8n, custom)
- **Private deployment support** — multi-user Safari MCP, non-standard macOS environments, CI/CD
- **Training workshops** for engineering teams adopting MCP-based automation

Built by the author of Safari MCP. [Start a conversation →](https://achiya-automation.com/en/contact/)

---

## What agents unlock with Safari MCP

When an AI agent drives Safari MCP, it gets things a headless browser can't:

- **Real authenticated sessions** — Gmail, GitHub, Ahrefs, Slack, banking dashboards are all already logged in
- **Framework-aware form filling** — `safari_form` with `action: "submit"` calls React/Vue/Angular setters natively, no guessing whether `input` events fired
- **Background operation** — the agent works in parallel while you keep using your Mac
- **One MCP call per workflow** — `safari_run_script` batches navigation + clicks + extraction into a single roundtrip

The pattern holds across models: **drive the browser the human already trusts** — you inherit logins, cookies, extensions, and the user's exact environment in one step.

---

## Community

**6,000+ monthly npm downloads** — developers are building AI agents on macOS with Safari MCP.

- [GitHub Discussions](https://github.com/achiya-automation/safari-mcp/discussions) — ask questions, share use cases
- [Issues](https://github.com/achiya-automation/safari-mcp/issues) — bug reports and feature requests
- [![Good First Issues](https://img.shields.io/github/issues/achiya-automation/safari-mcp/good%20first%20issue?color=7057ff&label=good%20first%20issues)](https://github.com/achiya-automation/safari-mcp/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — start contributing

---

## Ecosystem

Other macOS MCP servers that complement Safari MCP:

| Project | What it does | When to use |
|---------|-------------|-------------|
| [mcp-server-macos-use](https://github.com/mediar-ai/mcp-server-macos-use) | OS-level macOS automation (accessibility, screen control) | System-wide interactions beyond Safari |
| [chrome-devtools-mcp](https://github.com/anthropics/chrome-devtools-mcp) | Chrome DevTools Protocol | Lighthouse audits, Chrome-specific performance traces |

> Using Safari MCP alongside Chrome DevTools MCP? Safari handles 95% of daily browsing (zero overhead), Chrome handles the 5% that needs Lighthouse or Chrome-specific traces.

---

## Like it? Give it a ⭐

If Safari MCP saves you from Chrome overhead, **a star helps others discover it:**

[![Star this repo](https://img.shields.io/github/stars/achiya-automation/safari-mcp?style=social)](https://github.com/achiya-automation/safari-mcp)

[Share on Twitter/X](https://twitter.com/intent/tweet?text=Safari%20MCP%20%E2%80%94%20Stop%20running%20Chrome%20just%20so%20your%20AI%20agent%20can%20browse.%2080%20tools%2C%20native%20Safari%2C%2060%25%20less%20CPU.&url=https%3A%2F%2Fgithub.com%2Fachiya-automation%2Fsafari-mcp) · [Share on LinkedIn](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fgithub.com%2Fachiya-automation%2Fsafari-mcp) · [Write about it](https://dev.to/)

[![Star History Chart](https://api.star-history.com/svg?repos=achiya-automation/safari-mcp&type=Date)](https://star-history.com/#achiya-automation/safari-mcp&Date)

---

## Listed On

[![Glama](https://glama.ai/mcp/servers/achiya-automation/safari-mcp/badges/score.svg)](https://glama.ai/mcp/servers/achiya-automation/safari-mcp) [![MCP Registry](https://img.shields.io/badge/MCP-Registry-purple)](https://registry.modelcontextprotocol.io/) [![MCP Scoreboard](https://mcpscoreboard.com/badge/05977769-8762-4e89-aff3-a0c5776843bb.svg)](https://mcpscoreboard.com/server/05977769-8762-4e89-aff3-a0c5776843bb/) [![CI](https://github.com/achiya-automation/safari-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/achiya-automation/safari-mcp/actions/workflows/ci.yml)

---

## License

MIT — use it however you want.

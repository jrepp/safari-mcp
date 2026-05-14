# Influencer Outreach — Twitter/X DMs

## Strategy
Short, value-first, specific ask. NOT "please share". Frame as "I shipped X that solves Y you wrote about, would love your take."

These are one-shot — bad first DM burns the relationship for a year. Review each draft carefully before sending.

## Tier 1 — MCP-specific authority

### 1. Simon Willison (@simonw) — Django creator, MCP blogger
**Context**: He blogs about MCP servers he actually uses. Has posted about mcp-get, Pyodide MCP, context7. Audience: 200K+ X followers, separate 20K+ blog.

**Why he might care**: He's written about MCP server discoverability and noted the Chromium fatigue. Safari MCP's "native WebKit, no second browser" angle is exactly his taste.

**Draft DM**:
```
Hi Simon — big fan of your MCP coverage.

I shipped safari-mcp a few months ago — 80-tool MCP server that drives
the Safari you're already logged into, via AppleScript + injected JS.
No Chromium. No Puppeteer. ~60% less CPU than headless Chrome on M1.

Two things that might interest you specifically:
- React Fiber walking to drive controlled inputs where innerHTML-set
  isn't enough (Gmail, LinkedIn)
- Lexical / ProseMirror editor support via editor.parseEditorState()
  instead of synthetic input events

Repo: github.com/achiya-automation/safari-mcp
npm: 6K+ monthly downloads organically.

Not asking for a signal boost — just wanted you to know it exists in
case you're ever tempted to write about the WebKit corner of MCP.
Happy to walk through the trickiest parts over email if that'd be
useful background.

— Achiya
```

---

### 2. Alex Albert (@alexalbert__) — Head of Claude Relations, Anthropic
**Context**: Promotes Claude Code / MCP-related community projects on Anthropic's official channels. Audience: 100K+.

**Why he might care**: Safari MCP is macOS-first, fits the Claude Code demographic (mostly Mac developers).

**Draft DM**:
```
Hey Alex — Claude Code heavy user here.

Shipped safari-mcp — an MCP server that drives native Safari instead of
spinning up a second Chromium. 80 tools, runs via npx, macOS-only.

Three things that might be Claude Code–relevant:
- Our measured numbers show ~60% CPU saving vs headless Chrome on Apple
  Silicon. Matters for dev experience when Claude Code is already running.
- Inherits your real Safari sessions (Gmail, GitHub, Ahrefs) — no OAuth
  automation needed for agent workflows on your own infra.
- VS Code / Cursor / Claude Code all supported via same `npx safari-mcp`.
  One-click VS Code/Cursor install badges in README.

Repo: github.com/achiya-automation/safari-mcp
6K+ monthly npm downloads, MIT.

If there's a lightweight way to surface it in a Claude Relations post or
community roundup, that'd be gold. Either way — wanted to flag it exists.

— Achiya
```

---

### 3. Thorsten Ball (Register Spill newsletter)
**Context**: Writes Register Spill newsletter, MCP-aware, engineering-taste audience. Respects hard technical work.

**Why he might care**: The technical details (React Fiber walking, CGEvent paste, CSP bypass fallback) are exactly his taste. Not a promotional audience.

**Draft DM (via his Twitter @thorstenball or email)**:
```
Hi Thorsten —

Ship note in case you're ever looking for an MCP write-up with real
engineering teeth behind it.

I built safari-mcp (80 tools, drives native Safari on macOS). The
interesting part isn't "it exists" — it's the four things that broke:

1. React controlled inputs — setter bypasses value accessor. React
   Fiber walk + `_valueTracker` reset to get state to update.
2. Shadow DOM piercing without open-mode shadow roots (Figma, Linear).
3. CSP Level 3 blocking injected scripts — AppleScript fallback path.
4. Lexical editor drives (LinkedIn composer) — `editor.parseEditorState()`
   + `setEditorState()` instead of synthetic input events which are
   `isTrusted:false` and get rejected.

Writeup of the reverse-engineering: hackernoon.com/i-had-to-reverse-
engineer-react-shadow-dom-and-csp-to-automate-safari-without-chrome

Repo: github.com/achiya-automation/safari-mcp
MIT, 6K monthly npm downloads organically.

Not asking for a newsletter slot — just wanted the engineering-taste
folks to know the WebKit MCP option exists.

— Achiya
```

---

## Tier 2 — Broader tech audience (lower priority, DM only if Tier 1 lands)

### 4. Swyx (@swyx) — Latent Space newsletter
Same tech-taste audience, but very high volume. Only DM if we have a specific hook (e.g. Lexical/ProseMirror deep-dive article with benchmarks).

### 5. David East (@_davideast) — Google Labs, MCP/browser-tooling corner
Google employee, DMs work but he's conservative about signal-boosting competitors to Chrome extensions. Skip unless we have a cross-platform story.

---

## Before sending ANY of these
1. Check latest tweets — if they just ranted about something unrelated, wait.
2. Check if they already know about Safari MCP — search `safari-mcp @simonw` on X.
3. Verify current handle — reply handles change, DMs to dead accounts waste the shot.
4. **Never DM the same day as a directory submission** — looks coordinated/spammy.

## After sending
- Log in STATUS.md: `| <date> | DM to <handle> — sent, status: awaiting | `
- Do NOT follow up within 30 days. One shot. If they reply, engage. If not, move on.
- If they publicly mention safari-mcp, thank them with a specific technical reply (not "thanks for the mention!")

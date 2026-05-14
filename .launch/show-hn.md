# Show HN Launch — safari-mcp

## Recommended timing
- **Tuesday–Thursday, 08:00–10:00 ET** = 15:00–17:00 ישראל
- Current window today (Tue 2026-04-21): post around 17:00 ISR / 10:00 ET

## Submission URL
https://news.ycombinator.com/submit

## Title (under 80 chars)
`Show HN: Safari MCP – 80 tools to drive your real Safari from AI agents`

Backup titles:
- `Show HN: Safari MCP – Browser automation for AI agents without Chrome`
- `Show HN: Safari MCP – Give your AI agent your real logged-in Safari`

## URL field
https://github.com/achiya-automation/safari-mcp

## First comment (post immediately after submission)
```
Author here. I built this after spending months running two browsers
just so my AI agents could navigate the web — my real Safari with
all my logins and a headless Chromium with none of them, competing
for CPU on an M-series Mac.

Safari MCP drives the Safari you're already logged into (Gmail,
GitHub, Ahrefs, Slack, banking) via AppleScript + injected JavaScript.
No WebDriver. No Puppeteer. No Playwright. No second browser.
Just 80 MCP tools an agent can call — navigate, click, fill, screenshot,
network inspection, accessibility tree, storage, and more.

On my M1 Pro the CPU savings are real (I measured ~60% vs headless
Chrome running the same scrape loop), but the bigger value is that
agents inherit the user's cookies and sessions without any login
automation. Password managers, 2FA, OAuth — just work, because
it's the same Safari the human already trusts.

macOS only. MIT. What would make this more useful for your agent
workflows? I'm especially interested in feedback from folks running
Claude Code, Cursor, or n8n setups.
```

## Response prep
Critical comments are doing you a favor — treat them that way.

Likely critique → response:
- "Why not Playwright?" → Playwright needs a separate browser binary + re-login for every service. Safari MCP is about inheriting sessions, not just scripting. For greenfield scrapers Playwright still wins.
- "macOS only is a dealbreaker" → Agreed for Linux deploys. Use case is primarily local agent work (coding, research) where the dev is on a Mac anyway.
- "What about WebKit on Linux?" → WebKit-GTK doesn't expose the AppleScript bridge this uses. Would need a different architecture.
- "Security — you're letting an AI drive my logged-in browser?" → Yes, deliberately. Local agent, local browser, user-controlled. No remote server involved. Audit-friendly: every tool call is visible.
- "Bot detection vs Cloudflare?" → Real Safari + real cookies + real user-agent string + AppleScript events at OS level. Passes more WAF checks than headless browsers.

## Content checklist
- [x] Title starts with "Show HN:"
- [x] URL goes to GitHub repo (not landing page)
- [x] First comment explains who/why/what-feedback
- [x] No asking for upvotes
- [x] No submission links posted anywhere

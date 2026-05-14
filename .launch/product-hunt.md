# Product Hunt Launch — safari-mcp

## Timing (critical for PH ranking algorithm)
- **Launch day**: Tuesday / Wednesday / Thursday (weekend + Monday get less traffic)
- **Exact time**: 00:01 AM Pacific Time = 10:01 AM ישראל (summer time) / 11:01 AM (winter)
- **Full 24-hour cycle required** — any later and you lose hours before midnight PT cutoff
- NEVER launch Friday-Monday

## Prerequisites before launch
- [ ] **Hunter** — someone with 500+ followers willing to submit. Ask punkpeye (awesome-mcp-servers maintainer, merged our PR) or the Claude Relations team
- [ ] **Video or GIF** (up to 60 sec) — PH data: posts with video get 2.7x more upvotes
- [ ] **4-5 screenshots**: (1) hero shot, (2) install command, (3) browser session with agent, (4) tool list, (5) CPU comparison
- [ ] **Makers' accounts** active on PH with bio
- [ ] **First 10 comments prepared** — responses to expected questions
- [ ] **Email list warmed** — notify 48h ahead asking for feedback, not votes

## Product Hunt listing

### Name
`Safari MCP`

### Tagline (60 char max)
`Native Safari automation for AI agents — no Chrome needed`

(backup: `Give your AI agent your real, logged-in Safari`)

### Description (260 char max — shown in feed)
```
Your AI agent shouldn't need a second browser. Safari MCP drives the
Safari you're already logged into — Gmail, GitHub, Slack, banking —
with 80 tools + ~60% less CPU than headless Chrome. macOS native,
one npx command, MIT.
```

### Topics (pick 3)
1. Developer Tools
2. Artificial Intelligence
3. macOS

### Links
- **Website**: https://github.com/achiya-automation/safari-mcp
- **Code**: https://github.com/achiya-automation/safari-mcp
- **npm**: https://www.npmjs.com/package/safari-mcp
- **Docs**: https://github.com/achiya-automation/safari-mcp#readme

### First maker comment (post at 00:02 PT)
```
Hey PH 👋 Maker here.

I got tired of running two browsers. One for me, one for my AI agent.
Mine had all my logins. The agent's had none. So every time the agent
needed to "log into X," I had to automate credentials. Or it just failed.

Safari MCP is the fix. It drives the Safari you're already logged into
via AppleScript + injected JavaScript. No WebDriver. No Puppeteer. No
Chromium running behind the scenes. 80 MCP tools — navigate, click,
fill, screenshot, network, storage, accessibility tree.

Measurable on my M1 Pro: ~60% less CPU than the same scrape loop in
headless Chrome. Real user agent, real cookies, real Safari profile —
which means Cloudflare and reCAPTCHA stop treating your agent as a bot.

Three caveats:
1. macOS only (WebKit-GTK doesn't expose the AppleScript bridge)
2. First-run enable: Safari → Develop → Allow JavaScript from Apple Events
3. Not for headless CI — this is local agent work

Install: `npx safari-mcp`
Works with Claude Code, Cursor, n8n, and any MCP-aware agent.

What would make this more useful for your agent workflows? Happy to
ship requests — Hacker News feedback has already driven 3 releases.
```

### Expected critiques → prepared responses
- **"macOS only is a dealbreaker"** → You're right for CI/server. This is for local developer work — 80% of MCP usage on my data is Claude Code/Cursor running on a Mac anyway.
- **"Isn't this just AppleScript?"** → AppleScript is the transport, but the hard parts are: React Fiber walking for controlled inputs, shadow-DOM piercing, ProseMirror/Lexical editor support, native CGEvent for isTrusted paste. Those are all in safari.js.
- **"Playwright is fine"** → Playwright needs a separate browser + re-login per service. Safari MCP inherits every session you already have. Different use case.
- **"How is this different from browsermcp/mcp?"** → browsermcp drives Chrome via WebSocket. Safari MCP drives Safari via AppleScript — no second browser, no extension required beyond Safari's built-in Apple Events bridge.

## Promotion timeline (day of launch)
- **T-24h**: Post LinkedIn + Twitter teaser "launching on PH tomorrow, will share link at 10 AM"
- **T-1h**: Hunter checks in, prepares to submit
- **T+0**: Hunter submits. Makers confirm. First comment posted within 2 min.
- **T+10min**: Post link everywhere — LinkedIn, Twitter, dev.to comment threads, Slack communities
- **T+1h to T+8h**: Respond to every PH comment within 5 min. Every engagement matters for ranking.
- **T+12h**: Mid-day recap post on LinkedIn/Twitter ("we're at X upvotes, most helpful feedback so far was...")
- **T+23h**: Final push — personal asks to network

## Do NOT
- [ ] Ask for upvotes directly ("please upvote" = auto-downvote per PH community rules)
- [ ] Submit from your own account (need an unrelated hunter)
- [ ] Launch with stale screenshots (update them before hunter submits)
- [ ] Cross-promote more than 2 times on the same social platform (spam perception)

## Success benchmarks (MCP tool comparables)
- **Aera Browser** (similar MCP): 248 upvotes → ~300 GitHub stars
- **Desktop Commander MCP**: 80K views before PH, hit #2 Product of the Day
- **mcp-server-time**: ~100 upvotes → modest traction
- Realistic goal for safari-mcp: **150-300 upvotes → 100-200 new stars over 3 days**

## After launch (day 2-7)
- [ ] Update README with PH badge
- [ ] Thank-you LinkedIn post listing 3 favorite feedback points received
- [ ] Ship at least one feature requested during PH — compounds goodwill
- [ ] Reach out to anyone who commented asking questions — turn them into users

# Reddit Post — r/mcp + r/modelcontextprotocol

## Subreddit priority
1. r/mcp (most directly relevant)
2. r/modelcontextprotocol (official subreddit)
3. r/LocalLLaMA (technical audience)
4. r/selfhosted (FOSS angle)
5. r/SideProject (tolerant of "I built")

## Warming check (BEFORE posting)
- [ ] At least 30 days of comment history
- [ ] At least 10 value-only comments on others' posts
- [ ] Karma > 50 comment karma
- [ ] Account not flagged for spam

If warming insufficient: wait, don't force the post.

## Title

`Safari MCP — 80 tools to drive your real Safari from AI agents (no Chrome, no Puppeteer)`

## Body

```
After a year of running two browsers just so my AI agents could
browse the web — Safari for me, headless Chromium for the agent —
I shipped a different approach.

Safari MCP is an MCP server that drives the Safari you're already
logged into. AppleScript + injected JavaScript. 80 tools. No
WebDriver. No Puppeteer. No Playwright.

Why it matters for MCP workflows:

- **Agents inherit real sessions.** Gmail, GitHub, Ahrefs, banking
  dashboards — already logged in. No automation for login or 2FA.
- **~60% less CPU than headless Chrome** on Apple Silicon (measured
  on an M1 Pro running the same scrape loop).
- **Framework-aware form filling.** React/Vue/Angular setters called
  natively — no guessing whether input events fired.
- **Background operation.** Safari stays behind your other windows.
  You keep working while the agent drives.

Install:
    npx safari-mcp

Works with Claude Code, Cursor, n8n, and any MCP-aware agent.

Limitations:
- macOS only (WebKit-GTK on Linux doesn't expose the AppleScript
  bridge this uses).
- First-time setup requires Safari → Develop → Allow JavaScript
  from Apple Events.
- Not a replacement for Playwright if you need headless on CI —
  this is local-developer use.

GitHub: https://github.com/achiya-automation/safari-mcp
npm: https://www.npmjs.com/package/safari-mcp (6,000+ monthly downloads)
MCP Registry: registered as io.github.achiya-automation/safari-mcp

What would make this more useful for your agent setup?
```

## Post-submit
- Reply to every comment in first 2 hours
- Do NOT upvote own post from alt accounts
- Do NOT cross-post to 3+ subs in the same hour (looks spammy)

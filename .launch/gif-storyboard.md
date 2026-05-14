# Demo GIF Storyboard — safari-mcp README

**Current state**: README uses `safari-mcp-showcase.gif` from v2.1.2 release (pre-v2.9.x). Shows older tools only. Doesn't showcase the features that differentiate us (modal-detection, Lexical, ProseMirror, React).

**Goal**: Replace with a 15-25 second GIF that shows "agent drives real Safari, task completes, impressive."

## Target specs
- **Duration**: 15-25 sec (sweet spot for GitHub README — >30s people stop watching)
- **Resolution**: 1200 × 750 px (fits GitHub README width without scaling)
- **File size**: under 5MB (GitHub inlines up to 10MB but faster = better)
- **Format**: GIF (universal, no autoplay issues) — or WebM if sticking to release asset
- **Tool**: macOS `Command+Shift+5` → Record selection → convert with `ffmpeg` or Giphy Capture

## Recommended narrative (Option A — LinkedIn post flow)

**Hook first 3 seconds:**
- Start on LinkedIn feed (user already logged in — THIS IS THE POINT)
- Cursor (not a Chromium cursor — the real macOS one) hovers the "Write a post" trigger

**Middle 15-18 seconds — the magic:**
- Agent request visible in a side panel (Claude Code transcript): "Post to LinkedIn announcing v2.9.4"
- Safari actions visible: composer opens, text gets typed character-by-character (actually via Lexical's internal API — looks like typing), image attaches
- Timestamp visible in status bar so viewers see "this happened in real time"

**Close 3 seconds:**
- Post button becomes enabled — click — "Your post is live" confirmation

**Overlay text** (simple, not over-designed):
- `Your real Safari. Logged in. 80 tools. No Chrome.`
- Show CPU meter briefly (Activity Monitor): Safari ~4%, highlight contrast with hypothetical Chrome run

## Recommended narrative (Option B — multi-site speedrun)

Faster-paced, more Matrix-y:
- **0-4s**: Safari open to GitHub notifications. Agent reads unread issues.
- **4-8s**: Safari jumps to Ahrefs, pulls backlinks screenshot.
- **8-14s**: Safari navigates to Gmail, drafts email to customer with data from both.
- **14-18s**: All three tabs shown — agent wrote email, saved as draft.
- **18-22s**: Activity Monitor — single Safari process, ~5% CPU.
- **Final frame**: `npx safari-mcp`

This one is better for the "80 tools" claim — viewer sees actual diversity of use cases.

## What NOT to show
- ❌ **Permission dialogs** — boring, puts macOS gatekeeping front-and-center (we have a separate setup GIF for that)
- ❌ **Safari re-launching** — kills momentum
- ❌ **Error recovery** — GIF isn't the place for resilience demos
- ❌ **Hebrew text in UI** — international audience; keep English
- ❌ **Long typing animations of boilerplate** — use Lexical's setEditorState to make text appear in one beat

## Recording checklist
- [ ] Close all unrelated tabs and apps (including Claude Code notifications — they ring distraction)
- [ ] Clean desktop wallpaper — no screenshots of other projects
- [ ] Safari profile with ONLY demo-relevant logins (no exposed customer data)
- [ ] Window size 1200 × 750 fixed (record region, not window)
- [ ] Dark mode consistent throughout — light-mode switch mid-GIF looks unprofessional
- [ ] Speed ×1 or ×1.5 — never faster, viewer needs to parse what's happening

## After recording
1. Trim to exactly 18-22 seconds
2. Add overlay text in final 2 seconds only (don't distract during action)
3. Run through `gifski` or `ffmpeg -vf fps=15` to hit file-size target
4. Upload to GitHub Releases (new release `v2.9.4-demo` or similar)
5. Update `README.md` line 26:
   ```
   ![Safari MCP Demo](https://github.com/achiya-automation/safari-mcp/releases/download/v2.9.4-demo/safari-mcp-demo-2026-04.gif)
   ```
6. Optional: keep old v2.1.2 GIF as `[Archive demo](old-url)` link at the bottom of the README for historical continuity

## ffmpeg conversion snippet
```bash
# Record via Cmd+Shift+5 → save as demo.mov
ffmpeg -i demo.mov -vf "fps=15,scale=1200:-1:flags=lanczos" \
  -c:v gif -preset slow demo.gif

# Or better: palette-aware GIF for smaller size
ffmpeg -i demo.mov -vf "fps=15,scale=1200:-1:flags=lanczos,palettegen=stats_mode=diff" palette.png
ffmpeg -i demo.mov -i palette.png -lavfi "fps=15,scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" safari-mcp-demo.gif
```

## When to do this
**Immediately after v2.9.4 ships** (the Lexical fix for LinkedIn). That gives the GIF
a real demo (agent posts to LinkedIn) that wasn't possible in v2.9.3.

Fallback narrative if v2.9.4 is delayed: record the multi-site speedrun (Option B) with
pre-v2.9.4 tools — still impressive, still honest.

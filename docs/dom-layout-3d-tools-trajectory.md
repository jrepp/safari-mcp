# DOM, Layout, and 3D Tooling Trajectory

## Purpose

Safari MCP already gives agents a compact way to navigate pages, inspect accessible state, interact with elements, capture screenshots, and run JavaScript. The next step is to expose browser rendering state in a way that helps agents answer these questions efficiently:

- What DOM node should I act on?
- Why is this element not visible, clickable, or correctly positioned?
- What changed after the last interaction?
- Is a canvas or 3D scene actually rendering, framed, and animating?

The trajectory below favors a context-efficient pipeline. Tools should return compact summaries by default, provide stable refs for follow-up calls, and only return large DOM trees, screenshots, pixel samples, or WebGL traces when the caller asks for a targeted drill-down.

## Current Baseline

Relevant local surfaces:

- `index.js`: MCP tool registration and request routing.
  - `safari_snapshot` returns a compact accessibility-like tree with interaction refs.
  - `safari_screenshot` returns viewport, full-page, or element screenshots.
  - `safari_extract` already groups structured extraction modes such as element, query, style, accessibility, performance, and CSS coverage.
  - `safari_pointer` owns hover and drag actions.
- `safari.js`: Safari automation implementation.
  - `takeSnapshot()` walks DOM/shadow DOM, assigns `data-mcp-ref`, and stores compact ref metadata.
  - `getPerformanceMetrics()` already includes layout shift summary data.
  - Screenshot and element screenshot paths are already implemented.
- `extension/content.js`: MAIN-world document-start script.
  - It already patches `attachShadow()` and creates a Trusted Types policy early.
  - This is the right place to add optional early rendering instrumentation for canvas/WebGL.

## Design Principles

1. Keep the tool surface compact.
   Add modes to existing tools before adding top-level tools. Prefer `safari_extract kind=...`, `safari_screenshot overlay=...`, and `safari_pointer action=hit_test`.

2. Use a progressive context pipeline.
   The default result should be a compact diagnostic summary, not a raw dump. Every summary should include refs or IDs that support targeted follow-up calls.

3. Separate summaries from evidence.
   Text/JSON summaries should answer what likely matters. Screenshots, overlays, full DOM trees, and pixel samples are evidence requested after the summary points to a specific concern.

4. Make refs stable within a snapshot generation.
   Reuse existing `data-mcp-ref` generation where possible. New layout, DOM, and hit-test outputs should reference the same ref IDs returned by `safari_snapshot`.

5. Prefer browser-native primitives.
   Use `getBoundingClientRect()`, `getClientRects()`, `elementsFromPoint()`, `IntersectionObserver`, `ResizeObserver`, `MutationObserver`, `PerformanceObserver`, Canvas, and WebGL APIs directly.

6. Preserve tab safety and background operation.
   New read-only diagnostics should be safe on the active MCP-owned tab. Write or instrumentation steps that modify page state must route through existing direct write safeguards.

## Context Pipeline

The intended agent workflow is:

1. `safari_snapshot`
   Get compact semantic state and refs. This remains the first tool for normal page work.

2. `safari_extract kind=layout`
   Ask why selected refs or selectors are visible, hidden, clipped, overlapped, offscreen, or hard to click.

3. `safari_pointer action=hit_test`
   Drill into a coordinate or ref center when clicks miss or hit the wrong element.

4. `safari_screenshot overlay=refs|layout|hit_test`
   Capture visual evidence only when geometry summaries are not enough.

5. `safari_extract kind=dom_tree`
   Fetch a bounded structured subtree when parent/child relationships, shadow roots, iframes, or generated selectors matter.

6. `safari_extract kind=visual|canvas`
   Diagnose visual rendering, blank canvas, animation, and 3D scene health.

7. `observe_layout` session actions
   When debugging dynamic apps, install observers before an interaction and fetch summarized changes after it.

Each stage should cap output by default and include `next` suggestions such as "call hit_test for ref=4 center" or "call screenshot overlay=layout for selectors=[...]".

## Phase 1: Structured Layout Inspection

### User Value

Agents can explain and fix layout bugs without reading huge DOM dumps or relying on screenshots alone.

### API Shape

Extend `safari_extract`:

```json
{
  "kind": "layout",
  "selector": ".toolbar button",
  "limit": 20
}
```

Optional arguments:

- `ref`: inspect one snapshot ref.
- `refs`: inspect several refs.
- `includeAncestors`: include scroll, clipping, positioned, and transformed ancestors.
- `includeChildren`: include immediate children.
- `viewportOnly`: default `true`.
- `diagnostics`: default `true`.

### Output Contract

Default output is compact JSON:

```json
{
  "viewport": { "width": 1440, "height": 900, "scrollX": 0, "scrollY": 320, "devicePixelRatio": 2 },
  "items": [
    {
      "ref": "12_4",
      "selector": "button.save",
      "tag": "BUTTON",
      "text": "Save",
      "rect": { "x": 1120, "y": 24, "width": 72, "height": 32 },
      "visible": true,
      "clickable": false,
      "centerTopmost": false,
      "topmostAtCenter": { "tag": "DIV", "selector": ".modal-backdrop", "ref": "12_1" },
      "issues": ["covered-at-center"],
      "style": { "display": "block", "position": "fixed", "zIndex": "10", "pointerEvents": "auto", "opacity": "1" }
    }
  ]
}
```

### Implementation Notes

- Build on the existing snapshot ref metadata in `window.__mcpRefs`.
- Resolve targets by `ref`, `refs`, `selector`, or all visible/interactable refs when omitted.
- Collect:
  - `getBoundingClientRect()`
  - `getClientRects()`
  - computed style subset
  - viewport intersection
  - scroll parents
  - clipping parents
  - transformed ancestors
  - positioned ancestors
  - `elementsFromPoint()` stack at center and key corners
- Avoid returning full computed style unless `properties` is supplied.

### Completion Criteria

- `safari_extract kind=layout` works for selector, ref, refs, and omitted target modes.
- Default output is under 12 KB for a normal application viewport.
- It identifies at least these issue labels:
  - `display-none`
  - `visibility-hidden`
  - `zero-size`
  - `offscreen`
  - `clipped`
  - `opacity-zero`
  - `pointer-events-none`
  - `covered-at-center`
  - `disabled`
- It includes topmost element details for center hit testing.
- It handles open shadow DOM and existing captured closed shadow roots where possible.
- It has a manual test page covering hidden, clipped, covered, transformed, fixed, sticky, and offscreen elements.

Status:

- Implemented in `safari_extract kind=layout`.
- Manual fixture added at `scripts/fixtures/layout-cases.html`.
- Live validation script added at `scripts/test-layout-live.js`.

## Phase 2: Hit Testing and Screenshot Overlays

### User Value

Agents can connect DOM refs to pixels and understand why pointer actions miss.

### API Shape

Extend `safari_pointer`:

```json
{
  "action": "hit_test",
  "x": 200,
  "y": 120
}
```

Also support:

```json
{
  "action": "hit_test",
  "ref": "12_4"
}
```

Extend `safari_screenshot`:

```json
{
  "overlay": "refs"
}
```

Overlay modes:

- `refs`: draw visible snapshot refs and centers.
- `layout`: draw boxes colored by issue severity.
- `hit_test`: draw the tested point and element stack.

### Output Contract

`hit_test` returns:

```json
{
  "point": { "x": 200, "y": 120 },
  "stack": [
    { "depth": 0, "ref": "12_8", "tag": "BUTTON", "selector": "button.primary", "pointerEvents": "auto" },
    { "depth": 1, "tag": "DIV", "selector": ".toolbar" }
  ],
  "actionable": { "ref": "12_8", "reason": "topmost interactive element" }
}
```

### Implementation Notes

- Use `document.elementsFromPoint(x, y)`.
- For ref hit tests, use the target center from `getBoundingClientRect()`.
- For overlays, inject a temporary fixed-position canvas or DOM overlay, capture, then remove it.
- Keep overlay labels short. Label collisions should be tolerated, not solved perfectly.

### Completion Criteria

- `hit_test` returns the full element stack for coordinates and refs.
- `hit_test` reports whether the intended ref is topmost at its center.
- `safari_screenshot overlay=refs` visibly labels refs from the last snapshot.
- `safari_screenshot overlay=layout` highlights covered, clipped, hidden, and offscreen targets.
- Temporary overlay nodes are removed even if screenshot capture fails.
- Overlay capture works for viewport screenshots and selector screenshots.

## Phase 3: Structured DOM Tree

### User Value

Agents can inspect real hierarchy when the compact snapshot is insufficient, while still avoiding full-page source dumps.

### API Shape

Extend `safari_extract`:

```json
{
  "kind": "dom_tree",
  "selector": "main",
  "maxDepth": 5,
  "limit": 200
}
```

Optional arguments:

- `ref`: root at a snapshot ref.
- `includeText`: default `false`.
- `includeStyles`: default `false`.
- `includeGeometry`: default `true`.
- `includeHidden`: default `false`.
- `pierceShadow`: default `true`.

### Output Contract

Return bounded JSON nodes:

```json
{
  "root": {
    "ref": "12_1",
    "tag": "MAIN",
    "role": "main",
    "selector": "main",
    "rect": { "x": 0, "y": 80, "width": 1440, "height": 700 },
    "children": []
  },
  "truncated": false,
  "counts": { "nodes": 93, "shadowRoots": 2, "iframes": 1 }
}
```

### Implementation Notes

- Reuse role/name logic from `takeSnapshot()`.
- Emit stable selectors only as best-effort hints, not as guaranteed unique IDs.
- Mark boundaries:
  - `shadowRoot: "open" | "closed-captured" | "none"`
  - `iframe: "same-origin" | "cross-origin" | "not-loaded"`
- Use node budgets aggressively.

### Completion Criteria

- Bounded output respects `maxDepth` and `limit`.
- It includes refs compatible with click/fill/pointer tools where possible.
- It marks shadow and iframe boundaries.
- It avoids text bloat by default.
- It has tests or manual fixtures for nested DOM, shadow DOM, and iframe cases.

## Phase 4: Layout Observation

### User Value

Agents can measure what changed after an interaction without comparing screenshots or re-reading the whole page.

### API Shape

Prefer extending `safari_browser`:

```json
{
  "action": "observe_layout",
  "selector": "body"
}
```

```json
{
  "action": "layout_events",
  "limit": 50
}
```

```json
{
  "action": "clear_layout_events"
}
```

### Event Types

- `mutation`: nodes added, removed, attribute changed.
- `resize`: element content or border box changed.
- `intersection`: target entered or left viewport/root.
- `layout-shift`: cumulative layout shift entries where available.
- `scroll`: scroll position changed for observed scroll roots.

### Implementation Notes

- Install observers in page context:
  - `MutationObserver`
  - `ResizeObserver`
  - `IntersectionObserver`
  - `PerformanceObserver` for `layout-shift`
- Store compact ring buffers on `window.__mcpLayoutEvents`.
- Collapse repeated events by ref/selector/type.
- Return summaries by default, with raw events available via `detail=true`.

### Completion Criteria

- Observation can be started, read, and cleared.
- Event buffers are bounded.
- Repeated resize/mutation bursts are coalesced.
- Events include refs when targets are known.
- A click that opens a modal produces a concise summary of added nodes, changed visibility, and layout shift.

## Phase 5: Canvas and WebGL Diagnostics

### User Value

Agents can tell whether 2D canvas or 3D scenes are blank, hidden, tainted, static, mis-sized, or failing shader/program setup.

### API Shape

Extend `safari_extract`:

```json
{
  "kind": "canvas",
  "selector": "canvas"
}
```

Optional arguments:

- `sampleFrames`: default `2`.
- `sampleDelayMs`: default `250`.
- `includePixels`: default `false`.
- `includeWebGL`: default `true`.
- `limit`: default `10`.

### Output Contract

```json
{
  "canvases": [
    {
      "ref": "12_9",
      "selector": "canvas",
      "rect": { "x": 0, "y": 0, "width": 800, "height": 600 },
      "drawingBuffer": { "width": 1600, "height": 1200 },
      "context": "webgl2",
      "visible": true,
      "blank": false,
      "changing": true,
      "tainted": false,
      "issues": [],
      "webgl": {
        "vendor": "WebKit",
        "renderer": "WebKit WebGL",
        "drawCallsLastFrame": 42,
        "shaderErrors": [],
        "programLinkErrors": []
      }
    }
  ]
}
```

### Implementation Notes

- In normal page JS, inspect canvases with:
  - DOM geometry and visibility checks from Phase 1.
  - `canvas.getContext()` where available.
  - `toDataURL()` or `getImageData()` for 2D when not tainted.
  - WebGL `readPixels()` for sampled pixel stats.
- In `extension/content.js`, optionally patch early:
  - `HTMLCanvasElement.prototype.getContext`
  - WebGL shader compile and program link calls
  - `drawArrays`, `drawElements`, `clear`, `viewport`, and `requestAnimationFrame`
- Instrumentation must be lightweight and disabled unless needed or bounded by a small ring buffer.

### Completion Criteria

- It lists visible canvases and their context types.
- It detects zero-sized, CSS-hidden, offscreen, covered, tainted, blank, and static canvases.
- It samples at least two frames and reports whether pixels changed.
- WebGL diagnostics report drawing buffer size, viewport, basic renderer/vendor info, and recent shader/program errors when instrumentation is active.
- It does not throw on tainted canvases or cross-origin resources; it reports `tainted: true`.
- It has a fixture for blank canvas, static canvas, animated 2D canvas, blank WebGL, and animated WebGL.

## Phase 6: 3D Scene Helpers

### User Value

Agents can validate Three.js/WebGL scenes without needing framework-specific page knowledge.

### API Shape

Extend `safari_extract`:

```json
{
  "kind": "visual",
  "selector": "canvas",
  "mode": "scene_health"
}
```

Optional modes:

- `scene_health`: compact visual/rendering diagnosis.
- `pixel_stats`: color/alpha/change summary.
- `threejs`: best-effort Three.js-specific inspection.

### Output Contract

```json
{
  "summary": {
    "visibleCanvasCount": 1,
    "renderingCanvasCount": 1,
    "animatedCanvasCount": 1,
    "blankCanvasCount": 0,
    "primaryIssue": null
  },
  "recommendations": [
    "Canvas is rendering and changing. Use screenshot overlay=refs to verify framing."
  ]
}
```

### Three.js Detection

Best-effort only:

- Detect `window.THREE` if exposed.
- Detect renderer-like objects when reachable from globals.
- Read `renderer.info`, `renderer.capabilities`, canvas size, pixel ratio, and animation behavior where accessible.
- Never require Three.js. WebGL/canvas diagnostics remain the primary layer.

### Completion Criteria

- It reports a concise health summary for generic WebGL scenes.
- It detects common 3D failures:
  - canvas not mounted
  - canvas has zero CSS size
  - drawing buffer is zero
  - no pixel changes across frames
  - all sampled pixels are transparent/black/clear color
  - WebGL context lost
  - shader compile or program link failures
- It opportunistically reports Three.js `renderer.info` when accessible.
- It stays useful when Three.js is bundled and not exposed globally.

## Output Budgets

Default budgets keep agent context efficient:

| Feature | Default budget |
| --- | --- |
| `layout` | 20 items, compact style subset |
| `hit_test` | 20 stack entries |
| `dom_tree` | depth 5, 200 nodes |
| `layout_events` | 50 coalesced events |
| `canvas` | 10 canvases, 2 frame samples |
| `visual scene_health` | summary plus top 5 issues |
| Screenshot overlays | image only, no duplicated JSON unless requested |

Every expanded mode must require an explicit flag such as `detail=true`, `includeStyles=true`, `includePixels=true`, or a higher `limit`.

## Validation Strategy

Add manual fixtures under `examples/fixtures/` or `scripts/fixtures/`:

- `layout-cases.html`
- `hit-test-cases.html`
- `dom-tree-cases.html`
- `layout-observer-cases.html`
- `canvas-2d-cases.html`
- `webgl-cases.html`
- `threejs-cases.html`

Recommended manual validation flow:

1. Open fixture in an MCP-owned tab.
2. Run `safari_snapshot`.
3. Run the new extraction mode with defaults.
4. Run one targeted drill-down.
5. Capture an overlay screenshot when applicable.
6. Confirm output budget, issue labels, refs, and visual evidence.

Automated tests can start with pure helpers that build JS payloads and normalize outputs. Full browser validation can remain manual until the project has a Safari integration test harness.

## Rollout Order

1. Phase 1 layout inspection.
2. Phase 2 hit testing.
3. Phase 2 screenshot overlays.
4. Phase 3 structured DOM tree.
5. Phase 4 layout observation.
6. Phase 5 canvas diagnostics without WebGL monkey patches.
7. Phase 5 optional WebGL instrumentation in `extension/content.js`.
8. Phase 6 3D scene health and Three.js best-effort helpers.

This order gives agents immediate practical value for layout and click debugging before adding deeper rendering instrumentation.

## References

Local code references:

- `index.js`: MCP tool definitions for `safari_snapshot`, `safari_screenshot`, `safari_pointer`, `safari_extract`, and `safari_browser`.
- `safari.js`: `takeSnapshot()`, screenshot paths, performance metrics, and existing JavaScript execution helpers.
- `extension/content.js`: document-start MAIN-world patch point for shadow DOM and future canvas/WebGL instrumentation.

Web platform references:

- MDN: `Element.getBoundingClientRect()` - https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
- MDN: `Document.elementFromPoint()` - https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint
- MDN: `Document.elementsFromPoint()` - https://developer.mozilla.org/en-US/docs/Web/API/Document/elementsFromPoint
- MDN: `IntersectionObserver` - https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver
- MDN: `ResizeObserver` - https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
- MDN: `MutationObserver` - https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
- MDN: `PerformanceObserver` - https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver
- MDN: `WebGLRenderingContext` - https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext
- MDN: `WebGL2RenderingContext` - https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext
- MDN: `HTMLCanvasElement.getContext()` - https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
- Three.js docs: `WebGLRenderer` - https://threejs.org/docs/pages/WebGLRenderer.html

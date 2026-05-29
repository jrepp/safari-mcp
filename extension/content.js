// Content script — runs at document_start in MAIN world (before page scripts).
// Two responsibilities:
//   1. Monkey-patch attachShadow to capture CLOSED shadow roots (Reddit, etc.).
//   2. Pre-register a Trusted Types policy named "mcpBridge" BEFORE the page sets
//      its own require-trusted-types-for directive. Our policy is then grandfathered
//      and survives even on pages (Google Search Console, Google admin, modern banks)
//      that block new policy creation after page load. MCP evaluate strategies
//      consult `window.__mcpTrustedPolicy` first.
// Runs in MAIN world via manifest "world": "MAIN" — no script injection needed,
// so CSP cannot block it.

if (!window.__mcpShadowPatched) {
  window.__mcpShadowPatched = true;
  var _origAttachShadow = Element.prototype.attachShadow;
  var _closedRoots = new WeakMap();
  Element.prototype.attachShadow = function(init) {
    var shadow = _origAttachShadow.call(this, init);
    if (init && init.mode === "closed") {
      _closedRoots.set(this, shadow);
    }
    return shadow;
  };
  // Expose getter for MCP tools (snapshot, deepQuery, click, fill)
  window.__mcpGetShadowRoot = function(el) {
    return el.shadowRoot || _closedRoots.get(el) || null;
  };
}

if (!window.__mcpTrustedPolicy && window.trustedTypes && typeof window.trustedTypes.createPolicy === "function") {
  try {
    window.__mcpTrustedPolicy = window.trustedTypes.createPolicy("mcpBridge", {
      createScript: function (s) { return s; },
      createScriptURL: function (s) { return s; },
      createHTML: function (s) { return s; }
    });
  } catch (_e) {
    // Page already restricts policies — rare since content script runs at document_start
    // before page scripts. Leave undefined; evaluate fallbacks will probe other paths.
  }
}

// Lightweight canvas/WebGL instrumentation for later diagnostics. This runs before
// most page scripts, keeps only bounded counters/errors, and does not force WebGL
// creation. Tools can read it through window.__mcpGetCanvasInstrumentation(canvas).
if (!window.__mcpCanvasPatched) {
  window.__mcpCanvasPatched = true;
  var _mcpCanvasSeq = 0;
  var _mcpCanvasStats = new WeakMap();
  var _mcpContextStats = new WeakMap();

  function _mcpNow() { return Date.now(); }
  function _mcpPushBounded(list, value, limit) {
    list.push(value);
    if (list.length > limit) list.splice(0, list.length - limit);
  }
  function _mcpCanvasRecord(canvas) {
    if (!canvas) return null;
    var stats = _mcpCanvasStats.get(canvas);
    if (!stats) {
      stats = {
        id: "canvas_" + (++_mcpCanvasSeq),
        contexts: [],
        lastContext: null,
        drawCalls: 0,
        clears: 0,
        viewport: null,
        lastDrawAt: null,
        shaderErrors: [],
        programLinkErrors: []
      };
      _mcpCanvasStats.set(canvas, stats);
    }
    return stats;
  }
  function _mcpContextRecord(ctx, canvas, type) {
    if (!ctx || !canvas) return null;
    var stats = _mcpCanvasRecord(canvas);
    var existing = _mcpContextStats.get(ctx);
    if (!existing) {
      existing = { canvas: canvas, type: type, stats: stats };
      _mcpContextStats.set(ctx, existing);
    }
    if (stats.contexts.indexOf(type) < 0) stats.contexts.push(type);
    stats.lastContext = type;
    return existing;
  }
  function _mcpContextRecordFor(ctx) {
    return _mcpContextStats.get(ctx) || null;
  }
  function _mcpCloneStats(stats) {
    if (!stats) return null;
    return {
      id: stats.id,
      contexts: stats.contexts.slice(),
      lastContext: stats.lastContext,
      drawCalls: stats.drawCalls,
      clears: stats.clears,
      viewport: stats.viewport,
      lastDrawAt: stats.lastDrawAt,
      shaderErrors: stats.shaderErrors.slice(-10),
      programLinkErrors: stats.programLinkErrors.slice(-10)
    };
  }

  try {
    var _origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type) {
      var ctx = _origGetContext.apply(this, arguments);
      if (ctx && type) {
        var normalized = String(type).toLowerCase();
        if (normalized === "webgl" || normalized === "experimental-webgl" || normalized === "webgl2" || normalized === "2d") {
          _mcpContextRecord(ctx, this, normalized === "experimental-webgl" ? "webgl" : normalized);
        }
      }
      return ctx;
    };
  } catch (_e) {}

  function _mcpPatchWebGL(Proto) {
    if (!Proto || Proto.__mcpPatched) return;
    Proto.__mcpPatched = true;

    function wrap(name, fn) {
      var orig = Proto.prototype[name];
      if (typeof orig !== "function") return;
      Proto.prototype[name] = fn(orig);
    }

    wrap("drawArrays", function(orig) {
      return function() {
        var rec = _mcpContextRecordFor(this);
        if (rec) {
          rec.stats.drawCalls++;
          rec.stats.lastDrawAt = _mcpNow();
        }
        return orig.apply(this, arguments);
      };
    });
    wrap("drawElements", function(orig) {
      return function() {
        var rec = _mcpContextRecordFor(this);
        if (rec) {
          rec.stats.drawCalls++;
          rec.stats.lastDrawAt = _mcpNow();
        }
        return orig.apply(this, arguments);
      };
    });
    wrap("clear", function(orig) {
      return function() {
        var rec = _mcpContextRecordFor(this);
        if (rec) rec.stats.clears++;
        return orig.apply(this, arguments);
      };
    });
    wrap("viewport", function(orig) {
      return function(x, y, width, height) {
        var rec = _mcpContextRecordFor(this);
        if (rec) rec.stats.viewport = { x: x, y: y, width: width, height: height };
        return orig.apply(this, arguments);
      };
    });
    wrap("compileShader", function(orig) {
      return function(shader) {
        var result = orig.apply(this, arguments);
        try {
          if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) {
            var rec = _mcpContextRecordFor(this);
            if (rec) _mcpPushBounded(rec.stats.shaderErrors, {
              time: _mcpNow(),
              type: this.getShaderParameter(shader, this.SHADER_TYPE),
              message: this.getShaderInfoLog(shader) || "shader compile failed"
            }, 10);
          }
        } catch (_e) {}
        return result;
      };
    });
    wrap("linkProgram", function(orig) {
      return function(program) {
        var result = orig.apply(this, arguments);
        try {
          if (!this.getProgramParameter(program, this.LINK_STATUS)) {
            var rec = _mcpContextRecordFor(this);
            if (rec) _mcpPushBounded(rec.stats.programLinkErrors, {
              time: _mcpNow(),
              message: this.getProgramInfoLog(program) || "program link failed"
            }, 10);
          }
        } catch (_e) {}
        return result;
      };
    });
  }

  try { _mcpPatchWebGL(window.WebGLRenderingContext); } catch (_e) {}
  try { _mcpPatchWebGL(window.WebGL2RenderingContext); } catch (_e) {}

  window.__mcpGetCanvasInstrumentation = function(canvas) {
    return _mcpCloneStats(_mcpCanvasStats.get(canvas));
  };
}

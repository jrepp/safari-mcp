import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();
let nextTraceId = 0;

export function runWithTrace(toolName, fn) {
  const trace = {
    id: `safari-${process.pid}-${Date.now().toString(36)}-${(++nextTraceId).toString(36)}`,
    toolName,
    startedAt: Date.now(),
    events: [],
  };
  return storage.run(trace, fn);
}

export function currentTrace() {
  return storage.getStore() || null;
}

export function addTraceEvent(dependency, outcome, detail = {}) {
  const trace = currentTrace();
  if (!trace) return;
  trace.events.push({
    dependency,
    outcome,
    atMs: Date.now() - trace.startedAt,
    ...detail,
  });
}

export async function traceDependency(dependency, detail, fn) {
  const start = Date.now();
  addTraceEvent(dependency, "start", detail);
  try {
    const result = await fn();
    addTraceEvent(dependency, "ok", { ...detail, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    addTraceEvent(dependency, "failed", {
      ...detail,
      durationMs: Date.now() - start,
      error: err?.message || String(err),
    });
    throw err;
  }
}

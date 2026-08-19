#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createServer, createConnection } from "node:net";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { cliHelp, parseCliCommand } from "./cli-contract.js";

const here = dirname(fileURLToPath(import.meta.url));
const stateRoot = resolve(
  process.env.SAFARI_BROWSER_STATE_ROOT || join(homedir(), ".safari-mcp", "cli")
);
const version = JSON.parse(readFileSync(join(here, "package.json"), "utf8")).version;
const toolTimeoutMs = positiveEnvironmentMilliseconds("SAFARI_BROWSER_TOOL_TIMEOUT_MS", 120_000);
const socketTimeoutMs = positiveEnvironmentMilliseconds(
  "SAFARI_BROWSER_SOCKET_TIMEOUT_MS",
  toolTimeoutMs + 15_000
);
const shutdownTimeoutMs = positiveEnvironmentMilliseconds(
  "SAFARI_BROWSER_SHUTDOWN_TIMEOUT_MS",
  3_000
);
const mcpEntry = resolve(process.env.SAFARI_BROWSER_MCP_ENTRY || join(here, "index.js"));

function positiveEnvironmentMilliseconds(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer number of milliseconds.`);
  }
  return value;
}

function parseGlobal(argv) {
  const rest = [];
  const options = {
    session: process.env.SAFARI_BROWSER_SESSION || "default",
    profile: process.env.SAFARI_PROFILE || "",
    json: process.env.SAFARI_BROWSER_JSON === "1",
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--session") options.session = argv[++index];
    else if (arg === "--profile") options.profile = argv[++index];
    else if (arg === "--json") options.json = true;
    else rest.push(arg);
  }
  if (!options.session || !/^[a-zA-Z0-9._-]+$/.test(options.session)) {
    throw new Error(
      "Session names may contain only letters, numbers, dots, underscores, and hyphens."
    );
  }
  return { options, rest };
}

function sessionPaths(session) {
  return {
    socket: join(stateRoot, `${session}.sock`),
    pid: join(stateRoot, `${session}.pid`),
    log: join(stateRoot, `${session}.log`),
  };
}

function requestSocket(socketPath, payload, timeoutMs = socketTimeoutMs) {
  return new Promise((resolveRequest, reject) => {
    const socket = createConnection(socketPath);
    let body = "";
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn(value);
    };
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(`${JSON.stringify(payload)}\n`));
    socket.on("data", (chunk) => {
      body += chunk;
    });
    socket.setTimeout(timeoutMs, () => {
      const error = Object.assign(
        new Error(
          `Safari CLI session did not answer within ${timeoutMs}ms; its daemon will be stopped.`
        ),
        { code: "SAFARI_CLI_SOCKET_TIMEOUT" }
      );
      finish(reject, error);
    });
    socket.on("error", (error) => finish(reject, error));
    socket.on("end", () => {
      try {
        finish(resolveRequest, JSON.parse(body));
      } catch {
        finish(reject, new Error(`Safari CLI daemon returned invalid JSON: ${body || "(empty)"}`));
      }
    });
  });
}

function socketIsLive(socketPath) {
  return new Promise((resolveProbe) => {
    const socket = createConnection(socketPath);
    socket.once("connect", () => {
      socket.destroy();
      resolveProbe(true);
    });
    socket.once("error", () => resolveProbe(false));
  });
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function connectOrStart(options, payload) {
  mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const paths = sessionPaths(options.session);
  try {
    return await requestSocket(paths.socket, payload);
  } catch (error) {
    if (error?.code === "SAFARI_CLI_SOCKET_TIMEOUT") {
      await requestSocket(
        paths.socket,
        { kind: "shutdown", reason: "unresponsive-session" },
        shutdownTimeoutMs
      ).catch(() => {});
      throw error;
    }
    if (payload.kind === "shutdown") {
      return { ok: true, data: { stopped: false }, text: "Safari CLI session was not running." };
    }
  }

  const logFd = openSync(paths.log, "a", 0o600);
  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), "__daemon", "--session", options.session],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: {
        ...process.env,
        SAFARI_MCP_QUIET: "1",
        SAFARI_PROFILE: options.profile,
      },
    }
  );
  child.unref();

  let lastError;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    try {
      return await requestSocket(paths.socket, payload);
    } catch (error) {
      if (error?.code === "SAFARI_CLI_SOCKET_TIMEOUT") {
        await requestSocket(
          paths.socket,
          { kind: "shutdown", reason: "unresponsive-session" },
          shutdownTimeoutMs
        ).catch(() => {});
        throw error;
      }
      lastError = error;
    }
  }
  throw new Error(`Safari CLI daemon did not start. See ${paths.log}. ${lastError?.message || ""}`);
}

function textContent(result) {
  return (result.content || [])
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

function maybeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isFatalMcpError(error) {
  const message = String(error?.message || error || "");
  return /request timed out|maximum total timeout|transport closed|connection closed|not connected|safari-helper timeout|helper process (?:exited|error)|daemon wedged|blocked past their timeout/i.test(
    message
  );
}

async function executeTool(client, parsed, requestCwd) {
  if (parsed.local === "help") return { text: cliHelp, data: cliHelp };
  if (parsed.local === "shutdown")
    return { text: "Safari CLI session stopped.", data: { stopped: true }, shutdown: true };

  let result;
  try {
    result = await client.callTool({ name: parsed.tool, arguments: parsed.args }, undefined, {
      timeout: toolTimeoutMs,
      maxTotalTimeout: toolTimeoutMs,
    });
  } catch (error) {
    if (isFatalMcpError(error)) error.fatalSession = true;
    throw error;
  }
  const text = textContent(result);
  if (result.isError) {
    const error = new Error(text || `${parsed.tool} failed.`);
    if (isFatalMcpError(error)) error.fatalSession = true;
    throw error;
  }

  const image = (result.content || []).find((item) => item.type === "image");
  if (image) {
    const extension = image.mimeType === "image/png" ? "png" : "jpg";
    const outputPath = resolve(
      requestCwd || process.cwd(),
      parsed.outputPath || `safari-screenshot-${Date.now()}.${extension}`
    );
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(image.data, "base64"));
    return {
      text: `Screenshot saved to ${outputPath}`,
      data: { path: outputPath, mimeType: image.mimeType },
    };
  }
  return { text, data: maybeJson(text) };
}

async function executeRequest(client, request) {
  if (request.kind === "batch") {
    const results = [];
    for (const [index, step] of request.steps.entries()) {
      try {
        const argv = Array.isArray(step) ? step : [step.command, ...(step.args || [])];
        const result = await executeTool(client, parseCliCommand(argv), request.cwd);
        results.push({ index, command: argv, ok: true, data: result.data });
        if (result.shutdown)
          return {
            ok: true,
            data: results,
            text: JSON.stringify(results, null, 2),
            shutdown: true,
          };
      } catch (error) {
        results.push({ index, command: step, ok: false, error: error.message });
        if (error.fatalSession) {
          return {
            ok: false,
            error: `${error.message} The retained Safari CLI session was stopped; retry starts a clean daemon.`,
            data: results,
            shutdown: true,
          };
        }
        if (request.bail) return { ok: false, error: error.message, data: results };
      }
    }
    const ok = results.every((entry) => entry.ok);
    return {
      ok,
      data: results,
      text: JSON.stringify(results, null, 2),
      ...(ok ? {} : { error: "One or more trajectory steps failed." }),
    };
  }

  try {
    const result = await executeTool(client, parseCliCommand(request.argv), request.cwd);
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: error.fatalSession
        ? `${error.message} The retained Safari CLI session was stopped; retry starts a clean daemon.`
        : error.message,
      ...(error.fatalSession ? { shutdown: true } : {}),
    };
  }
}

async function startDaemon(session) {
  mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const paths = sessionPaths(session);
  if (existsSync(paths.socket)) {
    if (await socketIsLive(paths.socket)) return;
    try {
      unlinkSync(paths.socket);
    } catch {}
  }
  let stopping = false;
  /** @type {Promise<unknown>} */
  let commandQueue = Promise.resolve();
  let client;
  let transport;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolveReadyPromise, rejectReadyPromise) => {
    resolveReady = resolveReadyPromise;
    rejectReady = rejectReadyPromise;
  });
  const server = createServer((socket) => {
    let body = "";
    let handled = false;
    socket.setEncoding("utf8");
    socket.on("data", async (chunk) => {
      body += chunk;
      if (handled || !body.includes("\n")) return;
      handled = true;
      let response;
      try {
        const request = JSON.parse(body.trim());
        if (request.kind === "shutdown") {
          socket.end(
            JSON.stringify({
              ok: true,
              data: { stopped: true, reason: request.reason || "requested" },
              shutdown: true,
            })
          );
          void stopDaemon();
          return;
        }
        const operation = commandQueue.then(async () => {
          await ready;
          return executeRequest(client, request);
        });
        commandQueue = operation.catch(() => {});
        response = await operation;
      } catch (error) {
        response = { ok: false, error: error.message };
      }
      socket.end(JSON.stringify(response));
      if (response.shutdown && !stopping) {
        void stopDaemon();
      }
    });
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(paths.socket, () => resolveListen(undefined));
  });
  writeFileSync(paths.pid, String(process.pid), { mode: 0o600 });

  async function stopDaemon() {
    if (stopping) return;
    stopping = true;
    server.close();
    const mcpPid = transport?.pid;
    const closeTask = (async () => {
      await client?.close().catch(() => {});
      await transport?.close().catch(() => {});
    })();
    await Promise.race([
      closeTask,
      new Promise((resolveWait) => setTimeout(resolveWait, shutdownTimeoutMs)),
    ]);
    if (mcpPid && processIsAlive(mcpPid)) {
      try {
        process.kill(mcpPid, "SIGTERM");
      } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
      if (processIsAlive(mcpPid)) {
        try {
          process.kill(mcpPid, "SIGKILL");
        } catch {}
      }
    }
    try {
      unlinkSync(paths.socket);
    } catch {}
    try {
      unlinkSync(paths.pid);
    } catch {}
    process.exit(0);
  }

  transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcpEntry],
    cwd: here,
    env: { ...process.env, SAFARI_MCP_QUIET: "1" },
    stderr: "inherit",
  });
  client = new Client({ name: `safari-browser-${session}`, version });
  try {
    await client.connect(transport, { timeout: 15_000 });
    resolveReady();
  } catch (error) {
    rejectReady(error);
    await stopDaemon();
    return;
  }
  process.on("exit", () => {
    try {
      unlinkSync(paths.socket);
    } catch {}
    try {
      unlinkSync(paths.pid);
    } catch {}
  });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => void stopDaemon());
  }
}

async function loadTrajectory(path) {
  const parsed = JSON.parse(await readFile(resolve(path), "utf8"));
  if (!Array.isArray(parsed)) throw new Error("A trajectory file must contain a JSON array.");
  return parsed;
}

async function main() {
  const { options, rest } = parseGlobal(process.argv.slice(2));
  if (rest[0] === "__daemon") return startDaemon(options.session);
  if (rest[0] === "--version" || rest[0] === "-V") {
    console.log(version);
    return;
  }
  if (!rest[0] || new Set(["help", "--help", "-h"]).has(rest[0])) {
    console.log(cliHelp);
    return;
  }

  let payload;
  if (rest[0] === "close" && rest.includes("--all")) {
    payload = { kind: "shutdown", reason: "requested" };
  } else if (rest[0] === "run") {
    const path = rest[1];
    if (!path) throw new Error("run requires a trajectory JSON path.");
    payload = {
      kind: "batch",
      steps: await loadTrajectory(path),
      bail: rest.includes("--bail"),
      cwd: process.cwd(),
    };
  } else {
    payload = { kind: "command", argv: rest, cwd: process.cwd() };
  }

  const response = await connectOrStart(options, payload);
  if (options.json) {
    const { text: _text, ...structured } = response;
    console.log(JSON.stringify(structured, null, 2));
  } else if (response.ok)
    console.log(
      response.text ??
        (typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2))
    );
  else console.error(response.error || "Safari CLI command failed.");
  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

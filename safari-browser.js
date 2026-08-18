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
const stateRoot = join(homedir(), ".safari-mcp", "cli");
const version = JSON.parse(readFileSync(join(here, "package.json"), "utf8")).version;

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

function requestSocket(socketPath, payload) {
  return new Promise((resolveRequest, reject) => {
    const socket = createConnection(socketPath);
    let body = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(`${JSON.stringify(payload)}\n`));
    socket.on("data", (chunk) => {
      body += chunk;
    });
    socket.on("error", reject);
    socket.on("end", () => {
      try {
        resolveRequest(JSON.parse(body));
      } catch {
        reject(new Error(`Safari CLI daemon returned invalid JSON: ${body || "(empty)"}`));
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

async function connectOrStart(options, payload) {
  mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const paths = sessionPaths(options.session);
  try {
    return await requestSocket(paths.socket, payload);
  } catch {}

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

async function executeTool(client, parsed) {
  if (parsed.local === "help") return { text: cliHelp, data: cliHelp };
  if (parsed.local === "shutdown")
    return { text: "Safari CLI session stopped.", data: { stopped: true }, shutdown: true };

  const result = await client.callTool({ name: parsed.tool, arguments: parsed.args }, undefined, {
    timeout: 120_000,
  });
  const text = textContent(result);
  if (result.isError) throw new Error(text || `${parsed.tool} failed.`);

  const image = (result.content || []).find((item) => item.type === "image");
  if (image) {
    const extension = image.mimeType === "image/png" ? "png" : "jpg";
    const outputPath = resolve(parsed.outputPath || `safari-screenshot-${Date.now()}.${extension}`);
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
        const result = await executeTool(client, parseCliCommand(argv));
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
    const result = await executeTool(client, parseCliCommand(request.argv));
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error.message };
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
  writeFileSync(paths.pid, String(process.pid), { mode: 0o600 });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(here, "index.js")],
    cwd: here,
    env: { ...process.env, SAFARI_MCP_QUIET: "1" },
    stderr: "inherit",
  });
  const client = new Client({ name: `safari-browser-${session}`, version });
  await client.connect(transport, { timeout: 15_000 });

  let stopping = false;
  let commandQueue = Promise.resolve();
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
        const operation = commandQueue.then(() => executeRequest(client, request));
        commandQueue = operation.catch(() => {});
        response = await operation;
      } catch (error) {
        response = { ok: false, error: error.message };
      }
      socket.end(JSON.stringify(response));
      if (response.shutdown && !stopping) {
        stopping = true;
        server.close();
        await client.close().catch(() => {});
        await transport.close().catch(() => {});
        process.exit(0);
      }
    });
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(paths.socket, resolveListen);
  });
  process.on("exit", () => {
    try {
      unlinkSync(paths.socket);
    } catch {}
    try {
      unlinkSync(paths.pid);
    } catch {}
  });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, async () => {
      if (stopping) return;
      stopping = true;
      server.close();
      await client.close().catch(() => {});
      await transport.close().catch(() => {});
      process.exit(0);
    });
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
  if (rest[0] === "run") {
    const path = rest[1];
    if (!path) throw new Error("run requires a trajectory JSON path.");
    payload = { kind: "batch", steps: await loadTrajectory(path), bail: rest.includes("--bail") };
  } else {
    payload = { kind: "command", argv: rest };
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

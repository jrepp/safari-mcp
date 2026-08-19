import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { after, test } from "node:test";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repositoryRoot, "safari-browser.js");
const fakeMcpPath = join(repositoryRoot, "test", "fixtures", "cli-fake-mcp.mjs");
const testRoot = await mkdtemp(join(tmpdir(), "safari-browser-cli-"));
const stateRoot = join(testRoot, "state");
const invocationRoot = join(testRoot, "invocation");
const baseEnvironment = {
  ...process.env,
  SAFARI_BROWSER_STATE_ROOT: stateRoot,
  SAFARI_BROWSER_MCP_ENTRY: fakeMcpPath,
  SAFARI_BROWSER_TOOL_TIMEOUT_MS: "250",
  SAFARI_BROWSER_SOCKET_TIMEOUT_MS: "1000",
  SAFARI_BROWSER_SHUTDOWN_TIMEOUT_MS: "500",
};

async function runCli(args, options = {}) {
  return execFileAsync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd || repositoryRoot,
    env: { ...baseEnvironment, ...options.env },
    timeout: options.timeout || 5_000,
  });
}

async function stopSession(session) {
  await runCli(["--session", session, "--json", "close", "--all"]).catch(() => {});
}

async function waitForMissing(path, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await stat(path);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 20));
  }
  assert.fail(`${path} still exists after ${timeoutMs}ms`);
}

async function waitForPresent(path, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await stat(path);
      return;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 20));
  }
  assert.fail(`${path} was not created within ${timeoutMs}ms`);
}

async function waitForProcessExit(pid, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return;
      throw error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 20));
  }
  assert.fail(`process ${pid} is still alive after ${timeoutMs}ms`);
}

after(async () => {
  await Promise.all([
    stopSession("retained"),
    stopSession("concurrent"),
    stopSession("paths"),
    stopSession("timeout"),
    stopSession("interrupt"),
  ]);
  await rm(testRoot, { recursive: true, force: true });
});

test("named CLI sessions retain one MCP child across invocations", async () => {
  const first = JSON.parse(
    (await runCli(["--session", "retained", "--json", "raw", "safari_echo", '{"value":"a"}']))
      .stdout
  );
  const second = JSON.parse(
    (await runCli(["--session", "retained", "--json", "raw", "safari_echo", '{"value":"b"}']))
      .stdout
  );

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.data.echoCount, 1);
  assert.equal(second.data.echoCount, 2);
  assert.equal(first.data.pid, second.data.pid);
});

test("concurrent first commands converge on one daemon and one MCP child", async () => {
  const [firstResult, secondResult] = await Promise.all([
    runCli(["--session", "concurrent", "--json", "raw", "safari_echo", '{"value":"a"}']),
    runCli(["--session", "concurrent", "--json", "raw", "safari_echo", '{"value":"b"}']),
  ]);
  const first = JSON.parse(firstResult.stdout);
  const second = JSON.parse(secondResult.stdout);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.data.pid, second.data.pid);
  assert.deepEqual([first.data.echoCount, second.data.echoCount].sort(), [1, 2]);
});

test("relative screenshot output follows each invoking working directory", async () => {
  await mkdir(invocationRoot, { recursive: true });
  const response = JSON.parse(
    (
      await runCli(["--session", "paths", "--json", "screenshot", "capture.png"], {
        cwd: invocationRoot,
      })
    ).stdout
  );

  assert.equal(response.ok, true);
  assert.equal(
    await realpath(response.data.path),
    await realpath(join(invocationRoot, "capture.png"))
  );
  assert.ok((await stat(response.data.path)).size > 0);
});

test("a timed-out MCP call stops the retained daemon and the next call starts clean", async () => {
  const childPidPath = join(testRoot, "timeout-child.pid");
  await assert.rejects(
    runCli(["--session", "timeout", "--json", "raw", "safari_delay", '{"ms":1000}'], {
      env: { SAFARI_BROWSER_TEST_CHILD_PID_PATH: childPidPath },
    }),
    (error) => {
      const response = JSON.parse(/** @type {{ stdout: string }} */ (error).stdout);
      assert.equal(response.ok, false);
      assert.equal(response.shutdown, true);
      assert.match(response.error, /stopped; retry starts a clean daemon/i);
      return true;
    }
  );

  const pidPath = join(stateRoot, "timeout.pid");
  await waitForMissing(pidPath);
  await waitForMissing(join(stateRoot, "timeout.sock"));
  await waitForProcessExit(Number(await readFile(childPidPath, "utf8")));

  const recovered = JSON.parse(
    (await runCli(["--session", "timeout", "--json", "raw", "safari_echo", "{}"])).stdout
  );
  assert.equal(recovered.ok, true);
  assert.equal(recovered.data.echoCount, 1);
});

test("close --all bypasses a blocked command queue", async () => {
  const childPidPath = join(testRoot, "interrupt-child.pid");
  const pending = runCli(
    ["--session", "interrupt", "--json", "raw", "safari_delay", '{"ms":5000}'],
    {
      env: {
        SAFARI_BROWSER_TEST_CHILD_PID_PATH: childPidPath,
        SAFARI_BROWSER_TOOL_TIMEOUT_MS: "10000",
        SAFARI_BROWSER_SOCKET_TIMEOUT_MS: "11000",
      },
      timeout: 12_000,
    }
  );
  await waitForPresent(join(stateRoot, "interrupt.pid"));
  const startedAt = Date.now();
  const stopped = JSON.parse(
    (await runCli(["--session", "interrupt", "--json", "close", "--all"])).stdout
  );

  assert.equal(stopped.ok, true);
  assert.equal(stopped.data.stopped, true);
  assert.ok(Date.now() - startedAt < 1_500, "out-of-band shutdown should not await the tool");
  await assert.rejects(pending);
  await waitForMissing(join(stateRoot, "interrupt.pid"));
  await waitForProcessExit(Number(await readFile(childPidPath, "utf8")));
});

test("closing an absent session does not start a daemon", async () => {
  const response = JSON.parse(
    (await runCli(["--session", "absent", "--json", "close", "--all"])).stdout
  );
  assert.deepEqual(response, { ok: true, data: { stopped: false } });
  await assert.rejects(readFile(join(stateRoot, "absent.pid"), "utf8"), { code: "ENOENT" });
});

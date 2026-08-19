import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { writeFileSync } from "node:fs";
import { z } from "zod";

if (process.env.SAFARI_BROWSER_TEST_CHILD_PID_PATH) {
  writeFileSync(process.env.SAFARI_BROWSER_TEST_CHILD_PID_PATH, String(process.pid));
}

const server = new McpServer({ name: "safari-browser-cli-fixture", version: "0.0.0" });
let echoCount = 0;

server.tool(
  "safari_echo",
  "Return fixture process identity and a retained call count.",
  { value: z.string().optional() },
  async ({ value }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({ value: value || null, echoCount: ++echoCount, pid: process.pid }),
      },
    ],
  })
);

server.tool(
  "safari_delay",
  "Delay long enough to exercise CLI timeout recovery.",
  { ms: z.coerce.number() },
  async ({ ms }) => {
    await new Promise((resolveWait) => setTimeout(resolveWait, ms));
    return { content: [{ type: "text", text: JSON.stringify({ delayed: ms }) }] };
  }
);

server.tool(
  "safari_screenshot",
  "Return a tiny fixture image.",
  { fullPage: z.boolean().optional() },
  async () => ({
    content: [
      {
        type: "image",
        mimeType: "image/png",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      },
    ],
  })
);

await server.connect(new StdioServerTransport());

#!/usr/bin/env node

import { fileURLToPath } from "node:url";

export function onboardingUsage(command = "safari-mcp --prompt") {
  return `Usage:
  ${command} [--site-name <name>]

Prints a prompt you can pipe into a coding agent inside a website/app repo:
  safari-mcp --prompt --site-name "Acme CRM" | codex
  npx safari-mcp -- --prompt --site-name "Acme CRM" | claude
  safari-mcp-onboard --site-name "Acme CRM" | codex
`;
}

export function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : "";
}

export function buildOnboardingPrompt({ siteName = "this site" } = {}) {
  return `You are working inside the codebase for ${siteName}. Your job is to onboard this site into Safari MCP's site-provided hook workflow.

Start by interviewing the user. Do not implement hooks until you have asked these questions and received answers, unless the answers are already obvious from prior context:

1. Which app behaviors or workflows do you want Safari MCP agents to perform through the app's own state/model layer?
2. Which read-only state should agents be able to inspect without scraping the DOM?
3. Which workflows are allowed to mutate app state, submit forms, save records, send messages, or trigger network requests?
4. Are there sensitive fields, user data, routes, actions, or roles that must never be exposed through hooks?
5. Should these hooks be enabled in every environment, or only in development/staging/internal builds?

Explain the model to the user in plain language before asking for final confirmation:
- The site exposes a small window.__safariMcp object in browser JavaScript.
- Safari MCP can discover it with safari_site action=list.
- Safari MCP can inspect app state with safari_site action=state.
- Safari MCP can call named hooks with safari_site action=call.
- Hooks marked readOnly:true are inspection-only.
- Hooks marked readOnly:false are deliberate workflow hooks and require allowWrite:true from the MCP agent.
- The hooks should call the app's real stores/actions/controllers, not fake DOM clicks.
- Hook inputs and outputs must be compact JSON and must not expose secrets.

After the user answers, write a steering prompt for the implementation. The steering prompt should be specific enough for another coding agent to carry out the work safely. Include:
- The exact behaviors to hook.
- The proposed hook names.
- Which hooks are readOnly:true vs readOnly:false.
- The state/store/router/action APIs to use if discoverable.
- The safety constraints.
- The tests or manual verification steps.

Then implement the integration if the user wants you to proceed.

Goal:
- Expose a small, explicit, JSON-serializable API on window.__safariMcp.
- Prefer app state/model APIs over DOM scraping.
- Keep read-only inspection hooks separate from mutating workflow hooks.
- Make the integration safe in production: no secrets, no arbitrary eval, no broad write surface.

Safari MCP contract to implement:

\`\`\`js
window.__safariMcp = {
  name: "App Name",
  version: "1.0.0",
  description: "Optional short description",

  getState(context) {
    return {
      route: "...",
      userMode: "...",
      selectedIds: [],
      visiblePanel: "...",
      // Return compact domain state useful for automation.
    };
  },

  hooks: {
    inspectSelection: {
      readOnly: true,
      description: "Return selected domain objects",
      inputSchema: {
        type: "object",
        properties: {}
      },
      run(args, context) {
        return {/* JSON-serializable result */};
      }
    },

    applyWorkflow: {
      readOnly: false,
      description: "Run a deliberate app-native workflow",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" }
        },
        required: ["id"]
      },
      run(args, context) {
        // Use real app actions/state model, not synthetic DOM clicks.
        return {/* JSON-serializable result */};
      }
    }
  }
};
\`\`\`

Safari MCP will use:
- safari_site action=list to discover hooks and metadata.
- safari_site action=state to call getState().
- safari_site action=call hook=<name> params=<json> to run hooks.
- Hooks declared readOnly:false require allowWrite:true from the agent and an MCP-owned tab.

Implementation requirements after the interview:
1. Find the app's client entry point or equivalent browser-only initialization path.
2. Install the hook only in the browser. Guard SSR/build environments with typeof window !== "undefined".
3. Reuse existing app state stores, routers, query clients, controllers, or service layers.
4. Return compact plain JSON only. Strip functions, DOM nodes, large blobs, circular references, tokens, cookies, auth headers, and personally sensitive fields unless they are essential and already visible to the user.
5. Include at least three hooks:
   - One read-only state/selection/domain inspection hook.
   - One read-only validation hook that checks whether the current screen is ready for a workflow.
   - One readOnly:false workflow hook that performs a useful app-native action through the state model.
6. Add tests where practical. At minimum, add a small unit test around the hook factory/serializer if this repo has a test setup.
7. Document the available hooks for maintainers near the implementation.

Recommended shape:
- Create a small module such as src/safariMcpHooks.ts or app/safariMcpHooks.ts.
- Export a function installSafariMcpHooks(deps) that receives app-specific stores/actions.
- Call installSafariMcpHooks(...) once after the app state layer is initialized.
- Keep hook definitions declarative and stable. Treat hook names as public API.

Safety rules:
- Do not expose raw database clients, auth/session objects, localStorage dumps, or network clients.
- Do not implement a generic "run code", "dispatch arbitrary action", "set any state", or "fetch any URL" hook.
- Mutating hooks must be narrow, named workflows with input validation.
- Prefer returning IDs, labels, statuses, route names, validation errors, and short summaries.
- If a hook cannot run, return { ok: false, reason: "..." } rather than throwing when possible.

After implementing, provide:
- The file paths changed.
- The list of registered hooks with readOnly flags.
- How to verify in Safari MCP:
  1. Open the app with safari_tabs action=new.
  2. Run safari_site action=list.
  3. Run safari_site action=state.
  4. Run a read-only hook with safari_site action=call.
  5. Run a write hook only with allowWrite:true when appropriate.
`;
}

export function printOnboardingPrompt(argv = process.argv.slice(2), output = process.stdout) {
  const args = new Set(argv);

  if (args.has("--help") || args.has("-h")) {
    output.write(onboardingUsage(args.has("--prompt") ? "safari-mcp --prompt" : "safari-mcp-onboard"));
    return;
  }

  const siteName = valueAfter(argv, "--site-name") || valueAfter(argv, "--app-name") || "this site";
  const prompt = buildOnboardingPrompt({ siteName });
  output.write(prompt);
  if (!prompt.endsWith("\n")) output.write("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  printOnboardingPrompt();
}

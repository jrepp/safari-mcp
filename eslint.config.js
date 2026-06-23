// ESLint flat config. Advisory tooling — `npm run lint` is for local use; CI is not
// gated on it (the codebase predates linting and has a backlog). Rules are tuned to
// surface real bugs (undeclared vars, unreachable code, accidental globals) without
// drowning in style noise — Prettier owns formatting.
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "extension/**",
      "xcode/**",
      "*.swift",
      "safari-helper",
      "index.js",
      "safari.js",
      "mcp-helpers.js",
      "scripts/test-*.js",
      "scripts/postinstall.cjs",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      // `_`-prefixed args/vars are intentional throwaways across this codebase.
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-constant-condition": ["warn", { checkLoops: false }],
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
  },
];

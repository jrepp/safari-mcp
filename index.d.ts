/**
 * Safari MCP — TypeScript type declarations for the compact 19-tool surface.
 */

export type MCPContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

export interface MCPToolInputSchema {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
}

export interface MCPTool<TInput extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
  handler: (input: TInput) => Promise<MCPToolResult>;
}

export interface SafariNavigateInput { url: string }
export interface SafariReadPageInput { selector?: string; maxLength?: number; format?: "text" | "source" }
export interface SafariSnapshotInput { selector?: string }

export interface SafariClickInput {
  ref?: string;
  selector?: string;
  text?: string;
  x?: number;
  y?: number;
  button?: "left" | "right";
  count?: number;
  native?: boolean;
  waitFor?: string;
  wait?: number;
  read?: boolean;
  maxLength?: number;
}

export interface SafariFillInput {
  ref?: string;
  selector?: string;
  value: string;
  native?: boolean;
  verify?: boolean;
}

export interface SafariScreenshotInput { fullPage?: boolean; selector?: string; overlay?: "refs" | "layout" | "hit_test" }
export interface SafariWaitInput { action?: "for" | "time"; selector?: string; text?: string; timeout?: number; ms?: number }
export interface SafariEvaluateInput { script: string }

export interface SafariTabsInput {
  action: "list" | "search" | "new" | "switch" | "close" | "wait_for_new";
  query?: string;
  titleContains?: string;
  activate?: boolean;
  url?: string;
  urlContains?: string;
  index?: number;
  timeout?: number;
}

export interface SafariHistoryInput { action: "back" | "forward" | "reload"; hard?: boolean }

export interface SafariPointerInput {
  action: "hover" | "drag" | "hit_test";
  ref?: string;
  selector?: string;
  text?: string;
  x?: number;
  y?: number;
  native?: boolean;
  dwellMs?: number;
  restoreMouse?: boolean;
  sourceSelector?: string;
  targetSelector?: string;
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
}

export interface SafariKeyboardInput {
  action: "press" | "type" | "replace_editor";
  key?: string;
  modifiers?: string[];
  text?: string;
  selector?: string;
  ref?: string;
  native?: boolean;
}

export interface SafariFormField { selector: string; value: string }
export interface SafariFormInput {
  action: "clear" | "select" | "fill_all" | "submit" | "verify" | "detect" | "react_select_set" | "react_select_options";
  selector?: string;
  ref?: string;
  value?: string;
  expected?: string;
  fields?: SafariFormField[];
  submitSelector?: string;
}

export interface SafariExtractInput {
  kind: "element" | "query" | "style" | "accessibility" | "tables" | "meta" | "images" | "links" | "analyze" | "performance" | "css_coverage" | "layout" | "dom_tree";
  selector?: string;
  ref?: string;
  refs?: string[];
  limit?: number;
  filter?: string;
  properties?: string[];
  maxDepth?: number;
  includeAncestors?: boolean;
  includeChildren?: boolean;
  viewportOnly?: boolean;
  diagnostics?: boolean;
  includeText?: boolean;
  includeStyles?: boolean;
  includeGeometry?: boolean;
  includeHidden?: boolean;
  pierceShadow?: boolean;
}

export interface SafariStorageInput {
  store: "cookies" | "local" | "session" | "indexeddb" | "all";
  action: "get" | "set" | "delete" | "export" | "import" | "list";
  key?: string;
  value?: string;
  name?: string;
  domain?: string;
  path?: string;
  expires?: string;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  all?: boolean;
  state?: string;
  dbName?: string;
  storeName?: string;
  limit?: number;
}

export interface SafariNetworkInput {
  action?: "overview" | "capture_start" | "details" | "clear" | "mock" | "clear_mocks" | "throttle";
  limit?: number;
  filter?: string;
  urlPattern?: string;
  response?: { status?: number; body?: string; contentType?: string };
  profile?: string;
  latency?: number;
  downloadKbps?: number;
  uploadKbps?: number;
}

export interface SafariConsoleInput { action: "start" | "get" | "clear"; level?: "log" | "warn" | "error" | "info" }

export interface SafariBrowserInput {
  action: "scroll" | "scroll_to" | "scroll_to_element" | "dialog" | "resize" | "emulate" | "reset_emulation" | "upload_file" | "paste_image" | "save_pdf" | "clipboard_read" | "clipboard_write" | "geolocation" | "reload_extension" | "observe_layout" | "layout_events" | "clear_layout_events";
  dialogAction?: "accept" | "dismiss";
  direction?: "up" | "down";
  amount?: number;
  x?: number;
  y?: number;
  selector?: string;
  text?: string;
  block?: "start" | "center" | "end" | "nearest";
  timeout?: number;
  width?: number;
  height?: number;
  device?: string;
  userAgent?: string;
  scale?: number;
  filePath?: string;
  path?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  limit?: number;
  detail?: boolean;
}

export interface SafariRunScriptStep { action: string; args?: Record<string, unknown> }
export interface SafariRunScriptInput { steps: SafariRunScriptStep[] }

export interface SafariTab {
  index: number;
  title: string;
  url: string;
}

export interface McpServer {
  connect(transport: unknown): Promise<void>;
  tool(name: string, description: string, schema: unknown, handler: (input: unknown) => Promise<MCPToolResult>): unknown;
  close(): Promise<void>;
}

declare const server: McpServer;
export default server;

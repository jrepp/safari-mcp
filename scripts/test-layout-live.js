#!/usr/bin/env node
/**
 * Live integration test for safari_extract kind=layout against the local fixture.
 *
 * Run:
 *   node scripts/test-layout-live.js
 *   SAFARI_PROFILE='Your Profile' node scripts/test-layout-live.js
 *
 * Requirements:
 * - Safari running with the target profile window open
 * - "Allow JavaScript from Apple Events" enabled
 */

import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureUrl = pathToFileURL(join(__dirname, "fixtures", "layout-cases.html")).href;
const safari = await import("../safari.js");

let failures = 0;

function check(name, got, predicate) {
  let ok = false;
  try { ok = predicate(got); } catch { ok = false; }
  console.log(`  ${ok ? "OK " : "ERR"} ${name}`);
  if (!ok) {
    console.log("     got:", typeof got === "string" ? got : JSON.stringify(got, null, 2));
    failures++;
  }
}

function parseJson(raw) {
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

function findBySelector(result, fragment) {
  return (result.items || []).find((item) => typeof item.selector === "string" && item.selector.includes(fragment));
}

function walkTree(node, predicate) {
  if (!node) return null;
  if (predicate(node)) return node;
  for (const child of node.children || []) {
    const found = walkTree(child, predicate);
    if (found) return found;
  }
  return null;
}

async function main() {
  console.log("— safari_extract kind=layout live test —\n");
  console.log(process.env.SAFARI_PROFILE
    ? `Using Safari profile: ${process.env.SAFARI_PROFILE}`
    : "Using Safari front window (set SAFARI_PROFILE to target a specific profile window)");
  const before = JSON.parse(await safari.listTabs());
  await safari.newTab(fixtureUrl);
  await safari.waitFor({ selector: ".covered-button", timeout: 5000 });

  const snapshot = await safari.takeSnapshot();
  const snapshotRefs = snapshot.split("\n")
    .map((line) => {
      const match = line.match(/ref=([^\s]+)/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  check("snapshot produced refs", snapshotRefs, (refs) => refs.length >= 5);

  const selectorLayout = parseJson(await safari.extractLayout({ selector: ".covered-button" }));
  const covered = findBySelector(selectorLayout, ".covered-button");
  check("selector mode finds covered button", covered, (item) => !!item);
  check("covered button labeled covered-at-center", covered, (item) => item.issues.includes("covered-at-center"));
  check("covered button has topmostAtCenter", covered, (item) => item.topmostAtCenter && item.topmostAtCenter.tag === "DIV");

  const coveredHit = parseJson(await safari.hitTest({ ref: covered.ref }));
  check("hit_test ref returns stack", coveredHit, (result) => Array.isArray(result.stack) && result.stack.length >= 1);
  check("hit_test ref reports intended topmost state", coveredHit, (result) => result.intended && result.intended.ref === covered.ref && result.intended.topmostAtCenter === false);
  check("hit_test coordinate returns same top element", parseJson(await safari.hitTest(coveredHit.point)), (result) => Array.isArray(result.stack) && result.stack[0] && result.stack[0].tag === coveredHit.stack[0].tag);

  const hiddenLayout = parseJson(await safari.extractLayout({ selector: ".display-none", viewportOnly: false }));
  const hidden = findBySelector(hiddenLayout, ".display-none");
  check("display:none element reported", hidden, (item) => !!item);
  check("display:none label present", hidden, (item) => item.issues.includes("display-none"));

  const offscreenLayout = parseJson(await safari.extractLayout({ selector: ".offscreen-link", viewportOnly: false }));
  const offscreen = findBySelector(offscreenLayout, ".offscreen-link");
  check("offscreen element reported", offscreen, (item) => !!item);
  check("offscreen label present", offscreen, (item) => item.issues.includes("offscreen"));

  const refsLayout = parseJson(await safari.extractLayout({ refs: snapshotRefs.slice(0, 3), includeAncestors: true }));
  check("refs mode returns bounded items", refsLayout, (result) => result.items.length >= 1 && result.items.length <= 3);
  check("refs mode can include ancestors", refsLayout, (result) => result.items.some((item) => Array.isArray(item.ancestors)));

  const refLayout = parseJson(await safari.extractLayout({ ref: snapshotRefs[0], includeChildren: true }));
  check("single ref mode returns one item", refLayout, (result) => result.items.length === 1);
  check("single ref mode can include children", refLayout, (result) => Array.isArray(result.items[0].children));

  const omittedLayoutRaw = await safari.extractLayout({});
  const omittedLayout = parseJson(omittedLayoutRaw);
  check("omitted target mode returns items", omittedLayout, (result) => result.items.length >= 1);
  check("default response stays under 12KB", omittedLayoutRaw, (raw) => raw.length < 12000);

  const domTree = parseJson(await safari.extractDomTree({ selector: "main", maxDepth: 5, limit: 120 }));
  check("dom_tree returns bounded root", domTree, (result) => result.root && result.root.tag === "MAIN" && result.counts.nodes <= 120);
  check("dom_tree includes click-compatible refs", domTree, (result) => !!walkTree(result.root, (node) => node.tag === "BUTTON" && typeof node.ref === "string"));
  check("dom_tree pierces open shadow root", domTree, (result) => !!walkTree(result.root, (node) => node.selector === "div#shadow-host" && node.shadowRoot === "open") && !!walkTree(result.root, (node) => node.selector === "button.shadow-action"));
  check("dom_tree marks iframe boundary", domTree, (result) => !!walkTree(result.root, (node) => node.tag === "IFRAME" && node.iframe === "same-origin"));

  const observeStart = parseJson(await safari.observeLayout({ selector: "main" }));
  check("observe_layout starts", observeStart, (result) => result.observing === true && result.selector === "main");
  await safari.evaluate({ script: "const el=document.createElement('div');el.className='observer-added';el.textContent='Observer added';document.querySelector('main').appendChild(el);document.querySelector('.covered-button').classList.toggle('observer-toggled');" });
  await safari.waitForTime({ ms: 100 });
  const layoutEvents = parseJson(await safari.getLayoutEvents({ limit: 50 }));
  check("layout_events summarizes mutations", layoutEvents, (result) => result.observing === true && result.summary.some((event) => event.type === "mutation" && (event.added > 0 || event.attribute)));
  const clearedEvents = parseJson(await safari.clearLayoutEvents());
  check("clear_layout_events clears observer", clearedEvents, (result) => result.observing === false && result.eventCount === 0);

  await safari.scrollToElement({ selector: ".animated-canvas", block: "center" });
  await safari.waitForTime({ ms: 100 });
  const canvasDiagnostics = parseJson(await safari.extractCanvas({ selector: ".animated-canvas", sampleFrames: 2, sampleDelayMs: 300 }));
  const animatedCanvas = canvasDiagnostics.canvases && canvasDiagnostics.canvases[0];
  check("canvas diagnostics finds canvas", animatedCanvas, (item) => item && item.context === "2d" && item.visible === true);
  check("canvas diagnostics detects nonblank canvas", animatedCanvas, (item) => item.blank === false && !item.issues.includes("blank"));
  check("canvas diagnostics detects animation", animatedCanvas, (item) => item.changing === true);

  const sceneHealth = parseJson(await safari.extractVisual({ selector: ".animated-canvas", mode: "scene_health", sampleFrames: 2, sampleDelayMs: 300 }));
  check("visual scene_health summarizes rendering", sceneHealth, (result) => result.summary && result.summary.renderingCanvasCount === 1 && result.summary.blankCanvasCount === 0);
  check("visual scene_health returns recommendations", sceneHealth, (result) => Array.isArray(result.recommendations) && result.recommendations.length >= 1);
  const pixelStats = parseJson(await safari.extractVisual({ selector: ".animated-canvas", mode: "pixel_stats", sampleFrames: 2, sampleDelayMs: 300 }));
  check("visual pixel_stats includes samples", pixelStats, (result) => result.canvases && result.canvases[0] && Array.isArray(result.canvases[0].pixels));

  await safari.closeTab();
  const after = JSON.parse(await safari.listTabs());
  check("user tabs untouched", after.length, (count) => count === before.length);

  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} CHECKS FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("TEST ERROR:", err);
  process.exit(1);
});

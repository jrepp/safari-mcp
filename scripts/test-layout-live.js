#!/usr/bin/env node
/**
 * Live integration test for safari_extract kind=layout against the local fixture.
 *
 * Run:
 *   SAFARI_PROFILE='Your Profile' node scripts/test-layout-live.js
 *
 * Requirements:
 * - Safari running with the target profile window open
 * - "Allow JavaScript from Apple Events" enabled
 */

import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.SAFARI_PROFILE = process.env.SAFARI_PROFILE || "אוטומציות";

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

async function main() {
  console.log("— safari_extract kind=layout live test —\n");
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

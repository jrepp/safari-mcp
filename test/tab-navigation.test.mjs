import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldWaitForNewTabNavigation } from "../tab-navigation.js";

test("new blank tabs do not wait for a URL transition that cannot happen", () => {
  assert.equal(shouldWaitForNewTabNavigation(""), false);
  assert.equal(shouldWaitForNewTabNavigation("about:blank"), false);
});

test("new tabs with navigable URLs wait for their document", () => {
  assert.equal(shouldWaitForNewTabNavigation("https://example.com"), true);
  assert.equal(shouldWaitForNewTabNavigation("data:text/html,ready"), true);
});

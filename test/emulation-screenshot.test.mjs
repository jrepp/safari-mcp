#!/usr/bin/env node

import assert from "node:assert/strict";
import { test } from "node:test";
import { assessEmulationObservation, screenCaptureCliError } from "../safari.js";

test("emulation rejects an outer-window-only resize", () => {
  const assessment = assessEmulationObservation(
    { width: 390, height: 844, userAgent: "Mobile Safari" },
    {
      outerWidth: 390,
      innerWidth: 1440,
      innerHeight: 810,
      userAgent: "Desktop Safari",
    }
  );

  assert.equal(assessment.ok, false);
  assert.match(assessment.problems.join("\n"), /effective viewport width/i);
  assert.match(assessment.problems.join("\n"), /user agent/i);
});

test("emulation accepts observed effective viewport state", () => {
  const assessment = assessEmulationObservation(
    { width: 390, height: 844, userAgent: "Mobile Safari" },
    {
      outerWidth: 390,
      innerWidth: 390,
      innerHeight: 844,
      userAgent: "Mobile Safari",
    }
  );

  assert.deepEqual(assessment, { ok: true, problems: [] });
});

test("emulation rejects missing observed viewport state", () => {
  const assessment = assessEmulationObservation({ width: 390, height: 844, userAgent: "" }, {});

  assert.equal(assessment.ok, false);
  assert.equal(assessment.problems.length, 2);
});

test("screen capture permission sentinel is recognized on stdout", () => {
  const error = screenCaptureCliError({
    message: "Command failed",
    stdout: "__SCREENSHOT_PERMISSION_DENIED__\n",
    stderr: "",
    code: 3,
  });

  assert.match(error.message, /Screen Recording permission denied for safari-helper/);
  assert.match(error.message, /enable safari-helper/);
});

test("screen capture preserves actionable non-permission helper failures", () => {
  const error = screenCaptureCliError({
    message: "Command failed",
    stdout: '{"error":"window 42 not found"}\n',
    stderr: "",
    code: 1,
  });

  assert.match(error.message, /window 42 not found/);
  assert.doesNotMatch(error.message, /permission denied/i);
});

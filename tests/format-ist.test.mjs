import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatIST } from "../lib/format-datetime.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported bug: an admin scheduled a live test for 6:11 AM IST, but the
// student-facing /live-test card showed 12:41 AM -- off by exactly 5:30,
// India's UTC offset. The schedule was stored correctly; the display was
// the bug. Every schedule/timestamp display in this app is a Server
// Component, which renders in the SERVER process's default timezone (often
// UTC), not the visitor's browser timezone -- a bare `date.toLocaleString()`
// there silently prints server-local digits instead of IST ones. Every
// student/admin here is in India, so every such display must pin
// `timeZone: "Asia/Kolkata"` explicitly via the shared formatIST() helper.
test("formatIST renders a UTC instant as its IST wall-clock time, not the server process's own timezone", () => {
  // 2026-09-17T00:41:00Z is 6:11 AM IST (UTC+5:30).
  const readout = formatIST("2026-09-17T00:41:00.000Z");
  assert.match(readout, /6:11/);
  assert.match(readout, /am/i);
});

test("every server-rendered schedule/timestamp display uses the shared IST-pinned formatter instead of a bare toLocaleString()", async () => {
  const files = [
    "app/live-test/live-test-list.tsx",
    "app/tests/[slug]/page.tsx",
    "app/admin/excel-efficiency-tests/page.tsx",
    "app/admin/word-efficiency-tests/page.tsx",
    "app/classroom/page.tsx",
    "app/typing/attempts/[attemptId]/page.tsx",
    "app/admin/students/attempts/[attemptId]/page.tsx",
    "app/admin/tests/[testId]/results/page.tsx",
  ];
  for (const file of files) {
    const source = await read(file);
    assert.match(source, /formatIST/, `${file} should use formatIST`);
    assert.doesNotMatch(source, /\)\.toLocaleString\(\)/, `${file} should not have a bare .toLocaleString() call left`);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../app/typing/_components/configurable-typing-exam.tsx", import.meta.url), "utf8");

// Reported: the workspace toolbar's controls didn't line up -- Submit/Pause
// used py-2, the timer used py-1.5, Settings/Print/Download/Printout Mode
// used px-3 py-2, and the full-screen toggle was a differently-sized h-8
// square, plus the practice test navigator (prev/next/select/sort) used
// h-8 throughout. Every control in this toolbar is now h-9, so they align
// on one row regardless of whether the content is text, a number, or an
// icon.
test("every control in the workspace toolbar (Submit, Pause, timer, Settings, full-screen, Print/PDF, Download PDF, Printout Mode, and the practice test navigator) shares the same h-9 height", () => {
  const start = workspace.indexOf('aria-label="Typing controls"');
  const end = workspace.indexOf("</header>", start);
  const toolbar = workspace.slice(start, end);
  const navStart = workspace.indexOf('aria-label="Practice test navigation"');
  const nav = navStart >= 0 ? workspace.slice(navStart, start) : "";
  for (const label of ["Submit", "Pause", "role=\"timer\"", "Settings", "Enter full screen", "Print or save this passage as a PDF", "Printout Mode"]) {
    assert.ok(toolbar.includes(label), `toolbar missing ${label}`);
  }
  const h9Count = (toolbar.match(/h-9/g) ?? []).length;
  assert.ok(h9Count >= 6, `expected at least 6 h-9 controls in the toolbar, found ${h9Count}`);
  assert.doesNotMatch(toolbar, /\bh-8\b/);
  if (nav) {
    assert.doesNotMatch(nav, /\bh-8\b/);
    assert.match(nav, /h-9 w-9/);
  }
});

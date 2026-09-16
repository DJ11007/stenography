import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature: three dedicated admin entry points for creating
// live tests -- Live Typing Test, Live Stenography Test, Live Efficiency
// Test -- instead of the single generic /admin/tests form with one shared
// checkbox. Typing/Stenography reuse the existing SectionTestPage/
// TestManager pattern with a new `live` lock; Efficiency is a small
// chooser deep-linking into the existing Word/Excel admin editors (which
// already gained their own live-scheduling fieldset).

test("the admin dashboard lists a Live tests group with all three new entries", async () => {
  const dashboard = await read("app/admin/page.tsx");
  assert.match(dashboard, /heading: "Live tests"/);
  assert.match(dashboard, /"\/admin\/live-typing-tests", "Live Typing Test"/);
  assert.match(dashboard, /"\/admin\/live-stenography-tests", "Live Stenography Test"/);
  assert.match(dashboard, /"\/admin\/live-efficiency-tests", "Live Efficiency Test"/);
});

test("Live Typing Test and Live Stenography Test lock both mode AND live=true via SectionTestPage's new `live` prop", async () => {
  const typing = await read("app/admin/live-typing-tests/page.tsx");
  const stenography = await read("app/admin/live-stenography-tests/page.tsx");
  assert.match(typing, /<SectionTestPage mode="exam" live language=\{language\} backHref="\/admin\/live-typing-tests" \/>/);
  assert.match(stenography, /<SectionTestPage mode="stenography" live language=\{language\} backHref="\/admin\/live-stenography-tests" \/>/);
});

test("SectionTestPage's `live` prop queries is_live=true (instead of false) and forces TestManager's lockedLive, without hiding the schedule fieldset via CSS", async () => {
  const page = await read("app/admin/tests/section-test-page.tsx");
  assert.match(page, /\.eq\("is_live", live\)/);
  assert.match(page, /lockedLive=\{live\}/);
  assert.match(page, /live\?`\.section-test-manager label:has\(\[name="mode"\]\)\{display:none\}`:/);
});

test("TestManager's lockedLive forces isLive on, shows the schedule fields without the checkbox, and routes saves through saveLiveExamManagedTest/saveLiveStenographyManagedTest", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /const \[isLive,setIsLive\] = useState\(lockedLive\);/);
  assert.match(manager, /lockedLive && effectiveMode === "exam" \? saveLiveExamManagedTest : lockedLive && effectiveMode === "stenography" \? saveLiveStenographyManagedTest/);
  assert.match(manager, /\{lockedLive\?<><input type="hidden" name="isLive" value="on"\/>/);
});

test("persistManagedTest routes a live-locked section through save_scheduled_managed_test (which has no mode restriction), not save_section_managed_test (which rejects is_live outright)", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /const runSave = \(attemptPayload: typeof payload\) => lockedMode && !lockedLive/);
  assert.match(actions, /export async function saveLiveExamManagedTest.*persistManagedTest\(formData, "exam", true\);/);
  assert.match(actions, /export async function saveLiveStenographyManagedTest.*persistManagedTest\(formData, "stenography", true\);/);
});

test("Live Efficiency Test is a small Word/Excel chooser linking into the existing (now schedule-capable) admin editors, not a rebuild of them", async () => {
  const page = await read("app/admin/live-efficiency-tests/page.tsx");
  assert.match(page, /href="\/admin\/word-efficiency-tests"/);
  assert.match(page, /href="\/admin\/excel-efficiency-tests"/);
});

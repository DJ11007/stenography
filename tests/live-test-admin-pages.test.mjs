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
  assert.match(manager, /\{lockedLive\?<input type="hidden" name="isLive" value="on"\/>:/);
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

// Real reported bug: a datetime-local input's native picker rendered as a
// 24-hour clock with no AM/PM indicator at all on the admin's browser --
// nothing in the field told them a PM time needs 12 added to the hour, so
// "1:11 PM" typed as "01:11" silently became 1:11 AM with no warning, and
// a real scheduled live test went out with a start time in the middle of
// the night by accident. Since a native datetime-local picker's own
// rendering isn't ours to control, each of the three schedule fields now
// pairs with an always-visible, unambiguous 12-hour-with-AM/PM readout
// computed from the exact value just typed, so a wrong AM/PM (or day) is
// obvious before saving.
test("each live-schedule field (Starts/Ends/Publish results) shows an always-visible 12-hour AM/PM readout of its own current value", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /hour12:true/);
  assert.match(manager, /\{startsAt&&<p className="mt-1 text-xs font-black text-blue-900">= \{scheduleReadout\(startsAt\)\}<\/p>\}/);
  assert.match(manager, /\{endsAt&&<p className="mt-1 text-xs font-black text-blue-900">= \{scheduleReadout\(endsAt\)\}<\/p>\}/);
  assert.match(manager, /\{resultsPublishAt&&<p className="mt-1 text-xs font-black text-blue-900">= \{scheduleReadout\(resultsPublishAt\)\}<\/p>\}/);
});

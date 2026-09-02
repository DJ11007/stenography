import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeManagedTestRules } from "../lib/admin-tests.ts";
import { DEFAULT_PLATFORM_PREFERENCES, managedTestSettingsLocks, resolveAttemptSettings } from "../lib/typing-platform-settings.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const forgedPractice = { title:"Practice Test",description:"",slug:"practice-test",language:"English",inputSystemId:"english-qwerty",mode:"practice",durationSeconds:600,passage:"A sufficiently long practice passage for server validation.",requiredWpm:30,requiredAccuracy:90,backspaceMode:"disabled",wordMethod:"spaces",highlightMode:"none",visibility:"public",isLive:false };

test("normal practice tests always return zero locked settings", () => {
  assert.deepEqual(managedTestSettingsLocks("practice", false), {});
  assert.deepEqual(Object.keys(managedTestSettingsLocks("practice", false)), []);
});

test("exam and live tests retain administrator settings locks", () => {
  for (const locks of [managedTestSettingsLocks("exam", false), managedTestSettingsLocks("practice", true)]) {
    assert.equal(locks.duration, true);
    assert.equal(locks.highlightMode, true);
    assert.equal(locks.backspaceMode, true);
    assert.equal(locks.wordMethod, true);
  }
});

test("stale or forged normal-practice settings are neutralized server-side", () => {
  const normalized = normalizeManagedTestRules(forgedPractice);
  assert.equal(normalized.backspaceMode, "full");
  assert.equal(normalized.wordMethod, "characters");
  assert.equal(normalized.highlightMode, "character");
  const live = normalizeManagedTestRules({...forgedPractice,isLive:true});
  assert.equal(live.backspaceMode, "disabled");
  assert.equal(live.wordMethod, "spaces");
  assert.equal(live.highlightMode, "none");
});

test("practice runtime resolves student preferences instead of version defaults", () => {
  const preferences = {...DEFAULT_PLATFORM_PREFERENCES,backspaceMode:"disabled",wordMethod:"spaces",highlightMode:"none",autoScroll:false};
  const resolved = resolveAttemptSettings(preferences,{backspaceMode:"full",wordMethod:"characters"},"custom");
  assert.equal(resolved.backspaceMode,"disabled");
  assert.equal(resolved.wordMethod,"spaces");
  assert.equal(resolved.highlightMode,"none");
  assert.equal(resolved.autoScroll,false);
});

test("Practice and Exam admin forms hide rule controls while Live mode reveals them", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager,/const showAdminRules = \(formMode !== "practice" && formMode !== "exam"\) \|\| isLive;/);
  assert.match(manager,/Practice settings are controlled by the student\./);
  assert.match(manager,/showAdminRules \? <>/);
  assert.match(manager,/name="isLive" checked=\{isLive\}/);
  assert.match(manager,/effectiveMode&&<input type="hidden" name="mode" value=\{effectiveMode\}/);
});

test("practice workspace controls stay enabled and preferences survive selector navigation", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  const settings = await read("app/typing/_components/universal-typing-settings.tsx");
  assert.match(workspace,/managedTestSettingsLocks\(managedTest\?\.mode, managedTest\?\.isLive\)/);
  assert.match(workspace,/managedTest \? \(managedRulesLocked \? "official" : "custom"\)/);
  assert.match(workspace,/updatePreferences\(attemptVariant === "custom"/);
  assert.match(workspace,/updatePreferences\(\{ showScrollbar: value \}\)/);
  assert.match(workspace,/setShowScrollbar\(preferences\.showScrollbar\)/);
  assert.match(workspace,/window\.location\.href=href/);
  assert.doesNotMatch(workspace,/Administrator-enforced test rules override personal preferences/);
  for (const option of ["FontSizeControls","Highlight","Backspace","Word calculation","Auto Scroll","Show Scrollbar"]) assert.match(settings,new RegExp(option));
});

test("database insert guard neutralizes only new non-live practice versions", async () => {
  const migration = await read("supabase/migrations/202608230006_practice_student_settings.sql");
  assert.match(migration,/new\.mode = 'practice'/);
  assert.match(migration,/not coalesce\(\(new\.configuration->>'is_live'\)::boolean, false\)/);
  assert.match(migration,/'settings_locks', '\{\}'::jsonb/);
  assert.match(migration,/before insert on public\.test_versions/);
  assert.doesNotMatch(migration,/update public\.test_versions/);
});

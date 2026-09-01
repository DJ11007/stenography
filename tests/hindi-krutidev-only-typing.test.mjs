import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the Learn Typing journey page no longer offers Mangal/InScript/Remington GAIL/CBI for Hindi -- Kruti Dev is the only Hindi path shown", async () => {
  const page = await read("app/typing/learn/page.tsx");
  assert.doesNotMatch(page, /Mangal Unicode/);
  assert.doesNotMatch(page, /Remington GAIL/);
  assert.doesNotMatch(page, /InScript/);
  assert.doesNotMatch(page, /Remington CBI/);
  assert.doesNotMatch(page, /const unicode: Choice\[\]/);
  assert.match(page, /const kruti: Choice\[\]/);
  assert.match(page, /title="Kruti Dev & DevLys"/);
});

test("the admin Practice Tests page skips the Hindi keyboard picker entirely and goes straight to Kruti Dev, since it's the only option now", async () => {
  const page = await read("app/admin/practice-tests/page.tsx");
  assert.match(page, /import \{ HINDI_KRUTI_DEV \} from "@\/lib\/typing-curriculum";/);
  assert.doesNotMatch(page, /if \(language === "Hindi" && !params\.input\)/);
  assert.match(page, /const inputSystemId = language === "Hindi" \? HINDI_KRUTI_DEV\.id : "english-qwerty";/);
});

test("the \"My Matters\" upload modal restricts Hindi input-system choices to Kruti Dev when Mode is learn/practice, and resets an out-of-range selection when switching into one of those modes", async () => {
  const modal = await read("app/typing/_components/upload-matter-modal.tsx");
  assert.doesNotMatch(modal, /^import \{ HINDI_INPUT_SYSTEMS[,}]/m);
  assert.match(modal, /\{hindiInputSystemsFor\(mode\)\.map\(system=><option/);
  assert.match(modal, /const changeMode = \(next: MatterMode\) => \{ setMode\(next\); if \(language === "Hindi"\) \{ const allowed = hindiInputSystemsFor\(next\); if \(!allowed\.some\(\(system\) => system\.id === inputSystemId\)\) setInputSystemId\(allowed\[0\]\.id\); \} \};/);
  assert.match(modal, /onChange=\{\(e\)=>changeMode\(e\.target\.value as MatterMode\)\}/);
});

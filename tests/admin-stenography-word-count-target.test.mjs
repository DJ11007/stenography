import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Researched convention (SSC-style stenography skill tests): dictated
// matter's word count is speed x duration -- 100 WPM for 10 minutes is
// dictated as ~1000 words, 80 WPM for 10 minutes as ~800. An admin pasting
// matter for a stenography test had no way to tell whether it was properly
// sized for the dictation speed/duration they configured until testing it
// live. A live hint now compares the passage's own word count against
// that target, only for stenography (the one mode with a fixed-speed
// dictation), without turning the Required WPM / Duration fields from
// uncontrolled inputs into controlled ones.
test("the admin passage editor shows a live stenography word-count target (WPM x duration) alongside the actual word count, without disturbing the existing Required WPM/Duration fields", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /const \[wpmHint,setWpmHint\] = useState\(30\);/);
  assert.match(manager, /const \[durationHint,setDurationHint\] = useState\(10\);/);
  assert.match(manager, /const targetWords = Math\.round\(wpmHint \* durationHint\);/);
  assert.match(manager, /const actualWords = countPassageWords\(passage\);/);
  assert.match(manager, /name="durationMinutes".* onChange=\{\(event\)=>setDurationHint\(Number\(event\.target\.value\)\|\|0\)\}/);
  assert.match(manager, /name="requiredWpm".* onChange=\{\(event\)=>setWpmHint\(Number\(event\.target\.value\)\|\|0\)\}/);
  assert.match(manager, /\{formMode==="stenography"&&targetWords>0&&<p/);
  assert.match(manager, /Target for a \{wpmHint\} WPM &times; \{durationHint\} min dictation:/);
  // choose() (switching which test is being edited) must reset the hint
  // state too, or it would keep showing the previously-edited test's
  // target after selecting a different one.
  assert.match(manager, /setWpmHint\(test\?\.currentVersion\?\.required_wpm \?\? 30\);/);
  assert.match(manager, /setDurationHint\(\(test\?\.currentVersion\?\.duration_seconds \?\? 600\) \/ 60\);/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { liveSecondsLeft, PATTERN_TYPING_CATEGORY, sectionInstructions, formatDuration } from "../lib/live-exam.ts";

// Live Exam Center step 3b: a typing part runs inside the exam page — its test is only handed over once the part has
// started, the typing clock ends with the part (server clock), the RSMSSB scheme marks it, and the attempt is saved
// with the part without using up a free attempt.
const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

test("the typing clock ends with the part on the server clock, never longer than the test itself", () => {
  const now = Date.now();
  assert.equal(liveSecondsLeft(now + 90_000, 0, 600), 90, "a late joiner gets only the time left");
  assert.equal(liveSecondsLeft(now + 900_000, 0, 600), 600, "never more than the test's own duration");
  assert.equal(liveSecondsLeft(now + 90_000, 30_000, 600), 60, "a PC clock 30 s behind the server is corrected");
  assert.equal(liveSecondsLeft(now - 5_000, 0, 600), 1);
});

test("RSMSSB LDC typing parts use the Rajasthan LDC rules and marks", () => {
  assert.equal(PATTERN_TYPING_CATEGORY["rsmssb-ldc"], "rajasthan-ldc");
});

test("instructions are written from the exam's own parts and breaks", () => {
  assert.deepEqual(sectionInstructions([{ label: "Hindi Typing", durationSeconds: 600, gapAfterSeconds: 120 }, { label: "English Typing", durationSeconds: 600, gapAfterSeconds: 0 }]), [
    "The exam has 2 parts in this order: Hindi Typing (10 minutes), English Typing (10 minutes).",
    "There is a 2-minute break after Hindi Typing. The next part starts by itself when the break timer reaches 00:00.",
  ]);
  assert.deepEqual([30, 60, 90, 600].map(formatDuration), ["30 seconds", "1 minute", "1.5 minutes", "10 minutes"]);
});

test("the part's test is loaded only between its start and end, and a moment-early PC asks again", async () => {
  const actions = await read("app/live-exam/actions.ts");
  assert.match(actions, /if \(!slot \|\| now < Date\.parse\(slot\.starts_at\)\) return \{ ok: false, error: "This part has not started yet\." \};/);
  assert.match(actions, /if \(now >= Date\.parse\(slot\.ends_at\)\) return \{ ok: false, error: "This part is over\." \};/);
  assert.match(actions, /managedVersionToPreset\(version, PATTERN_TYPING_CATEGORY\[pattern\]\)/);
  const room = await read("app/live-exam/[examId]/live-exam-room.tsx");
  assert.match(room, /if \(\/not started yet\/i\.test\(result\.error\) && tries\+\+ < 12\) \{ retry = window\.setTimeout\(load, 1500\); return; \}/);
  assert.match(room, /managedTest=\{preview \? undefined : loaded\.managedTest\} adminPreview=\{preview\}/, "an admin preview saves nothing");
});

test("the typing screen in exam mode: starts with the part, no back arrow, saves with the part, no result screen", async () => {
  const exam = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(exam, /const \[started, setStarted\] = useState\(directWorkspace \|\| Boolean\(liveExam\)\);/);
  assert.match(exam, /useEffect\(\(\) => \{ if \(!liveExam\) return; const timer = window\.setTimeout\(beginTiming, 0\);/);
  assert.match(exam, /<ExamWorkspace hideBack=\{Boolean\(liveExam\)\} /);
  assert.match(exam, /liveExamSectionId:liveExam\?\.sectionId\}\}\)\.then\(result=>\{applySaveResult\(result\);liveExam\?\.onSaved\(result\);\}\);/);
  assert.match(exam, /if \(finished && liveExam\) return <main/);
});

test("a section attempt is checked against an open section of this test, skips the free limit, and is linked", async () => {
  const actions = await read("app/tests/actions.ts");
  assert.match(actions, /if \(!section \|\| section\.kind !== "typing" \|\| section\.test_id !== testId\) return null;/);
  assert.match(actions, /now >= Date\.parse\(slot\.starts_at\) && now <= Date\.parse\(slot\.ends_at\) \+ 120000 \? section\.id : null/);
  assert.match(actions, /if \(payload\.liveExamSectionId && !liveSection\) return \{ status: "closed" as const \};/);
  assert.match(actions, /supabase\.rpc\("record_live_exam_section", \{ p_section_id: liveSection, p_attempt_id: saved\.id \}\)/);
});

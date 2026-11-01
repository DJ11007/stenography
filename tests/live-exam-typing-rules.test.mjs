import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { managedVersionToPreset } from "../lib/admin-tests.ts";
import { PATTERN_TYPING_CATEGORY } from "../lib/live-exam.ts";
import { getExamPreset } from "../lib/typing-curriculum.ts";

// Real report from the first RSMSSB LDC live exam (2026-11-01): the typing part showed character highlight and auto
// scroll, although the Rajasthan LDC rules are no highlight, one-word backspace and auto scroll off. A live exam part
// opens straight into the typing screen, which skipped the step that applies the test's rules to the screen.
const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const version = (language) => ({ id: "v", testId: "t", versionNumber: 1, title: "CHAPTER-50", description: "", slug: "chapter-50", language, inputSystemId: language === "Hindi" ? "hindi-krutidev-010" : "english-qwerty", mode: "exam", durationSeconds: 600, passage: "a b c", requiredWpm: 30, requiredAccuracy: 90, backspaceMode: "full", wordMethod: "characters", highlightMode: "character", visibility: "public", audioPath: null, examCategory: null });

test("an RSMSSB LDC exam part gets the Rajasthan LDC rules, whatever the test itself was saved with", () => {
  for (const [language, perWord] of [["Hindi", 0.0625], ["English", 0.05]]) {
    const preset = managedVersionToPreset(version(language), PATTERN_TYPING_CATEGORY["rsmssb-ldc"]);
    assert.equal(preset.highlightMode, "none", `${language}: no highlight`);
    assert.equal(preset.backspaceMode, "word", `${language}: one-word backspace`);
    assert.equal(preset.autoScroll, false, `${language}: auto scroll off`);
    assert.equal(preset.marksMethod?.marksPerCorrectWord, perWord, `${language}: marks per correct word`);
    assert.equal(preset.marksMethod?.maximumMarks, 25);
  }
  // The Exam Simulator's own Rajasthan LDC presets carry the same rule.
  for (const language of ["hindi", "english"]) assert.equal(getExamPreset(`exam-cat-rajasthan-ldc-${language}`)?.autoScroll, false);
});

test("the exam screen starts with those rules and locks them (highlight, backspace, word count, auto scroll)", async () => {
  const exam = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(exam, /const isLiveTest = Boolean\(managedTest\?\.isLive\) \|\| Boolean\(liveExam\);/);
  assert.match(exam, /useState<TypingSettings>\(\(\) => \(liveExam && preset\.highlightMode \? \{ \.\.\.officialSettings, highlightMode: preset\.highlightMode as TypingSettings\["highlightMode"\] \} : officialSettings\)\)/);
  assert.match(exam, /useState\(\(\) => \(liveExam && preset\.autoScroll !== undefined \? preset\.autoScroll : true\)\)/);
  assert.match(exam, /const scrollLocked = rulesLocked && preset\.autoScroll !== undefined && !manualUnlock;/);
  assert.match(exam, /const changeScroll = \(value: boolean\) => \{ if \(scrollLocked\) return;/);
  assert.match(await read("app/typing/_components/universal-typing-settings.tsx"), /label="Auto Scroll" value=\{autoScroll \? "auto" : "manual"\} disabled=\{scrollLocked\}/);
});

test("the exam runs full screen from the Login click, with a button to return to it", async () => {
  const room = await read("app/live-exam/[examId]/live-exam-room.tsx");
  assert.match(room, /event\.preventDefault\(\);\n\s+enterFullScreen\(\);/);
  assert.match(room, /\{!fullScreen && phase\.kind !== "finished" && <button type="button" onClick=\{enterFullScreen\}/);
});

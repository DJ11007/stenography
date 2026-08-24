import test from "node:test";
import assert from "node:assert/strict";
import { ENGLISH_LESSONS, EXAM_PRESETS, getExamPreset, getLesson, isLessonUnlocked } from "../lib/typing-curriculum.ts";

test("hard-coded English lessons have been removed in favor of admin-managed learning tests", () => {
  assert.deepEqual(ENGLISH_LESSONS, []);
  assert.equal(getLesson("home-row"), undefined);
});

test("every lesson has configurable accuracy and both learning modes", () => {
  for (const lesson of ENGLISH_LESSONS) {
    assert.ok(lesson.unlockAccuracy >= 1 && lesson.unlockAccuracy <= 100);
    assert.ok(lesson.content.length > 0);
    assert.ok(lesson.timedContent.length > 0);
    assert.equal(getLesson(lesson.id)?.id, lesson.id);
  }
});

test("typing catalogue exposes independent English and Hindi presets", () => {
  assert.deepEqual(EXAM_PRESETS.filter((preset) => preset.category === "typing").map((preset) => preset.language), ["English", "Hindi"]);
  assert.deepEqual(EXAM_PRESETS.filter((preset) => preset.category === "stenography").map((preset) => preset.language), ["English", "Hindi"]);
  for (const preset of EXAM_PRESETS) {
    assert.ok(preset.durationSeconds > 0);
    assert.ok(preset.speedRequirement > 0);
    assert.ok(preset.accuracyRequirement > 0);
    assert.ok(preset.passage.length > 0);
    assert.match(preset.subtitle, /independent.*practice simulation/i);
    assert.equal(getExamPreset(preset.slug)?.id, preset.id);
    assert.ok(preset.script && preset.inputEncoding && preset.fontStack && preset.keyboardLayout);
    assert.ok(preset.inputSystems.length > 0);
  }
  assert.notEqual(getExamPreset("english-stenography")?.passage, getExamPreset("hindi-stenography")?.passage);
});

test("lesson unlocks cannot be bypassed by a direct lesson id", () => {
  const lessons = [{ id: "first" }, { id: "second" }];
  assert.equal(isLessonUnlocked("first", {}, lessons), true);
  assert.equal(isLessonUnlocked("second", {}, lessons), false);
  assert.equal(isLessonUnlocked("second", { first: { lessonId: "first", completed: true, bestAccuracy: 95, bestWpm: 20, attempts: 1, weakKeys: [] } }, lessons), true);
  assert.equal(isLessonUnlocked("missing-lesson", {}, lessons), false);
});

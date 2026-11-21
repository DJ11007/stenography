import test from "node:test";
import assert from "node:assert/strict";

import { managedVersionToPreset, stenoCategoriesOf } from "../lib/admin-tests.ts";

// One stenography dictation set for several exams (21 Nov 2026): each exam keeps its own dictation speed,
// transcription time, accuracy and full / half mistake rules, applied when the test is opened under that exam.
const base = { id: "v1", testId: "t1", versionNumber: 1, title: "Dictation 1", description: "", slug: "dictation-1", language: "English", inputSystemId: "english-qwerty", mode: "stenography", durationSeconds: 2400, passage: "The court passed the order today and the matter was listed again.", requiredWpm: 100, requiredAccuracy: 95, backspaceMode: "full", wordMethod: "characters", highlightMode: "none", visibility: "public", stenoCategory: "ssc-steno-c", stenoCategories: ["ssc-steno-c", "ssc-steno-cd", "rsmssb-steno"] };

test("the exam list is the test's list, or (older tests) its single exam", () => {
  assert.deepEqual(stenoCategoriesOf(base), ["ssc-steno-c", "ssc-steno-cd", "rsmssb-steno"]);
  assert.deepEqual(stenoCategoriesOf({ stenoCategory: "rajasthan-hc-steno", stenoCategories: null }), ["rajasthan-hc-steno"]);
  assert.deepEqual(stenoCategoriesOf({ stenoCategory: "rajasthan-hc-steno", stenoCategories: ["not-a-real-exam"] }), ["rajasthan-hc-steno"]);
});

test("opened under SSC Grade C: 100 WPM, 40 min, 95% accuracy, SSC mistake rules", () => {
  const p = managedVersionToPreset(base, undefined, "ssc-steno-c");
  assert.equal(p.stenoExam.slug, "ssc-steno-c");
  assert.equal(p.durationSeconds, 40 * 60);
  assert.equal(p.stenoExam.dictationWpm, 100);
  assert.equal(p.accuracyRequirement, 95);
  assert.equal(p.scoringProfile.stenoEvaluation, "ssc");
});

test("the SAME test opened under SSC Grade D: 80 WPM, 50 min, 93% accuracy", () => {
  const p = managedVersionToPreset(base, undefined, "ssc-steno-cd");
  assert.equal(p.stenoExam.name, "SSC Steno Grade D");
  assert.equal(p.durationSeconds, 50 * 60);
  assert.equal(p.stenoExam.dictationWpm, 80);
  assert.equal(p.accuracyRequirement, 93);
  assert.equal(p.scoringProfile.stenoEvaluation, "ssc");
});

test("the SAME test opened under RSMSSB: 100 WPM, 60 min English / 70 min Hindi, 80% accuracy", () => {
  assert.equal(managedVersionToPreset(base, undefined, "rsmssb-steno").durationSeconds, 60 * 60);
  assert.equal(managedVersionToPreset({ ...base, language: "Hindi", inputSystemId: "hindi-inscript" }, undefined, "rsmssb-steno").durationSeconds, 70 * 60);
  assert.equal(managedVersionToPreset(base, undefined, "rsmssb-steno").accuracyRequirement, 80);
});

test("an exam the test is NOT set for falls back to its main exam", () => {
  assert.equal(managedVersionToPreset(base, undefined, "rajasthan-hc-steno").stenoExam.slug, "ssc-steno-c");
  assert.equal(managedVersionToPreset(base).stenoExam.slug, "ssc-steno-c");
});

test("an older Rajasthan HC test: RHC rules -- 5% free mistakes and misspellings as full mistakes", () => {
  const p = managedVersionToPreset({ ...base, stenoCategory: "rajasthan-hc-steno", stenoCategories: undefined, durationSeconds: 3000 });
  assert.equal(p.stenoExam.slug, "rajasthan-hc-steno");
  assert.equal(p.scoringProfile.errorRelaxationPercent, 5);
  assert.equal(p.scoringProfile.minorSpellingIsFullMistake, true);
  assert.equal(p.scoringProfile.stenoEvaluation, undefined);
});

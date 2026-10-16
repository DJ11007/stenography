"use server";
import { trustedStartedAt } from "@/lib/exam-clock";

import { createClient } from "@/lib/supabase/server";
import type { ExamPreset } from "@/lib/typing-curriculum";
import type { TypingScore } from "@/lib/typing-test";

// Saves an attempt of a built-in typing test (a category's "Start Official
// Pattern", the stenography sample, the RSSB demo pages, the student's own
// uploaded matter) to practice_attempts, so it shows in the student's results
// and the admin's records like any admin-managed test. These tests are the
// student's own practice -- their score is the one the result screen computed.
export type PracticeAttemptPayload = {
  presetId: string; title: string; mode: "practice" | "exam"; preset: ExamPreset; inputSystemId: string;
  startedAt: string; typedText: string; comparisonText: string; passage: string; elapsedSeconds: number; backspaces: number; score: TypingScore;
  marksObtained?: number | null; marksQualified?: boolean | null; marksNetWpm?: number | null; examCategorySlug?: string | null;
};

export async function recordPracticeAttempt(payload: PracticeAttemptPayload): Promise<{ status: "scored" } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const startedAt = new Date(payload.startedAt);
  if (!payload.presetId || !payload.title || !["practice", "exam"].includes(payload.mode) || Number.isNaN(startedAt.getTime())) return null;
  if (!Number.isFinite(payload.elapsedSeconds) || payload.elapsedSeconds < 0 || payload.typedText.length > 100000 || payload.passage.length > 100000) return null;
  const score = payload.score;
  const result = {
    grossWpm: score.grossWpm, netWpm: score.netWpm, accuracy: score.accuracy, elapsedSeconds: score.elapsedSeconds,
    fullErrors: score.analysis.fullErrors, halfErrors: score.analysis.halfErrors, combinedPenalty: score.analysis.totalPenalty, typedCharacters: score.totalCharacters,
    backspaces: Math.max(0, Math.floor(payload.backspaces)), typedText: payload.typedText, examCategorySlug: payload.examCategorySlug ?? null,
    resolvedPassage: payload.passage, comparisonText: payload.comparisonText, score,
    marksObtained: payload.marksObtained ?? null, marksQualified: payload.marksQualified ?? null, marksNetWpm: payload.marksNetWpm ?? null,
  };
  const { error } = await supabase.from("practice_attempts").insert({
    student_id: user.id, preset_id: payload.presetId.slice(0, 200), title: payload.title.slice(0, 300), mode: payload.mode,
    snapshot: { preset: payload.preset, inputSystemId: payload.inputSystemId }, result, started_at: trustedStartedAt(startedAt.toISOString(), payload.elapsedSeconds),
  });
  return error ? null : { status: "scored" };
}

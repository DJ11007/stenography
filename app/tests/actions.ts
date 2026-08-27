"use server";

import { createClient } from "@/lib/supabase/server";
import { managedVersionToPreset, type ManagedTestVersion } from "@/lib/admin-tests";
import { normalizeTypingInput } from "@/lib/typing-language";
import { calculateTypingScore } from "@/lib/typing-test";

type AttemptPayload = { testId: string; versionId: string; startedAt: string; typedText: string; elapsedSeconds: number; backspaces: number };

export async function recordManagedAttempt(payload: AttemptPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !Number.isFinite(payload.elapsedSeconds) || payload.elapsedSeconds < 0 || payload.typedText.length > 100000) return null;
  const [{ data: test }, { data: v }] = await Promise.all([
    supabase.from("tests").select("id,slug,current_version_id,status,visibility,is_live,live_starts_at,live_ends_at,results_publish_at").eq("id", payload.testId).maybeSingle(),
    supabase.from("test_versions").select("*").eq("id", payload.versionId).maybeSingle(),
  ]);
  if (!test || test.status !== "published" || test.visibility !== "public" || test.current_version_id !== v?.id || v.test_id !== test.id) return null;
  const { error: accessError } = await supabase.rpc("assert_student_access_allowed");
  if (accessError) return { status: "locked" as const };
  if (test.is_live) {
    const now = Date.now(); const starts = new Date(test.live_starts_at ?? "").getTime(); const ends = new Date(test.live_ends_at ?? "").getTime();
    if (!Number.isFinite(starts) || !Number.isFinite(ends) || now < starts || now > ends) return { status: "closed" as const };
  }
  const version: ManagedTestVersion = { id: v.id, testId: v.test_id, versionNumber: v.version_number, title: v.title, description: v.description ?? "", slug: test.slug, language: v.language, inputSystemId: v.input_system_id, mode: v.mode, durationSeconds: v.duration_seconds, passage: v.passage, requiredWpm: Number(v.required_wpm), requiredAccuracy: Number(v.required_accuracy), backspaceMode: v.backspace_mode, wordMethod: v.word_method, highlightMode: v.highlight_mode, visibility: v.visibility };
  const preset = managedVersionToPreset(version);
  const inputSystem = preset.inputSystems[0];
  const normalized = normalizeTypingInput(payload.typedText, inputSystem);
  const score = calculateTypingScore({ typedText: normalized.comparisonText, passage: version.passage, elapsedSeconds: Math.min(payload.elapsedSeconds, version.durationSeconds), wordMethod: version.wordMethod, scoringProfile: preset.scoringProfile, includeUntypedWords: true });
  const result = { grossWpm: score.grossWpm, netWpm: score.netWpm, accuracy: score.accuracy, elapsedSeconds: score.elapsedSeconds, fullErrors: score.analysis.fullErrors, halfErrors: score.analysis.halfErrors, combinedPenalty: score.analysis.totalPenalty, typedCharacters: score.totalCharacters, backspaces: Math.max(0, Math.floor(payload.backspaces)) };
  const { error } = await supabase.from("test_attempts").insert({ test_id: test.id, test_version_id: v.id, student_id: user.id, started_at: payload.startedAt, snapshot: v, result, is_live_attempt: Boolean(test.is_live) });
  if (error) return error.code === "23505" && test.is_live ? { status: "already-submitted" as const, resultsPublishAt: test.results_publish_at } : null;
  return test.is_live ? { status: "submitted" as const, resultsPublishAt: test.results_publish_at } : { status: "scored" as const, score };
}

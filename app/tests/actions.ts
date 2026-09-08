"use server";

import { createClient } from "@/lib/supabase/server";
import { managedVersionToPreset, type ManagedTestVersion } from "@/lib/admin-tests";
import { repeatPassageToExactWordCount } from "@/lib/typing-curriculum";
import { getInputSystemPassage, getScoringText, normalizeTypingInput } from "@/lib/typing-language";
import { calculateTypingScore, sanitizeSelectedCategories, scoringProfileWithSelectedCategories, type HalfErrorCategory } from "@/lib/typing-test";

type AttemptPayload = { testId: string; versionId: string; startedAt: string; typedText: string; elapsedSeconds: number; backspaces: number; selectedCategories?: HalfErrorCategory[]; passageWordCount?: number | null; examCategorySlug?: string | null };

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
  // Defense-in-depth backstop for the free-practice-test cap -- the real
  // gate is PracticeNavigator refusing to even render the workspace once
  // blocked, this only matters against a direct call to this action.
  if (v.mode === "practice") {
    const { error: freeLimitError } = await supabase.rpc("assert_practice_test_allowed");
    if (freeLimitError) return { status: "locked" as const };
  }
  if (test.is_live) {
    const now = Date.now(); const starts = new Date(test.live_starts_at ?? "").getTime(); const ends = new Date(test.live_ends_at ?? "").getTime();
    if (!Number.isFinite(starts) || !Number.isFinite(ends) || now < starts || now > ends) return { status: "closed" as const };
  }
  const version: ManagedTestVersion = { id: v.id, testId: v.test_id, versionNumber: v.version_number, title: v.title, description: v.description ?? "", slug: test.slug, language: v.language, inputSystemId: v.input_system_id, mode: v.mode, durationSeconds: v.duration_seconds, passage: v.passage, requiredWpm: Number(v.required_wpm), requiredAccuracy: Number(v.required_accuracy), backspaceMode: v.backspace_mode, wordMethod: v.word_method, highlightMode: v.highlight_mode, visibility: v.visibility, audioPath: (v.configuration as Record<string, unknown> | null)?.audio_path as string | null ?? null, examCategory: (v.configuration as Record<string, unknown> | null)?.exam_category as string | null ?? null };
  // A shared Rajasthan LDC exercise viewed through a different category's
  // page must be scored against THAT category's own rules, not Rajasthan
  // LDC's -- this is what actually determines Pass/Fail and Qualified/
  // Not-Qualified, so the client's claimed examCategorySlug has to reach
  // this authoritative recomputation too, not just the initial display.
  // Safe against tampering: managedVersionToPreset() only ever honors it
  // when version.examCategory (read from the trusted DB row above, not
  // from payload) is actually "rajasthan-ldc" -- a payload claiming
  // otherwise for a non-Rajasthan-LDC test is silently ignored.
  const preset = managedVersionToPreset(version, payload.examCategorySlug ?? undefined);
  const inputSystem = preset.inputSystems[0];
  const normalized = normalizeTypingInput(payload.typedText, inputSystem);
  // The client already folds the student's dictation-phase category
  // selection into its own scoring profile before computing a score to
  // display -- but this server-side recomputation is what actually gets
  // saved and is what overrides the client's number for managed tests
  // (see the recordManagedAttempt call site), so it has to fold in the
  // exact same selection or the student's choice would have no real
  // effect. Only ever applied for versions that actually have dictation
  // audio configured -- a stray/absent selectedCategories field never
  // affects a plain (non-audio) managed test's scoring.
  const scoringProfile = version.audioPath
    ? scoringProfileWithSelectedCategories(preset.scoringProfile, sanitizeSelectedCategories(payload.selectedCategories))
    : preset.scoringProfile;
  // getScoringText matches exactly what the client already used to compute
  // its own (displayed, then overridden) score -- same reasoning as
  // configurable-typing-exam.tsx's finalScore: for Kruti Dev, compare
  // through krutiDevToUnicode() rather than raw legacy bytes, since Kruti
  // Dev has genuine typist shortcuts (one key standing in for two or more
  // ordinary keystrokes) that only a full decode reliably resolves as
  // equal on both sides.
  // Word-count customization is only ever legitimate for a plain
  // (non-live) Practice test, outside Stenography -- independently
  // re-derived here from the trusted server-side version/test rows, not
  // the client's own claim, exactly matching managedTestSettingsLocks'
  // unlocked case. This is what stops a tampered payload.passageWordCount
  // from silently shrinking/repeating an Exam/Learn/live/Stenography
  // test's real passage before scoring it.
  const wordCountCustomizable = version.mode === "practice" && !test.is_live && preset.category !== "stenography";
  const resolvedPassage = getInputSystemPassage(inputSystem, version.passage);
  const requestedWordCount = payload.passageWordCount;
  const effectivePassage = wordCountCustomizable && typeof requestedWordCount === "number" && Number.isInteger(requestedWordCount) && requestedWordCount >= 150 && requestedWordCount <= 700
    ? repeatPassageToExactWordCount(resolvedPassage, requestedWordCount)
    : resolvedPassage;
  // preset.durationSeconds/preset.wordMethod (not raw version.*) so a
  // shared Rajasthan LDC exercise is capped/word-counted per the viewing
  // category's own rules -- preset already reflects that override (or
  // falls back to version's own values when there's no override to apply).
  const score = calculateTypingScore({ typedText: getScoringText(normalized.comparisonText, inputSystem), passage: getScoringText(effectivePassage, inputSystem), elapsedSeconds: Math.min(payload.elapsedSeconds, preset.durationSeconds), wordMethod: preset.wordMethod, scoringProfile, includeUntypedWords: true });
  // typedText/examCategorySlug/passageWordCount: previously this only ever
  // stored the AGGREGATE score, never what the student actually typed --
  // there was no way for an admin (or the student, after leaving the
  // client-side results screen) to ever see the real passage-vs-typed
  // comparison again, only the numbers. Storing these lets an admin
  // detail view rebuild the exact same preset/passage/AdvancedTypingResults
  // breakdown a student saw right after submitting, on demand later.
  const result = { grossWpm: score.grossWpm, netWpm: score.netWpm, accuracy: score.accuracy, elapsedSeconds: score.elapsedSeconds, fullErrors: score.analysis.fullErrors, halfErrors: score.analysis.halfErrors, combinedPenalty: score.analysis.totalPenalty, typedCharacters: score.totalCharacters, backspaces: Math.max(0, Math.floor(payload.backspaces)), typedText: payload.typedText, examCategorySlug: payload.examCategorySlug ?? null, passageWordCount: wordCountCustomizable ? (payload.passageWordCount ?? null) : null, selectedCategories: version.audioPath ? sanitizeSelectedCategories(payload.selectedCategories) : null };
  const { error } = await supabase.from("test_attempts").insert({ test_id: test.id, test_version_id: v.id, student_id: user.id, started_at: payload.startedAt, snapshot: v, result, is_live_attempt: Boolean(test.is_live) });
  if (error) return error.code === "23505" && test.is_live ? { status: "already-submitted" as const, resultsPublishAt: test.results_publish_at } : null;
  return test.is_live ? { status: "submitted" as const, resultsPublishAt: test.results_publish_at } : { status: "scored" as const, score };
}

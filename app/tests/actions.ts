"use server";

import { createClient } from "@/lib/supabase/server";
import { managedVersionToPreset, type ManagedTestVersion } from "@/lib/admin-tests";
import { repeatPassageToExactWordCount } from "@/lib/typing-curriculum";
import { getInputSystemPassage, getScoringText, normalizeTypingInput } from "@/lib/typing-language";
import { calculateTypingScore, sanitizeSelectedCategories, scoringProfileWithSelectedCategories, type HalfErrorCategory } from "@/lib/typing-test";
import { calculateConfiguredRssbMarks } from "@/lib/typing-results";

type AttemptPayload = { testId: string; versionId: string; startedAt: string; typedText: string; elapsedSeconds: number; backspaces: number; selectedCategories?: HalfErrorCategory[]; passageWordCount?: number | null; examCategorySlug?: string | null };

export async function recordManagedAttempt(payload: AttemptPayload) {
  const supabase = await createClient();
  // Speed fix, reported live: submitting a test on the deployed site took
  // multiple seconds of background processing (doesn't block the results
  // screen -- see configurable-typing-exam.tsx's finalScore fallback --
  // but the corrected/verified score, and any "locked" outcome, waited on
  // it). Measured on the deployed site: one submission's network request
  // took ~6.9s. Root cause: this function made up to five Supabase round
  // trips in strict sequence -- getUser(), then the tests+test_versions
  // pair, then assert_student_access_allowed, then (practice mode only)
  // assert_practice_test_allowed, then the insert -- when the first three
  // don't actually depend on each other's result (RLS reads the request's
  // JWT directly, not the JS-level getUser() return value, so it's safe
  // to run alongside the row lookups) and the two RPC checks are
  // independent boolean gates, not a pipeline. Collapsing both groups into
  // Promise.all cuts the sequential round-trip count from five to three
  // without changing what's checked or in what order failures are
  // reported.
  const [{ data: { user } }, { data: test }, { data: v }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("tests").select("id,slug,current_version_id,status,visibility,is_live,live_starts_at,live_ends_at,results_publish_at,results_delay_minutes").eq("id", payload.testId).maybeSingle(),
    supabase.from("test_versions").select("*").eq("id", payload.versionId).maybeSingle(),
  ]);
  if (!user || !Number.isFinite(payload.elapsedSeconds) || payload.elapsedSeconds < 0 || payload.typedText.length > 100000) return null;
  if (!test || test.status !== "published" || test.visibility !== "public" || test.current_version_id !== v?.id || v.test_id !== test.id) return null;
  // Defense-in-depth backstop for the free-practice-test and free-exam-test
  // caps -- the real gates are PracticeNavigator and /tests/[slug] refusing
  // to even render the workspace once blocked, these only matter against a
  // direct call to this action. A live scheduled exam is unaffected by the
  // exam cap, same as the pre-render gate.
  const [{ error: accessError }, practiceLimitResult, examLimitResult] = await Promise.all([
    supabase.rpc("assert_student_access_allowed"),
    v.mode === "practice" ? supabase.rpc("assert_practice_test_allowed") : Promise.resolve(null),
    v.mode === "exam" && !test.is_live ? supabase.rpc("assert_exam_test_allowed") : Promise.resolve(null),
  ]);
  if (accessError) return { status: "locked" as const };
  if (v.mode === "practice" && practiceLimitResult?.error) return { status: "locked" as const };
  if (v.mode === "exam" && !test.is_live && examLimitResult?.error) return { status: "locked" as const };
  // An "anytime" live test (results_delay_minutes set) has no fixed
  // start/end window -- it's attemptable whenever a student opens it, so
  // the scheduled-window check below only ever applies to the original
  // "everyone attempts in one shared window" live-test shape.
  if (test.is_live && test.results_delay_minutes == null) {
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
  // RSMSSB has no negative marking, so its real Net WPM (correctWords/time)
  // and real qualification (correctWords x marksPerCorrectWord >=
  // minimumPassingMarks) are neither the generic penalty-based netWpm above
  // nor a plain WPM-vs-requiredWpm check -- requiredWpm/requiredAccuracy on
  // this test's own version row is the pace for FULL marks (e.g. Hindi's 40
  // WPM), not the pace to merely pass (~14.4 WPM), the same distinction
  // fixed on the student's own results screen (see
  // requiredWpmForMarksMethod's doc comment). Every admin dashboard that
  // reads this stored row (the per-test leaderboard, a student's Track
  // page, the student's own Results page) was comparing netWpm against
  // required_wpm and silently mis-judging Pass/Fail for Rajasthan LDC/DEO.
  // Storing these three fields alongside the generic ones -- never
  // replacing them, so every other exam and every already-recorded attempt
  // (frozen at submission, per this project's convention) is unaffected --
  // lets each of those dashboards prefer the real figures when present.
  const marksResult = preset.marksMethod ? calculateConfiguredRssbMarks(score, preset.marksMethod) : null;
  const marksNetWpm = marksResult ? Math.round(score.correctWords / Math.max(score.elapsedSeconds / 60, 1 / 60)) : null;
  // Real reported bug: an attempt's list-view "Errors" tile (this file's
  // fullErrors/halfErrors, read verbatim by /student/results and the admin
  // per-test results table) is frozen forever, per this project's own
  // convention -- but the attempt-review pages (admin and student) used to
  // reconstruct their own `score` by re-running calculateTypingScore()
  // against the frozen snapshot passage/typedText with WHATEVER scoring
  // logic is live *at view time*. Those two numbers only ever agreed by
  // coincidence: any later change to analyzeTyping/managedVersionToPreset
  // (which this project has repeatedly made -- new half-error categories,
  // RSSB marks-method fixes, category-flag changes) silently made every
  // already-submitted attempt's detailed breakdown disagree with its own
  // list-page total, exactly the "half error and full calculation is not
  // correct in total" report. Storing the complete, already-computed score
  // (plus the exact resolved passage/typed text it was computed against)
  // lets both review pages use this frozen object directly instead of ever
  // recomputing it -- the list tiles and the detailed breakdown can no
  // longer drift apart, for English or Hindi, typing or stenography.
  const result = { grossWpm: score.grossWpm, netWpm: score.netWpm, accuracy: score.accuracy, elapsedSeconds: score.elapsedSeconds, fullErrors: score.analysis.fullErrors, halfErrors: score.analysis.halfErrors, combinedPenalty: score.analysis.totalPenalty, typedCharacters: score.totalCharacters, backspaces: Math.max(0, Math.floor(payload.backspaces)), typedText: payload.typedText, examCategorySlug: payload.examCategorySlug ?? null, passageWordCount: wordCountCustomizable ? (payload.passageWordCount ?? null) : null, selectedCategories: version.audioPath ? sanitizeSelectedCategories(payload.selectedCategories) : null, marksNetWpm, marksQualified: marksResult ? marksResult.qualified : null, marksObtained: marksResult ? marksResult.marksObtained : null, score, resolvedPassage: effectivePassage, comparisonText: normalized.comparisonText };
  const { error } = await supabase.from("test_attempts").insert({ test_id: test.id, test_version_id: v.id, student_id: user.id, started_at: payload.startedAt, snapshot: v, result, is_live_attempt: Boolean(test.is_live) });
  // Anytime mode's per-student unlock time is submitted_at + delay, not a
  // shared resultsPublishAt -- and the DB row can't be re-read to fetch its
  // real submitted_at right after insert (the same RLS policy that hides an
  // unlocked live result from anyone else also hides it from the very
  // request that just created it, until the delay elapses). A coarse
  // (whole-minute) delay makes the tiny gap between "now, in this request"
  // and the DB's own `default now()` stamp irrelevant, so this just uses
  // the current time directly instead.
  if (error) return error.code === "23505" && test.is_live ? { status: "already-submitted" as const, resultsPublishAt: test.results_publish_at, resultsDelayMinutes: test.results_delay_minutes } : null;
  return test.is_live ? { status: "submitted" as const, resultsPublishAt: test.results_publish_at, resultsDelayMinutes: test.results_delay_minutes, submittedAt: test.results_delay_minutes != null ? new Date().toISOString() : null } : { status: "scored" as const, score };
}

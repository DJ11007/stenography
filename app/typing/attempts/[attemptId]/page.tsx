import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/app/_components/back-button";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { managedVersionToPreset, type ManagedTestVersion } from "@/lib/admin-tests";
import { repeatPassageToExactWordCount } from "@/lib/typing-curriculum";
import { getInputSystemPassage, getScoringText, normalizeTypingInput } from "@/lib/typing-language";
import { calculateTypingScore, sanitizeSelectedCategories, scoringProfileWithSelectedCategories } from "@/lib/typing-test";
import { AttemptReviewClient } from "@/app/admin/students/attempts/[attemptId]/attempt-review-client";
import { formatIST } from "@/lib/format-datetime";

export const metadata: Metadata = { title: "My Result | Samradhi Classes" };

// Student-facing counterpart to app/admin/students/attempts/[attemptId] --
// mirrors its snapshot-rebuild logic exactly, but scoped to the current
// student's OWN attempt (student_id filter + createClient()'s normal RLS,
// so a live attempt whose results_publish_at hasn't passed yet 404s here
// the same way it's invisible everywhere else, via the same "Students read
// own attempts" policy -- no separate publish-gate check needed). This is
// the first time a student can revisit a past attempt's full passage-vs-
// typed breakdown after leaving the results screen right after submitting
// -- previously only /student/results' summary cards existed.
export default async function StudentAttemptReviewPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { user } = await requireStudent();
  const { attemptId } = await params;
  const supabase = await createClient();

  const { data: attempt } = await supabase.from("test_attempts").select("id,test_id,snapshot,result,started_at,submitted_at,student_id,is_live_attempt").eq("id", attemptId).eq("student_id", user.id).maybeSingle();
  if (!attempt) notFound();
  const { data: test } = await supabase.from("tests").select("id,title,slug").eq("id", attempt.test_id).maybeSingle();

  const v = attempt.snapshot as Record<string, unknown>;
  const result = (attempt.result ?? {}) as Record<string, unknown>;
  const typedText = typeof result.typedText === "string" ? result.typedText : null;

  const version: ManagedTestVersion = { id: v.id as string, testId: v.test_id as string, versionNumber: v.version_number as number, title: v.title as string, description: (v.description as string) ?? "", slug: test?.slug ?? "", language: v.language as ManagedTestVersion["language"], inputSystemId: v.input_system_id as string, mode: v.mode as ManagedTestVersion["mode"], durationSeconds: v.duration_seconds as number, passage: v.passage as string, requiredWpm: Number(v.required_wpm), requiredAccuracy: Number(v.required_accuracy), backspaceMode: v.backspace_mode as ManagedTestVersion["backspaceMode"], wordMethod: v.word_method as ManagedTestVersion["wordMethod"], highlightMode: v.highlight_mode as ManagedTestVersion["highlightMode"], visibility: v.visibility as ManagedTestVersion["visibility"], audioPath: (v.configuration as Record<string, unknown> | null)?.audio_path as string | null ?? null, examCategory: (v.configuration as Record<string, unknown> | null)?.exam_category as string | null ?? null };
  const examCategorySlug = typeof result.examCategorySlug === "string" ? result.examCategorySlug : undefined;
  const preset = managedVersionToPreset(version, examCategorySlug);
  const inputSystem = preset.inputSystems[0];

  let reviewData: { passage: string; typedText: string; score: ReturnType<typeof calculateTypingScore>; backspaces: number } | null = null;
  if (typedText !== null) {
    // Prefer the score exactly as it was computed and saved at submission
    // (see app/tests/actions.ts) over recomputing it here -- see the
    // matching comment in the admin attempt-review page for why a
    // recompute silently drifted from the frozen totals shown on
    // /student/results, which was the real cause of a reported "half
    // error and full calculation is not correct in total" mismatch. Older
    // attempts recorded before this field existed still fall back to
    // recomputing, same as before.
    if (result.score && typeof result.score === "object" && typeof result.resolvedPassage === "string" && typeof result.comparisonText === "string") {
      reviewData = { passage: result.resolvedPassage, typedText: result.comparisonText, score: result.score as ReturnType<typeof calculateTypingScore>, backspaces: typeof result.backspaces === "number" ? result.backspaces : 0 };
    } else {
      const wordCountCustomizable = version.mode === "practice" && !attempt.is_live_attempt && preset.category !== "stenography";
      const resolvedPassage = getInputSystemPassage(inputSystem, version.passage);
      const requestedWordCount = typeof result.passageWordCount === "number" ? result.passageWordCount : null;
      const effectivePassage = wordCountCustomizable && requestedWordCount && requestedWordCount >= 150 && requestedWordCount <= 700 ? repeatPassageToExactWordCount(resolvedPassage, requestedWordCount) : resolvedPassage;
      const normalized = normalizeTypingInput(typedText, inputSystem);
      const scoringProfile = version.audioPath ? scoringProfileWithSelectedCategories(preset.scoringProfile, sanitizeSelectedCategories(Array.isArray(result.selectedCategories) ? result.selectedCategories as never[] : undefined)) : preset.scoringProfile;
      const elapsedSeconds = typeof result.elapsedSeconds === "number" ? result.elapsedSeconds : 0;
      const score = calculateTypingScore({ typedText: getScoringText(normalized.comparisonText, inputSystem), passage: getScoringText(effectivePassage, inputSystem), elapsedSeconds: Math.min(elapsedSeconds, preset.durationSeconds), wordMethod: preset.wordMethod, scoringProfile, includeUntypedWords: true });
      reviewData = { passage: effectivePassage, typedText: normalized.comparisonText, score, backspaces: typeof result.backspaces === "number" ? result.backspaces : 0 };
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/student/results" label="My Results" />
        <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-6 shadow">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Attempt review</p>
            <h1 className="mt-1 text-2xl font-black">{test?.title ?? "Typing test"}</h1>
            <p className="mt-1 text-sm text-slate-600">Submitted {attempt.submitted_at ? formatIST(attempt.submitted_at) : "In progress"}</p>
          </div>
          <Link href="/typing/practice/error-drill" className="shrink-0 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800">✎ Practice My Errors</Link>
        </section>
        {reviewData ? (
          <div className="mt-6"><AttemptReviewClient preset={preset} inputSystem={inputSystem} passage={reviewData.passage} typedText={reviewData.typedText} score={reviewData.score} backspaces={reviewData.backspaces} returnHref="/student/results" returnLabel="Back to My Results" mode={version.mode === "learn" || version.mode === "practice" ? "practice" : "exam"} /></div>
        ) : (
          <section className="mt-6 rounded-2xl bg-amber-50 p-6 text-amber-900 shadow"><h2 className="font-black">No detailed record available</h2><p className="mt-2 text-sm">This attempt was submitted before detailed review was added, so only the summary score below was ever saved.</p><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><Field label="Net WPM" value={String(result.marksNetWpm ?? result.netWpm ?? "—")} /><Field label="Accuracy" value={result.accuracy != null ? `${result.accuracy}%` : "—"} /><Field label="Errors" value={String(Number(result.fullErrors ?? 0) + Number(result.halfErrors ?? 0))} /></dl></section>
        )}
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-amber-700">{label}</dt><dd className="font-bold text-amber-950">{value}</dd></div>;
}

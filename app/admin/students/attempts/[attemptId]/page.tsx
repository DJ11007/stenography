import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { managedVersionToPreset, type ManagedTestVersion } from "@/lib/admin-tests";
import { repeatPassageToExactWordCount } from "@/lib/typing-curriculum";
import { getInputSystemPassage, getScoringText, normalizeTypingInput } from "@/lib/typing-language";
import { calculateTypingScore, sanitizeSelectedCategories, scoringProfileWithSelectedCategories } from "@/lib/typing-test";
import { TypingStudentProvider } from "@/app/typing/_components/typing-student-provider";
import { AttemptReviewClient } from "./attempt-review-client";
import { formatIST } from "@/lib/format-datetime";

export const metadata: Metadata = { title: "Attempt Review | Admin" };

// Rebuilds the exact same passage/score/analysis a student saw on their own
// results screen right after submitting -- mirrors recordManagedAttempt's
// own computation in app/tests/actions.ts step for step, reading from the
// version snapshot + result fields stored on the attempt itself instead of
// a fresh live test_versions row (the test may have since changed or been
// unpublished; the snapshot is what the student actually attempted).
export default async function AdminAttemptReviewPage({ params }: { params: Promise<{ attemptId: string }> }) {
  await requireAdmin();
  const { attemptId } = await params;
  const supabase = await createClient();

  const { data: attempt } = await supabase.from("test_attempts").select("id,test_id,snapshot,result,started_at,submitted_at,student_id,is_live_attempt").eq("id", attemptId).maybeSingle();
  if (!attempt) notFound();
  const { data: test } = await supabase.from("tests").select("id,title,slug").eq("id", attempt.test_id).maybeSingle();
  const { data: student } = await supabase.from("profiles").select("id,full_name,email,phone").eq("id", attempt.student_id).maybeSingle();

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
    // (see app/tests/actions.ts) over recomputing it here. A recompute
    // re-runs TODAY's scoring code against the frozen snapshot, which
    // silently disagrees with the frozen fullErrors/halfErrors totals
    // shown on the list pages (/student/results, the admin per-test
    // results table) the moment scoring logic changes after submission --
    // this was the real cause of a reported "half error and full
    // calculation is not correct in total" mismatch. Older attempts
    // recorded before this field existed still fall back to recomputing,
    // same as before.
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
        <Link href={`/admin/students/${attempt.student_id}`} className="text-sm font-black text-blue-700">← {student?.full_name || "Student"}</Link>
        <section className="mt-4 rounded-2xl bg-white p-6 shadow">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Attempt review</p>
          <h1 className="mt-1 text-2xl font-black">{test?.title ?? "Typing test"}</h1>
          <p className="mt-1 text-sm text-slate-600">{student?.full_name || "(no name)"} · {student?.email} · Submitted {attempt.submitted_at ? formatIST(attempt.submitted_at) : "In progress"}</p>
        </section>
        {reviewData ? (
          // AdvancedTypingResults renders TypingBrandHeader internally, which
          // calls useTypingStudent() -- that context is normally supplied by
          // /typing/layout.tsx (or an explicit TypingStudentProvider, as
          // /tests/[slug]/page.tsx does) for every student-facing route, but
          // this page lives under /admin, outside that layout entirely.
          // Without this wrapper the whole page 500s with "Typing student
          // context is unavailable" the instant AdvancedTypingResults tries
          // to render -- caught live via read_network_requests on a real
          // attempt. Passes the REVIEWED student's own info (not the
          // admin's), so the header shows whose result this is.
          <TypingStudentProvider student={{ name: student?.full_name?.trim() || "Student", email: student?.email || "", phone: student?.phone || null }}>
            <div className="mt-6"><AttemptReviewClient preset={preset} inputSystem={inputSystem} passage={reviewData.passage} typedText={reviewData.typedText} score={reviewData.score} backspaces={reviewData.backspaces} returnHref={`/admin/students/${attempt.student_id}`} returnLabel={`← Back to ${student?.full_name || "student"}`} mode={version.mode==="learn"||version.mode==="practice"?"practice":"exam"}/></div>
          </TypingStudentProvider>
        ) : (
          <section className="mt-6 rounded-2xl bg-amber-50 p-6 text-amber-900 shadow"><h2 className="font-black">No detailed record available</h2><p className="mt-2 text-sm">This attempt was submitted before detailed review was added, so only the summary score below was ever saved.</p><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><Field label="Net WPM" value={String(result.marksNetWpm ?? result.netWpm ?? "—")}/><Field label="Accuracy" value={result.accuracy != null ? `${result.accuracy}%` : "—"}/><Field label="Errors" value={String(Number(result.fullErrors ?? 0) + Number(result.halfErrors ?? 0))}/></dl></section>
        )}
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-amber-700">{label}</dt><dd className="font-bold text-amber-950">{value}</dd></div>;
}

import Link from "next/link";
import { BackButton } from "@/app/_components/back-button";
import { AttemptReviewClient } from "@/app/admin/students/attempts/[attemptId]/attempt-review-client";
import { formatIST } from "@/lib/format-datetime";
import { TypingStudentProvider } from "@/app/typing/_components/typing-student-provider";
import type { ExamPreset } from "@/lib/typing-curriculum";
import type { calculateTypingScore } from "@/lib/typing-test";

// Review of a built-in typing test attempt (practice_attempts): the test's own
// settings and the score were saved with the attempt at submission, so this is
// the same breakdown the student saw on the result screen.
export type PracticeAttemptRow = { id: string; title: string; mode: string; snapshot: unknown; result: unknown; submitted_at: string };

// student: given on admin pages, which sit outside the typing layout that
// normally supplies the student shown in the result's header.
export function PracticeAttemptReview({ attempt, backHref, backLabel, subtitle, showPracticeLink = true, student }: { attempt: PracticeAttemptRow; backHref: string; backLabel: string; subtitle?: string; showPracticeLink?: boolean; student?: { name: string; email: string; phone: string | null } }) {
  const snapshot = (attempt.snapshot ?? {}) as { preset?: ExamPreset; inputSystemId?: string };
  const result = (attempt.result ?? {}) as Record<string, unknown>;
  const preset = snapshot.preset;
  const inputSystem = preset?.inputSystems.find(system => system.id === snapshot.inputSystemId) ?? preset?.inputSystems[0];
  const ready = preset && inputSystem && result.score && typeof result.resolvedPassage === "string" && typeof result.comparisonText === "string";
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href={backHref} label={backLabel} />
        <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-6 shadow">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Attempt review · Built-in test</p>
            <h1 className="mt-1 text-2xl font-black">{attempt.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{subtitle ? `${subtitle} · ` : ""}Submitted {formatIST(attempt.submitted_at)}</p>
          </div>
          {showPracticeLink && <Link href="/typing/practice/error-drill" className="shrink-0 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800">✎ Practice My Errors</Link>}
        </section>
        {ready ? (
          student ? <TypingStudentProvider student={student}><div className="mt-6"><AttemptReviewClient preset={preset} inputSystem={inputSystem} passage={result.resolvedPassage as string} typedText={result.comparisonText as string} score={result.score as ReturnType<typeof calculateTypingScore>} backspaces={typeof result.backspaces === "number" ? result.backspaces : 0} returnHref={backHref} returnLabel={backLabel} mode={attempt.mode === "exam" ? "exam" : "practice"} /></div></TypingStudentProvider> : <div className="mt-6"><AttemptReviewClient preset={preset} inputSystem={inputSystem} passage={result.resolvedPassage as string} typedText={result.comparisonText as string} score={result.score as ReturnType<typeof calculateTypingScore>} backspaces={typeof result.backspaces === "number" ? result.backspaces : 0} returnHref={backHref} returnLabel={backLabel} mode={attempt.mode === "exam" ? "exam" : "practice"} /></div>
        ) : (
          <section className="mt-6 rounded-2xl bg-amber-50 p-6 text-amber-900 shadow"><h2 className="font-black">No detailed record available</h2><p className="mt-2 text-sm">Net WPM {String(result.marksNetWpm ?? result.netWpm ?? "—")} · Accuracy {result.accuracy != null ? `${result.accuracy}%` : "—"}</p></section>
        )}
      </div>
    </main>
  );
}

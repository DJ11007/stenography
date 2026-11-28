import { formatExamDate, type PreviousYearPaper } from "@/lib/previous-year-papers";

// The light colour a previous-year test's card gets, so students tell it apart from normal tests at a glance.
export const PREVIOUS_YEAR_CARD = "border-amber-300 bg-amber-50";

export function PreviousYearBadge({ paper }: { paper: PreviousYearPaper }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2.5 py-1 text-xs font-black text-amber-900" title={`${paper.examName}, ${formatExamDate(paper)}`}>
      <span aria-hidden="true">📜</span> Previous Year · {paper.examYear}
    </span>
  );
}

/** Exam name, date and the admin's description. `compact` keeps it to two lines for small cards. */
export function PreviousYearNote({ paper, compact = false }: { paper: PreviousYearPaper; compact?: boolean }) {
  return (
    <span className="block text-left">
      <span className="block text-sm font-black text-amber-900">{paper.examName} · {formatExamDate(paper)}</span>
      {paper.description && <span className={`mt-1 block whitespace-pre-line text-sm text-amber-900/80 ${compact ? "line-clamp-2" : ""}`}>{paper.description}</span>}
    </span>
  );
}

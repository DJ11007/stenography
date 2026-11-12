import type { WordLengthStats } from "@/lib/word-length-stats";

// A small, fixed-style "Word Length" line shown under a test's title everywhere a test appears (admin lists,
// student catalogues, instructions, workspace, results) -- the average character length per word (including the
// trailing space), the same figure government-exam typing software reports for a passage, used to judge whether
// it is close to the standard "5 characters = 1 word" assumption exams normalize speed against; the shortest and
// longest word (in characters) are shown alongside it where the full passage text was available to compute them.
// Purely informational: it has no effect on grading, duration, or the passage itself.
export function WordLengthTag({ stats }: { stats: WordLengthStats | null | undefined }) {
  if (!stats) return null;
  const range = stats.min != null && stats.max != null ? ` (${stats.min}-${stats.max} chars/word)` : "";
  return <p className="text-[11px] font-semibold text-red-600">Word Length: {stats.avg.toFixed(2)}{range}</p>;
}

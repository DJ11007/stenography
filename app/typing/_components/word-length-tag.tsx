// A small, fixed-style word-count line shown under a test's title everywhere a test appears (admin lists, student
// catalogues, instructions, workspace, results) -- a quick, non-editable size check for whoever set up the test,
// since typing/stenography papers follow a standard length (e.g. ~500 English / ~400 Hindi words for a 10-minute
// government exam paper). Purely informational: it has no effect on grading, duration, or the passage itself.
export function WordLengthTag({ words }: { words: number | null | undefined }) {
  if (words === null || words === undefined || !Number.isFinite(words)) return null;
  return <p className="text-[11px] font-semibold text-red-600">Word Length = {words}</p>;
}

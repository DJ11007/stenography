// A typing attempt's saved result is large (passage, typed text, mistake lists: ~13 kB each). Lists of
// attempts only show a few numbers, so they read the small result_summary column (kept in step with result
// by a database trigger, migration 202610251800) instead. For a student with ~900 attempts the full results
// ran past the database's 8-second limit and the list came back empty; the summary loads in milliseconds.

/** Select-list part that brings the summary numbers instead of the full result. */
export const TYPING_RESULT_SUMMARY = "result_summary";

/** The row with its summary put in `result`, as the pages read it. */
export function withResultSummary<T extends Record<string, unknown>>(row: T): Omit<T, "result_summary"> & { result: Record<string, unknown> } {
  const { result_summary: summary, ...rest } = row;
  return { ...(rest as Omit<T, "result_summary">), result: summary && typeof summary === "object" ? (summary as Record<string, unknown>) : {} };
}

// Word/Excel Efficiency catalogues list tests in the order the admin arranged them (drag and drop on the admin page,
// `sequence`, migration 202611081000); tests without a place yet, or before that migration, follow the number in their
// title (TEST 1, TEST 2, ... TEST 10), not the publish date (Hindi Word TEST 8 was published before TEST 6 and 7).
const titleOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function inTitleSequence<T extends { title: string | null; published_at?: string | null; id: string; sequence?: number | null }>(tests: T[]): T[] {
  const place = (test: T) => (typeof test.sequence === "number" ? test.sequence : Number.POSITIVE_INFINITY);
  return [...tests].sort((a, b) => place(a) - place(b) || titleOrder.compare(a.title ?? "", b.title ?? "") || String(a.published_at ?? "").localeCompare(String(b.published_at ?? "")) || a.id.localeCompare(b.id));
}

/** True when a query failed only because the `sequence` column is not there yet (migration 202611081000 not run). */
export function missingSequenceColumn(error: { message?: string } | null | undefined) {
  return Boolean(error?.message && /sequence/i.test(error.message));
}

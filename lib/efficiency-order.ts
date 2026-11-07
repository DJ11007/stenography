// Word/Excel Efficiency catalogues list tests in the order of the number in their title (TEST 1, TEST 2, ... TEST 10),
// not by publish date: a test published out of turn (Hindi Word TEST 8 before TEST 6 and 7) must not jump the queue.
const titleOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function inTitleSequence<T extends { title: string | null; published_at?: string | null; id: string }>(tests: T[]): T[] {
  return [...tests].sort((a, b) => titleOrder.compare(a.title ?? "", b.title ?? "") || String(a.published_at ?? "").localeCompare(String(b.published_at ?? "")) || a.id.localeCompare(b.id));
}

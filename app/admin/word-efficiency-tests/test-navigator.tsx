"use client";

import { useRouter } from "next/navigation";

// Real reported feedback: switching to a different test meant scrolling
// all the way down to the Managed tests list, finding the right card, and
// clicking Edit -- every time. Same "‹ Test X of Y ▾ ›" arrows+dropdown
// pattern already used for the student-facing stenography/practice
// navigators, here letting the admin jump straight to another test
// without leaving the edit form. Sorted by title (not the list's own
// most-recently-updated order) so saving the test currently open doesn't
// reshuffle its own position mid-edit.
export function TestNavigator({ tests, currentId }: { tests: { id: string; title: string }[]; currentId: string }) {
  const router = useRouter();
  const index = tests.findIndex((test) => test.id === currentId);
  if (index < 0 || tests.length < 2) return null;
  const go = (nextIndex: number) => router.push(`?edit=${tests[nextIndex].id}`);
  return (
    <nav aria-label="Change test" className="flex items-center gap-1.5">
      <button type="button" aria-label="Previous test" disabled={index <= 0} onClick={() => go(index - 1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xl font-black text-blue-800 disabled:opacity-40">‹</button>
      <select title={tests[index].title} aria-label={`Select test. Current: ${tests[index].title}`} value={currentId} onChange={(event) => { const nextIndex = tests.findIndex((test) => test.id === event.target.value); if (nextIndex >= 0) go(nextIndex); }} className="h-9 max-w-56 rounded-lg border border-slate-200 bg-slate-50 px-2 text-center text-xs font-black text-slate-900">
        {tests.map((test, itemIndex) => <option key={test.id} value={test.id} title={test.title}>{`Test ${itemIndex + 1} of ${tests.length}`}</option>)}
      </select>
      <button type="button" aria-label="Next test" disabled={index >= tests.length - 1} onClick={() => go(index + 1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xl font-black text-blue-800 disabled:opacity-40">›</button>
    </nav>
  );
}

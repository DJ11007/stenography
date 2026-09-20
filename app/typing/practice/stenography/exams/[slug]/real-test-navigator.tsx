"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StenographyCategoryNavigatorItem } from "@/lib/stenography-category-navigator-server";

// Real reported request: the previous stacked-button list (one row per
// real test) should instead look and behave like the in-workspace
// "Take Tests" practice navigator (‹ Test X of Y ▾ ›) -- arrows and a
// dropdown to jump straight into any specific real test, oldest first.
// A native <select> already gets a real browser scrollbar once there are
// more options than fit on screen, so no custom listbox is needed for
// "show many, scroll for the rest".
export function RealTestNavigator({ tests, language }: { tests: StenographyCategoryNavigatorItem[]; language: "English" | "Hindi" }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const heading = language === "English" ? "Real tests (with dictation audio, where attached)" : "वास्तविक टेस्ट (जहाँ उपलब्ध हो, श्रुतलेख ऑडियो सहित)";

  if (!tests.length) {
    return (
      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="text-sm font-black text-emerald-900">{heading}</h3>
        <p className="mt-2 text-xs font-bold text-emerald-800">{language === "English" ? "No real test published for this category yet -- the generic sample below is all that's available for now." : "इस श्रेणी के लिए अभी कोई वास्तविक टेस्ट प्रकाशित नहीं है -- फिलहाल केवल नीचे दिया गया सामान्य नमूना ही उपलब्ध है।"}</p>
      </div>
    );
  }

  const current = tests[index];
  const go = (nextIndex: number) => {
    setIndex(nextIndex);
    router.push(`/tests/${tests[nextIndex].slug}`);
  };

  return (
    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="text-sm font-black text-emerald-900">{heading}</h3>
      <div className="mt-3 flex items-center gap-1.5">
        <button type="button" aria-label="Previous test" disabled={index <= 0} onClick={() => go(index - 1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-xl font-black text-emerald-800 shadow-sm disabled:opacity-40">‹</button>
        <select
          title={current.title}
          aria-label={`Select a real test. Current: ${current.title}`}
          value={current.slug}
          onChange={(event) => { const i = tests.findIndex((t) => t.slug === event.target.value); if (i >= 0) go(i); }}
          className="h-9 flex-1 rounded-lg border border-emerald-300 bg-white px-1 text-center text-xs font-black text-emerald-900"
        >
          {tests.map((t, i) => <option key={t.slug} value={t.slug} title={t.title}>{`Test ${i + 1} of ${tests.length}`}</option>)}
        </select>
        <button type="button" aria-label="Next test" disabled={index >= tests.length - 1} onClick={() => go(index + 1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-xl font-black text-emerald-800 shadow-sm disabled:opacity-40">›</button>
      </div>
      <p className="mt-2 truncate text-xs font-bold text-emerald-800">{current.title}</p>
    </div>
  );
}

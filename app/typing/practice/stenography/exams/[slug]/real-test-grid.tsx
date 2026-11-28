import Link from "next/link";
import type { StenographyCategoryNavigatorItem } from "@/lib/stenography-category-navigator-server";
import type { PreviousYearPaper } from "@/lib/previous-year-papers";
import { PREVIOUS_YEAR_CARD, PreviousYearBadge, PreviousYearNote } from "@/app/_components/previous-year-badge";

// Real reported request: replace the ‹ Test X of Y ▾ › dropdown navigator
// with the same numbered-card grid the Exam Simulator's own exercise
// catalogue uses (app/typing/exams/category/[slug]/[language]/page.tsx) --
// scanning a grid of numbered tests is faster for a student to pick from
// than stepping a <select> one option at a time.
export function RealTestGrid({ tests, language, total = tests.length, startNumber = 1, examSlug, previous }: { tests: StenographyCategoryNavigatorItem[]; language: "English" | "Hindi"; total?: number; startNumber?: number; examSlug?: string; previous?: Map<string, PreviousYearPaper> }) {
  const heading = language === "English" ? "Real tests (with dictation audio, where attached)" : "वास्तविक टेस्ट (जहाँ उपलब्ध हो, श्रुतलेख ऑडियो सहित)";

  if (!tests.length) {
    return (
      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="text-sm font-black text-emerald-900">{heading}</h3>
        <p className="mt-2 text-xs font-bold text-emerald-800">{language === "English" ? "No real test published for this category yet -- the generic sample below is all that's available for now." : "इस श्रेणी के लिए अभी कोई वास्तविक टेस्ट प्रकाशित नहीं है -- फिलहाल केवल नीचे दिया गया सामान्य नमूना ही उपलब्ध है।"}</p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="text-sm font-black text-emerald-900">{heading} <span className="font-normal text-emerald-700">({total})</span></h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {tests.map((test, index) => { const paper = previous?.get(test.id); return (
          <Link
            key={test.slug}
            // The exam this list belongs to goes along, so the test runs under THIS exam's rules (one dictation can
            // be set for several exams, each with its own speed, time and mistake rules).
            href={`/tests/${test.slug}${examSlug ? `?exam=${encodeURIComponent(examSlug)}` : ""}`}
            title={test.title}
            className={`flex items-center gap-3 rounded-xl border p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md ${paper ? PREVIOUS_YEAR_CARD : "border-emerald-200 bg-white"}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-sm font-black text-white">{startNumber + index}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-emerald-900">{test.title}</span>
              {paper && <span className="mt-1.5 block"><PreviousYearBadge paper={paper} /><span className="mt-1 block"><PreviousYearNote paper={paper} compact /></span></span>}
            </span>
          </Link>
        ); })}
      </div>
    </div>
  );
}

import Link from "next/link";
import type { StenographyCategoryNavigatorItem } from "@/lib/stenography-category-navigator-server";

// Real reported request: replace the ‹ Test X of Y ▾ › dropdown navigator
// with the same numbered-card grid the Exam Simulator's own exercise
// catalogue uses (app/typing/exams/category/[slug]/[language]/page.tsx) --
// scanning a grid of numbered tests is faster for a student to pick from
// than stepping a <select> one option at a time.
export function RealTestGrid({ tests, language }: { tests: StenographyCategoryNavigatorItem[]; language: "English" | "Hindi" }) {
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
      <h3 className="text-sm font-black text-emerald-900">{heading} <span className="font-normal text-emerald-700">({tests.length})</span></h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {tests.map((test, index) => (
          <Link
            key={test.slug}
            href={`/tests/${test.slug}`}
            title={test.title}
            className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-sm font-black text-white">{index + 1}</span>
            <span className="min-w-0 truncate text-sm font-black text-emerald-900">{test.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

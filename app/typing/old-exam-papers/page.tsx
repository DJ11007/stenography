import type { Metadata } from "next";
import Link from "next/link";
import { TypingBrandHeader } from "../_components/typing-brand";
import { listOldExamPapers } from "@/lib/previous-year-papers-server";
import { groupPapersByYear, isPreviousYearSection, PREVIOUS_YEAR_SECTION_LABEL, PREVIOUS_YEAR_SECTIONS, type PreviousYearSection } from "@/lib/previous-year-papers";
import { PREVIOUS_YEAR_CARD, PreviousYearBadge, PreviousYearNote } from "@/app/_components/previous-year-badge";

export const metadata: Metadata = { title: "Old Exam Papers | Previous Year Typing, Stenography, Word and Excel Papers" };

// Every test the admin marked as a previous-year exam paper (lib/previous-year-papers.ts), from every section,
// newest year first. Each card opens the complete test, with the same timer and marking as in its own section.
export default async function OldExamPapersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const section: PreviousYearSection | null = isPreviousYearSection(query.section) ? query.section : null;
  const all = await listOldExamPapers();
  const papers = section ? all.filter((paper) => paper.section === section) : all;
  const groups = groupPapersByYear(papers);
  const counts = new Map(PREVIOUS_YEAR_SECTIONS.map((item) => [item, all.filter((paper) => paper.section === item).length]));
  const tab = (value: PreviousYearSection | null, label: string, count: number) => (
    <Link key={label} href={value ? `/typing/old-exam-papers?section=${value}` : "/typing/old-exam-papers"} aria-current={section === value ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-black ${section === value ? "bg-amber-600 text-white" : "bg-white text-slate-700 shadow-sm hover:bg-amber-50"}`}>
      {label} <span className="font-bold opacity-75">({count})</span>
    </Link>
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <TypingBrandHeader backHref="/typing" backLabel="Typing" />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-xs font-black uppercase tracking-[.18em] text-amber-700">Real exam questions</p>
        <h1 className="mt-2 text-4xl font-black">📜 Old Exam Papers</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Papers that appeared in real exams, arranged by year. Each one is the complete test: the same questions, timer and marking as in the exam.</p>
        <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2">
          {tab(null, "All", all.length)}
          {PREVIOUS_YEAR_SECTIONS.map((item) => tab(item, PREVIOUS_YEAR_SECTION_LABEL[item], counts.get(item) ?? 0))}
        </nav>
        {groups.length === 0 && (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="text-2xl font-black">Old exam papers will appear here.</h2>
            <p className="mt-2 text-slate-600">No previous-year paper has been added {section ? `to ${PREVIOUS_YEAR_SECTION_LABEL[section]} ` : ""}yet.</p>
          </div>
        )}
        {groups.map((group) => (
          <section key={group.year} aria-labelledby={`year-${group.year}`} className="mt-10">
            <h2 id={`year-${group.year}`} className="flex items-center gap-3 text-2xl font-black">
              <span className="rounded-xl bg-amber-600 px-3 py-1 text-white">{group.year}</span>
              <span className="text-base font-bold text-slate-500">{group.papers.length} paper{group.papers.length === 1 ? "" : "s"}</span>
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {group.papers.map((paper) => (
                <article key={`${paper.section}:${paper.testId}`} className={`flex flex-col rounded-2xl border p-5 shadow-sm ${PREVIOUS_YEAR_CARD}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <PreviousYearBadge paper={paper} />
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700">{PREVIOUS_YEAR_SECTION_LABEL[paper.section]} · {paper.language}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-black">{paper.title}</h3>
                  <div className="mt-2"><PreviousYearNote paper={paper} /></div>
                  <Link href={paper.href} className="mt-4 self-start rounded-xl bg-amber-600 px-5 py-3 font-black text-white hover:bg-amber-700">Take complete test →</Link>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}

import Link from "next/link";
import { BackButton } from "@/app/_components/back-button";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listOldExamPapers } from "@/lib/previous-year-papers-server";
import { formatExamDate, groupPapersByYear, isPreviousYearSection, PREVIOUS_YEAR_SECTION_LABEL, PREVIOUS_YEAR_SECTIONS, type PreviousYearSection } from "@/lib/previous-year-papers";
import { PreviousYearPaperPanel } from "./panel";

type TestOption = { id: string; title: string; language: string };

// Language, then title in number order (TEST 2 before TEST 10).
const byNumber = (a: TestOption, b: TestOption) => a.language.localeCompare(b.language) || a.title.localeCompare(b.title, "en", { numeric: true, sensitivity: "base" });

async function publishedTests(section: PreviousYearSection): Promise<TestOption[]> {
  return (await loadPublishedTests(section)).sort(byNumber);
}

async function loadPublishedTests(section: PreviousYearSection): Promise<TestOption[]> {
  const supabase = await createClient();
  if (section === "word" || section === "excel") {
    const { data } = await supabase.from(section === "word" ? "word_efficiency_tests" : "excel_efficiency_tests").select("id,title,language").eq("status", "published").order("language").order("title").limit(2000);
    return (data ?? []) as TestOption[];
  }
  const { data } = await supabase.from("tests").select("id,title,language").eq("status", "published").eq("is_live", false).eq("mode", section === "typing" ? "exam" : "stenography").order("language").order("title").limit(3000);
  return (data ?? []) as TestOption[];
}

// One place to mark any published test of any section as a previous-year exam paper, and to see and edit every
// paper already marked. (Word and Excel tests also have the same box on their own edit page.)
export default async function PreviousYearPapersAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const section = isPreviousYearSection(params.section) ? params.section : null;
  const options = section ? await publishedTests(section) : [];
  const chosen = section && params.test ? options.find((option) => option.id === params.test) : undefined;
  const papers = await listOldExamPapers();
  const here = (extra: string) => `/admin/previous-year-papers${extra}`;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/admin" label="Admin dashboard" />
        <header className="mt-4 rounded-3xl bg-gradient-to-r from-amber-700 to-amber-500 p-7 text-white">
          <p className="text-xs font-black uppercase tracking-[.18em] text-amber-100">Administrator</p>
          <h1 className="mt-2 text-3xl font-black">📜 Previous Year Papers</h1>
          <p className="mt-2 text-amber-50">Mark a published test as a paper that appeared in a real exam. Students see it highlighted with your description, and listed by year on <Link href="/typing/old-exam-papers" className="font-black underline">Old Exam Papers</Link>.</p>
        </header>
        
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-black">Add a previous-year paper</h2>
          <p className="mt-1 text-sm text-slate-600">1. Choose the section.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PREVIOUS_YEAR_SECTIONS.map((item) => (
              <Link key={item} href={here(`?section=${item}`)} className={`rounded-full px-4 py-2 text-sm font-black ${section === item ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-amber-50"}`}>{PREVIOUS_YEAR_SECTION_LABEL[item]}</Link>
            ))}
          </div>
          {section && (
            <form className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="section" value={section} />
              <label className="min-w-0 flex-1 text-sm font-bold text-slate-700">2. Choose the test ({options.length} published)
                <select name="test" defaultValue={chosen?.id ?? ""} required className="input mt-1 w-full">
                  <option value="" disabled>Select a test…</option>
                  {options.map((option) => <option key={option.id} value={option.id}>{option.language} · {option.title}</option>)}
                </select>
              </label>
              <button className="rounded-xl bg-slate-900 px-5 py-2.5 font-black text-white">Open</button>
            </form>
          )}
          {section && chosen && (
            <div className="mt-4">
              <PreviousYearPaperPanel saved={params.pypSaved} error={params.pypError} section={section} testId={chosen.id} title={`${chosen.language} · ${chosen.title}`} returnTo={here(`?section=${section}&test=${chosen.id}`)} />
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-black">Marked papers ({papers.length})</h2>
          {papers.length === 0 && <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">No test is marked yet.</p>}
          {groupPapersByYear(papers).map((group) => (
            <div key={group.year} className="mt-4">
              <h3 className="text-lg font-black text-amber-800">{group.year}</h3>
              <ul className="mt-2 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                {group.papers.map((paper) => (
                  <li key={`${paper.section}:${paper.testId}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <span>
                      <span className="block font-black">{paper.title}</span>
                      <span className="block text-sm text-slate-600">{PREVIOUS_YEAR_SECTION_LABEL[paper.section]} · {paper.language} · {paper.examName} · {formatExamDate(paper)}</span>
                    </span>
                    <Link href={here(`?section=${paper.section}&test=${paper.testId}`)} className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-black text-amber-900 hover:bg-amber-200">Edit</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

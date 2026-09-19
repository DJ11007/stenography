import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TypingBrandHeader } from "../../../../_components/typing-brand";
import { SafeInstructions } from "../../../../word-efficiency/_components/safe-instructions";
import { formatExcelDuration, type ExcelLanguage } from "@/lib/excel-efficiency";
import { getPublishedExcelTest } from "@/lib/excel-efficiency-server";
import { StudentTestLaunch } from "./student-test-launch";

export const metadata: Metadata = { title: "Excel Efficiency Instructions | Samradhi Classes", description: "Review Excel Efficiency test instructions before starting." };

export default async function ExcelInstructionsPage({ params, searchParams }: { params: Promise<{ language: string; testId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const route = await params;
  const query = await searchParams;
  const language: ExcelLanguage = route.language === "hindi" ? "Hindi" : route.language === "english" ? "English" : notFound();
  const item = await getPublishedExcelTest(language, route.testId);
  if (!item) notFound();
  const { test, version } = item;
  const selected = Number(query.duration);
  const duration = version.duration_options.includes(selected) ? selected : version.duration_options[0];
  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader backHref={`/typing/excel-efficiency/${route.language}`} backLabel={`${language} Tests`} />
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-xl">
          <header className="bg-slate-950 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">Instructions · Timer not started</p>
            <h1 className="mt-2 text-3xl font-black">{version.title}</h1>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Meta label="Language" value={language} />
              <Meta label="Duration" value={formatExcelDuration(duration)} />
              <Meta label="Questions" value={String(version.question_count)} />
              <Meta label="Maximum marks" value={String(version.maximum_marks)} />
            </dl>
          </header>
          <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section>
              <h2 className="text-xl font-black">Test instructions</h2>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5" lang={language === "Hindi" ? "hi" : "en"}>
                <SafeInstructions markdown={version.instructions_markdown} />
              </div>
              <h2 className="mt-7 text-xl font-black">Technical requirements</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li>Use a modern browser and a stable internet connection.</li>
                <li>Questions and the spreadsheet workspace are delivered on-screen only — there is no PDF question paper for this test.</li>
                <li>The timer starts only when you press Start Test.</li>
              </ul>
            </section>
            <StudentTestLaunch testId={test.id} language={route.language} duration={duration} serverError={query.error} />
          </div>
        </div>
      </section>
    </main>
  );
}
function Meta({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/10 p-3"><dt className="text-[10px] font-black uppercase tracking-wide text-slate-300">{label}</dt><dd className="mt-1 font-black">{value}</dd></div>; }

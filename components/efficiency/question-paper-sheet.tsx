import Link from "next/link";
import { QuestionContent } from "@/components/efficiency/question-content";
import { SafeInstructions } from "@/app/typing/word-efficiency/_components/safe-instructions";
import { formatPaperMarks, type QuestionPaper } from "@/lib/question-paper";
import { PrintPaperButton } from "./print-paper-button";

const HINDI_FONTS = "'Nirmala UI', 'Mangal', 'Noto Sans Devanagari', 'Segoe UI', sans-serif";

// The printable question paper (one A4 sheet or more): heading, time and marks, the instructions, then every question
// with its marks. "Download PDF" opens the browser's print window, where Save as PDF makes the file; the browser
// draws Hindi text itself, so it comes out correctly.
export function QuestionPaperSheet({ paper, backHref }: { paper: QuestionPaper; backHref: string }) {
  const minutes = Math.round(paper.durationSeconds / 60);
  const subjectName = paper.subject === "word" ? "MS Word" : "MS Excel";
  return (
    <main className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
      <style>{"@page { size: A4; margin: 14mm; } @media print { body { background: #fff !important; } }"}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Link href={backHref} className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm">← Back</Link>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-slate-600">In the print window choose <b>Save as PDF</b> as the printer.</p>
          <PrintPaperButton />
        </div>
      </div>
      {!paper.ready && paper.isAdmin && (
        <p className="mx-auto mb-4 max-w-[210mm] rounded-lg bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900 print:hidden">
          Preview: students cannot download this paper yet. Turn &quot;Question paper&quot; on in the admin test list after checking the test.
        </p>
      )}
      <article lang={paper.language === "Hindi" ? "hi" : "en"} style={paper.language === "Hindi" ? { fontFamily: HINDI_FONTS } : undefined}
        className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[12mm] text-slate-950 shadow-xl print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-900 pb-3 text-center">
          <p className="text-xs font-black uppercase tracking-[.25em] text-slate-600">Samradhi Classes · sctyping.com</p>
          <h1 className="mt-1 text-2xl font-black">{subjectName} Efficiency Test</h1>
          <p className="mt-0.5 text-lg font-bold">{paper.title}{paper.language === "Hindi" ? " (Hindi)" : ""}</p>
        </header>
        <dl className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-1 border-b border-slate-300 pb-3 text-sm">
          <div><dt className="inline font-bold">Time: </dt><dd className="inline">{minutes} minute{minutes === 1 ? "" : "s"}</dd></div>
          <div><dt className="inline font-bold">Maximum marks: </dt><dd className="inline">{formatPaperMarks(paper.maximumMarks)}</dd></div>
          <div><dt className="inline font-bold">Questions: </dt><dd className="inline">{paper.questions.length}</dd></div>
          {paper.passingMarks != null && <div><dt className="inline font-bold">Passing marks: </dt><dd className="inline">{formatPaperMarks(paper.passingMarks)}</dd></div>}
        </dl>
        {paper.instructions.trim() && (
          <section className="mt-3 text-sm" aria-labelledby="paper-instructions">
            <h2 id="paper-instructions" className="font-black">Instructions</h2>
            <div className="mt-1 [&_ol]:space-y-0.5 [&_p]:leading-6"><SafeInstructions markdown={paper.instructions} /></div>
          </section>
        )}
        <section className="mt-4" aria-labelledby="paper-questions">
          <h2 id="paper-questions" className="sr-only">Questions</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y-2 border-slate-900 text-left">
                <th scope="col" className="w-14 py-1.5 pr-2">Q. No.</th>
                <th scope="col" className="py-1.5 pr-2">Question</th>
                <th scope="col" className="w-16 py-1.5 text-right">Marks</th>
              </tr>
            </thead>
            <tbody>
              {paper.questions.map((question) => (
                <tr key={question.number} className="break-inside-avoid border-b border-slate-300 align-top">
                  <td className="py-2 pr-2 font-bold">{question.number}.</td>
                  <td className="py-2 pr-2">
                    {question.section && <p className="mb-0.5 text-xs font-bold text-slate-600">{question.section}</p>}
                    <QuestionContent text={question.instruction} className="!text-sm !leading-6" />
                  </td>
                  <td className="py-2 text-right font-bold">{formatPaperMarks(question.marks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!paper.questions.length && <p className="py-6 text-center text-sm text-slate-500">This test has no questions yet.</p>}
        </section>
        <p className="mt-5 text-center text-xs text-slate-500">— End of question paper —</p>
      </article>
    </main>
  );
}

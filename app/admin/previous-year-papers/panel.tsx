import { getPreviousYearMap } from "@/lib/previous-year-papers-server";
import { PREVIOUS_YEAR_SECTION_LABEL, type PreviousYearSection } from "@/lib/previous-year-papers";
import { savePreviousYearPaper } from "./actions";

// The "Previous year paper" box on a test's admin page (and on /admin/previous-year-papers): exam name, date and
// the description students see on the highlighted test card and on the Old Exam Papers page.
export async function PreviousYearPaperPanel({ section, testId, returnTo, title, saved, error }: { section: PreviousYearSection; testId: string; returnTo: string; title?: string; saved?: string; error?: string }) {
  const paper = (await getPreviousYearMap(section, [testId])).get(testId);
  return (
    <details id="previous-year" open={!!paper || !!error} className={`rounded-2xl border p-5 ${paper ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <summary className="cursor-pointer text-lg font-black">
        📜 Previous year paper {paper ? <span className="ml-2 rounded-full bg-amber-200 px-2.5 py-1 text-xs text-amber-900">On · {paper.examYear}</span> : <span className="ml-2 text-sm font-bold text-slate-500">(off: click here to mark this test as a real exam paper)</span>}
      </summary>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 font-bold text-red-800">{error}</p>}
      {saved && <p role="status" className="mt-3 rounded-xl bg-green-50 p-3 font-bold text-green-800">{saved}</p>}
      <p className="mt-2 text-sm text-slate-600">
        {title ? <><b>{title}</b> ({PREVIOUS_YEAR_SECTION_LABEL[section]}). </> : null}
        When saved, students see this test in a light gold card with a &quot;Previous Year&quot; badge and your description, and it is listed by year on the Old Exam Papers page.
      </p>
      <form action={savePreviousYearPaper} className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <input type="hidden" name="section" value={section} />
        <input type="hidden" name="testId" value={testId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className="text-sm font-bold text-slate-700">Exam name
          <input name="examName" required maxLength={200} defaultValue={paper?.examName ?? ""} placeholder="RSMSSB Informatics Assistant" className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-bold text-slate-700">Exam date
          <input name="examDate" type="date" defaultValue={paper?.examDate ?? ""} className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-bold text-slate-700">Or only the year
          <input name="examYear" type="number" min={1990} max={2100} defaultValue={paper && !paper.examDate ? paper.examYear : ""} placeholder="2024" className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-bold text-slate-700 md:col-span-3">Description students will see
          <textarea name="description" rows={3} maxLength={2000} defaultValue={paper?.description ?? ""} placeholder="This paper appeared in the 2024 exam (Shift 1). Same questions and marks as the real exam." className="input mt-1 w-full" />
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-3">
          <button name="intent" value="save" className="rounded-xl bg-amber-600 px-5 py-2.5 font-black text-white hover:bg-amber-700">{paper ? "Save changes" : "Mark as previous year paper"}</button>
          {paper && <button name="intent" value="remove" formNoValidate className="rounded-xl border border-red-300 bg-white px-5 py-2.5 font-black text-red-700 hover:bg-red-50">Remove mark (normal test)</button>}
        </div>
      </form>
    </details>
  );
}

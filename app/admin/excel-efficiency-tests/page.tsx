import type { Metadata } from "next";
import Link from "next/link";
import { SafeInstructions } from "@/app/typing/word-efficiency/_components/safe-instructions";
import { BackButton } from "@/app/_components/back-button";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_EXCEL_INSTRUCTIONS, type ExcelQuestion, type ExcelVersion } from "@/lib/excel-efficiency";
import { deleteExcelEfficiencyTest, duplicateExcelEfficiencyTest, saveExcelEfficiencyTest, setExcelEfficiencyStatus } from "./actions";
import { QuestionEditor } from "./question-editor";
import { DeliveryPdfFields } from "../word-efficiency-tests/delivery-pdf-fields";
import { ClearMatterDrafts } from "../word-efficiency-tests/clear-matter-drafts";
import { WorkingMatterXlsxFields } from "./working-matter-xlsx-fields";
import { ExamPatternReference } from "@/components/efficiency/exam-pattern-reference";
import { formatIST } from "@/lib/format-datetime";
import { SearchableList } from "../word-efficiency-tests/searchable-list";

export const metadata: Metadata = { title: "Excel Efficiency Tests | Admin" };
const localDateTime = (value: string | null | undefined) => value ? new Date(value).toISOString().slice(0, 16) : "";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: tests, error } = await supabase.from("excel_efficiency_tests").select("id,slug,title,language,status,current_version_id,current_version_number,updated_at,is_live,live_starts_at,live_ends_at,results_publish_at").order("updated_at", { ascending: false });
  const { data: versions } = await supabase.from("excel_efficiency_versions").select("*");
  const { data: attempts } = await supabase.from("excel_efficiency_attempts").select("id,test_id,status,result,prepared_at,submitted_at,student_id");
  const map = new Map((versions ?? []).map((version) => [version.id, version as ExcelVersion]));
  const editing = (tests ?? []).find((test) => test.id === params.edit);
  const current = editing ? map.get(editing.current_version_id) : undefined;
  const { data: questions } = current ? await supabase.from("excel_efficiency_questions").select("id,question_number,instruction,marks,section,display_order,is_visible,solution,solution_image").eq("version_id", current.id).order("display_order") : { data: [] };
  const { data: gradingRules } = current ? await supabase.from("excel_efficiency_grading_rules").select("question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks").eq("version_id", current.id) : { data: [] };
  const gradingRuleMap = new Map((gradingRules ?? []).map((rule) => [rule.question_id, rule]));
  const initialQuestions: ExcelQuestion[] = (questions ?? []).map((question) => { const rule = gradingRuleMap.get(question.id); return { id: question.id, version_id: current?.id ?? "", question_number: question.question_number, instruction: question.instruction, marks: Number(question.marks), section: question.section, display_order: question.display_order, is_visible: question.is_visible, solution: question.solution ?? null, solution_image: question.solution_image ?? null, gradingRule: rule ? { target: rule.exact_target, expectedOperation: rule.expected_operation, expectedValue: JSON.stringify(rule.expected_value), allocatedMarks: Number(rule.allocated_marks), partialMarks: rule.partial_marks == null ? null : Number(rule.partial_marks) } : null }; });
  const selectedAttempts = editing ? (attempts ?? []).filter((attempt) => attempt.test_id === editing.id) : [];
  // As on the Word page: the list of tests ("Managed tests", English and Hindi apart) and, from Edit or
  // + Create English / Hindi Test, the test's own form.
  const view = editing || params.new ? "design" : "manage";
  const newLanguage = params.language === "Hindi" ? "Hindi" : "English";
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-[1500px]">
        <BackButton href={view === "design" ? "/admin/excel-efficiency-tests" : "/admin"} label={view === "design" ? "Managed tests" : "Admin dashboard"} />
        <header className="mt-4 rounded-3xl bg-gradient-to-r from-slate-950 to-emerald-900 p-7 text-white">
          <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">Administrator · MFA protected</p>
          <h1 className="mt-2 text-3xl font-black">{view === "design" ? (editing ? `Edit ${editing.title}` : `Create ${newLanguage} Excel Efficiency Test`) : "Excel Efficiency Tests"}</h1>
          <p className="mt-2 text-slate-300">Manage immutable questions, individual marks, instructions, duration choices, and the starting spreadsheet.</p>
        </header>
        {params.error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-800">{params.error}</p>}
        {params.saved && <p role="status" className="mt-5 rounded-xl bg-green-50 p-4 font-bold text-green-800">A new immutable test version was saved.<ClearMatterDrafts /></p>}
        {params.deleted && <p role="status" className="mt-5 rounded-xl bg-green-50 p-4 font-bold text-green-800">The test and all database records were permanently deleted.</p>}
        <div className="mt-6 grid gap-6">
          {view === "design" && (
          <section className="rounded-3xl bg-white p-5 shadow sm:p-7">
            <h2 className="text-2xl font-black">{editing ? `Edit ${editing.title}` : "Create Excel Efficiency test"}</h2>
            <ExamPatternReference subject="Excel" />
            <form action={saveExcelEfficiencyTest} className="mt-6 grid gap-5">
              {editing && <input type="hidden" name="testId" value={editing.id} />}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Test title"><input className="input" name="title" defaultValue={current?.title ?? ""} required /></Field>
                <Field label="Language">
                  <select className="input" name="language" defaultValue={current?.language ?? newLanguage}>
                    <option>English</option>
                    <option>Hindi</option>
                  </select>
                </Field>
              </div>
              <Field label="Short description"><textarea className="input min-h-20" name="description" defaultValue={current?.description ?? ""} /></Field>
              <Field label="Instructions (numbered lines and **bold** are supported)"><textarea className="input min-h-52" name="instructions" defaultValue={current?.instructions_markdown ?? DEFAULT_EXCEL_INSTRUCTIONS.English} required /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Passing marks"><input className="input" name="passingMarks" type="number" min="0" step=".01" defaultValue={current?.passing_marks ?? ""} /></Field>
                <Field label="Allowed durations in minutes (comma separated)"><input className="input" name="durationOptions" defaultValue={current?.duration_options?.map((value) => value / 60).join(", ") ?? "20"} required /></Field>
              </div>
              <WorkingMatterXlsxFields initialSnapshot={current?.working_matter_snapshot ?? null} />
              <DeliveryPdfFields subject="excel" defaultOnscreen={(current as { delivery_onscreen?: boolean } | undefined)?.delivery_onscreen !== false} defaultStudentToggle={(current as { student_question_toggle?: boolean } | undefined)?.student_question_toggle !== false} defaultPdf={Boolean(current?.delivery_pdf)} existingPdf={editing && current?.pdf_path ? { testId: editing.id, fileName: current.pdf_file_name ?? "question-paper.pdf", sizeBytes: current.pdf_size_bytes ?? null, pageCount: null, uploadedAt: current.pdf_uploaded_at ?? null } : null} />
              <QuestionEditor initialQuestions={initialQuestions} />
              <fieldset className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <label className="flex items-center gap-2 font-black text-blue-950">
                  <input type="checkbox" name="isLive" defaultChecked={editing?.is_live ?? false} />
                  Free scheduled live test
                </label>
                <p className="mt-1 text-xs text-blue-800">Live tests must be published. Each registered student receives one attempt, between the start and end times below, and sees their own result 15 minutes after they submit.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Field label="Starts"><input className="input" name="startsAt" type="datetime-local" defaultValue={localDateTime(editing?.live_starts_at)} /></Field>
                  <Field label="Ends"><input className="input" name="endsAt" type="datetime-local" defaultValue={localDateTime(editing?.live_ends_at)} /></Field>
                </div>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <button name="intent" value="draft" className="rounded-xl bg-slate-200 px-5 py-3 font-black text-slate-800">Save as Draft</button>
                <button name="intent" value="publish" className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white">Save and Publish</button>
              </div>
            </form>
            {current && <section className="mt-8 rounded-2xl bg-slate-50 p-5"><h3 className="font-black">Instruction preview</h3><div className="mt-3"><SafeInstructions markdown={current.instructions_markdown} /></div></section>}
          </section>
          )}
          {view === "design" && (
            <section id="attempts" className="mt-6 rounded-2xl bg-white p-5 shadow">
              <h2 className="font-black">Attempts and results</h2>
              {editing ? (
                selectedAttempts.length ? (
                  <div className="mt-3 space-y-2">
                    {selectedAttempts.map((attempt, index) => (
                      <article key={`${attempt.student_id}-${attempt.prepared_at}-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm">
                        <strong>Attempt {index + 1}</strong> · {attempt.status} · {attempt.submitted_at ? formatIST(attempt.submitted_at) : "Not submitted"}
                        {["submitted", "completed"].includes(attempt.status) && <Link href={`/admin/excel-efficiency-tests/attempts/${attempt.id}`} className="ml-3 font-black text-emerald-700">{attempt.status === "completed" ? "View result" : "Grade attempt"}</Link>}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm">No attempts for this test.</p>
                )
              ) : (
                <p className="mt-2 text-sm">Select a test to inspect attempts and results.</p>
              )}
            </section>
          )}
          {view === "manage" && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-black">Managed tests</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black shadow">{tests?.length ?? 0}</span>
                <Link href="/admin/excel-efficiency-tests?new=1&language=English" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white shadow hover:bg-blue-600">+ Create English Test</Link>
                <Link href="/admin/excel-efficiency-tests?new=1&language=Hindi" className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-black text-white shadow hover:bg-orange-500">+ Create Hindi Test</Link>
              </div>
            </div>
            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">Database error: {error.message}</p>
            ) : (
              // English and Hindi tests in separate sections, each test one compact row: Edit and Attempts stay on
              // the row, and ▾ More opens the details and the rest (Duplicate, Publish, Archive, Delete).
              <div className="mt-4 grid gap-5 xl:grid-cols-2">
                {(["English", "Hindi"] as const).map((language) => {
                  const languageTests = (tests ?? []).filter((test) => (test.language === "Hindi" ? "Hindi" : "English") === language);
                  return (
                    <section key={language} data-test-language={language} className={`rounded-2xl border-t-4 bg-white/60 p-4 shadow-sm ${language === "Hindi" ? "border-orange-500" : "border-blue-600"}`}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-lg font-black">{language} Efficiency Tests</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${language === "Hindi" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}`}>{languageTests.length}</span>
                      </div>
                      <SearchableList placeholder={`Search ${language} tests`} emptyLabel={`No ${language} Excel Efficiency tests yet.`} maxHeightClassName="max-h-[460px]" items={languageTests.map((test) => {
                        const version = map.get(test.current_version_id);
                        const count = (attempts ?? []).filter((attempt) => attempt.test_id === test.id).length;
                        const hasAttempts = count > 0;
                        return { key: test.id, searchText: `${test.title} ${test.language} ${test.status}`, node: (
                          <article className="rounded-xl bg-white px-4 py-3 shadow-sm">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                              <div className="min-w-[13rem] flex-1">
                                <h4 className="truncate font-black">{test.title}</h4>
                                <p className="text-xs text-slate-500">{version?.question_count ?? 0} questions · {version?.maximum_marks ?? 0} marks · {count} attempt{count === 1 ? "" : "s"}</p>
                              </div>
                              {test.is_live && <span title={`${formatIST(test.live_starts_at)} → ${formatIST(test.live_ends_at)}`} className="cursor-help rounded-full bg-red-100 px-2 py-1 text-[10px] font-black text-red-700">LIVE</span>}
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${test.status === "published" ? "bg-emerald-100 text-emerald-800" : test.status === "archived" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-800"}`}>{test.status}</span>
                              <div className="flex items-center gap-1.5">
                                <Link href={`?edit=${test.id}`} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-800">Edit</Link>
                                <Link href={`?edit=${test.id}#attempts`} className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-800">Attempts</Link>
                              </div>
                            </div>
                            <details className="group mt-2">
                              <summary aria-label={`More for ${test.title}: details, delete and other actions`} title="More: details, delete and other actions" className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                                <span className="transition-transform group-open:rotate-180" aria-hidden>▾</span> More
                              </summary>
                              <div className="mt-3 border-t pt-3">
                                <p className="text-xs text-slate-500">{test.language} · Version {test.current_version_number} · {(version as { delivery_onscreen?: boolean } | undefined)?.delivery_onscreen === false ? "PDF only" : version?.delivery_pdf ? "On-screen + PDF" : "On-screen"} · updated {formatIST(test.updated_at)}</p>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <form action={duplicateExcelEfficiencyTest}><input type="hidden" name="testId" value={test.id} /><button className="w-full rounded-lg bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-800">Duplicate</button></form>
                                  {test.status === "archived" ? <Status id={test.id} status="unpublished" label="Restore / Unarchive" /> : test.status === "published" ? <Status id={test.id} status="unpublished" label="Unpublish" /> : <Status id={test.id} status="published" label="Publish" />}
                                  <Status id={test.id} status="archived" label="Archive" />
                                  <form action={deleteExcelEfficiencyTest}>
                                    <input type="hidden" name="testId" value={test.id} />
                                    <button disabled={hasAttempts} title={hasAttempts ? "Tests with existing attempts cannot be deleted — archive it instead." : "Permanently delete this test"} className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 disabled:cursor-not-allowed disabled:opacity-50">Delete</button>
                                  </form>
                                </div>
                              </div>
                            </details>
                          </article>
                        ) };
                      })} />
                    </section>
                  );
                })}
              </div>
            )}
          </section>
          )}
        </div>
      </div>
    </main>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-bold text-slate-700"><span>{label}</span>{children}</label>; }
function Status({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setExcelEfficiencyStatus}>
      <input type="hidden" name="testId" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`w-full rounded-lg px-3 py-2 text-sm font-bold ${status === "archived" ? "bg-amber-500 text-slate-950" : "bg-slate-100"}`}>{label}</button>
    </form>
  );
}

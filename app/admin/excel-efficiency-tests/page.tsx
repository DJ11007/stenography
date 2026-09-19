import type { Metadata } from "next";
import Link from "next/link";
import { SafeInstructions } from "@/app/typing/word-efficiency/_components/safe-instructions";
import { BackButton } from "@/app/_components/back-button";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_EXCEL_INSTRUCTIONS, type ExcelQuestion, type ExcelVersion } from "@/lib/excel-efficiency";
import { deleteExcelEfficiencyTest, duplicateExcelEfficiencyTest, saveExcelEfficiencyTest, setExcelEfficiencyStatus } from "./actions";
import { QuestionEditor } from "./question-editor";
import { WorkingMatterXlsxFields } from "./working-matter-xlsx-fields";
import { ExamPatternReference } from "@/components/efficiency/exam-pattern-reference";
import { formatIST } from "@/lib/format-datetime";

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
  const { data: questions } = current ? await supabase.from("excel_efficiency_questions").select("id,question_number,instruction,marks,section,display_order,is_visible").eq("version_id", current.id).order("display_order") : { data: [] };
  const { data: gradingRules } = current ? await supabase.from("excel_efficiency_grading_rules").select("question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks").eq("version_id", current.id) : { data: [] };
  const gradingRuleMap = new Map((gradingRules ?? []).map((rule) => [rule.question_id, rule]));
  const initialQuestions: ExcelQuestion[] = (questions ?? []).map((question) => { const rule = gradingRuleMap.get(question.id); return { id: question.id, version_id: current?.id ?? "", question_number: question.question_number, instruction: question.instruction, marks: Number(question.marks), section: question.section, display_order: question.display_order, is_visible: question.is_visible, gradingRule: rule ? { target: rule.exact_target, expectedOperation: rule.expected_operation, expectedValue: JSON.stringify(rule.expected_value), allocatedMarks: Number(rule.allocated_marks), partialMarks: rule.partial_marks == null ? null : Number(rule.partial_marks) } : null }; });
  const selectedAttempts = editing ? (attempts ?? []).filter((attempt) => attempt.test_id === editing.id) : [];
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-[1500px]">
        <BackButton href="/admin" label="Admin dashboard" />
        <header className="mt-4 rounded-3xl bg-gradient-to-r from-slate-950 to-emerald-900 p-7 text-white">
          <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">Administrator · MFA protected</p>
          <h1 className="mt-2 text-3xl font-black">Excel Efficiency Tests</h1>
          <p className="mt-2 text-slate-300">Manage immutable questions, individual marks, instructions, duration choices, and the starting spreadsheet.</p>
        </header>
        {params.error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-800">{params.error}</p>}
        {params.saved && <p role="status" className="mt-5 rounded-xl bg-green-50 p-4 font-bold text-green-800">A new immutable test version was saved.</p>}
        {params.deleted && <p role="status" className="mt-5 rounded-xl bg-green-50 p-4 font-bold text-green-800">The test and all database records were permanently deleted.</p>}
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,.85fr)]">
          <section className="rounded-3xl bg-white p-5 shadow sm:p-7">
            <h2 className="text-2xl font-black">{editing ? `Edit ${editing.title}` : "Create Excel Efficiency test"}</h2>
            <ExamPatternReference subject="Excel" />
            <form action={saveExcelEfficiencyTest} className="mt-6 grid gap-5">
              {editing && <input type="hidden" name="testId" value={editing.id} />}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Test title"><input className="input" name="title" defaultValue={current?.title ?? ""} required /></Field>
                <Field label="Language">
                  <select className="input" name="language" defaultValue={current?.language ?? "English"}>
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
              <QuestionEditor initialQuestions={initialQuestions} />
              <fieldset className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <label className="flex items-center gap-2 font-black text-blue-950">
                  <input type="checkbox" name="isLive" defaultChecked={editing?.is_live ?? false} />
                  Free scheduled live test
                </label>
                <p className="mt-1 text-xs text-blue-800">Live tests must be published. Each registered student receives one attempt; results additionally unlock at the publication time below (once you've also published grading for that attempt). The three fields below are only used when the checkbox above is checked.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Field label="Starts"><input className="input" name="startsAt" type="datetime-local" defaultValue={localDateTime(editing?.live_starts_at)} /></Field>
                  <Field label="Ends"><input className="input" name="endsAt" type="datetime-local" defaultValue={localDateTime(editing?.live_ends_at)} /></Field>
                  <Field label="Publish results"><input className="input" name="resultsPublishAt" type="datetime-local" defaultValue={localDateTime(editing?.results_publish_at)} /></Field>
                </div>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <button name="intent" value="draft" className="rounded-xl bg-slate-200 px-5 py-3 font-black text-slate-800">Save as Draft</button>
                <button name="intent" value="publish" className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white">Save and Publish</button>
              </div>
            </form>
            {current && <section className="mt-8 rounded-2xl bg-slate-50 p-5"><h3 className="font-black">Instruction preview</h3><div className="mt-3"><SafeInstructions markdown={current.instructions_markdown} /></div></section>}
          </section>
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">Managed tests</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black shadow">{tests?.length ?? 0}</span>
            </div>
            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">Database error: {error.message}</p>
            ) : (
              <div className="mt-4 space-y-4">
                {(tests ?? []).map((test) => {
                  const version = map.get(test.current_version_id);
                  const count = (attempts ?? []).filter((attempt) => attempt.test_id === test.id).length;
                  const hasAttempts = count > 0;
                  return (
                    <article key={test.id} className="rounded-2xl bg-white p-5 shadow">
                      <div className="flex justify-between gap-3">
                        <div>
                          <h3 className="font-black">{test.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">{test.language} · Version {test.current_version_number} · {version?.question_count ?? 0} questions · {version?.maximum_marks ?? 0} marks</p>
                        </div>
                        <span className="flex h-fit shrink-0 items-center gap-1.5">
                          {test.is_live && <span title={`${formatIST(test.live_starts_at)} → ${formatIST(test.live_ends_at)} · results ${formatIST(test.results_publish_at)}`} className="cursor-help rounded-full bg-red-100 px-2 py-1 text-[10px] font-black text-red-700">LIVE</span>}
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black capitalize">{test.status}</span>
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">{count} attempt{count === 1 ? "" : "s"} · On-screen delivery</p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Link href={`?edit=${test.id}`} className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-800">Edit / Preview</Link>
                        <Link href={`?edit=${test.id}#attempts`} className="rounded-lg bg-violet-50 px-3 py-2 text-center text-sm font-bold text-violet-800">View Attempts</Link>
                        <form action={duplicateExcelEfficiencyTest}><input type="hidden" name="testId" value={test.id} /><button className="w-full rounded-lg bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-800">Duplicate</button></form>
                        {test.status === "archived" ? <Status id={test.id} status="unpublished" label="Restore / Unarchive" /> : test.status === "published" ? <Status id={test.id} status="unpublished" label="Unpublish" /> : <Status id={test.id} status="published" label="Publish" />}
                        <Status id={test.id} status="archived" label="Archive" />
                        <form action={deleteExcelEfficiencyTest} onSubmit={hasAttempts ? (event) => event.preventDefault() : undefined}>
                          <input type="hidden" name="testId" value={test.id} />
                          <button disabled={hasAttempts} title={hasAttempts ? "Tests with existing attempts cannot be deleted — archive it instead." : "Permanently delete this test"} className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 disabled:cursor-not-allowed disabled:opacity-50">Delete</button>
                        </form>
                      </div>
                    </article>
                  );
                })}
                {!tests?.length && <p className="rounded-2xl border border-dashed bg-white p-8 text-center text-slate-500">No Excel Efficiency tests yet.</p>}
              </div>
            )}
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
          </section>
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

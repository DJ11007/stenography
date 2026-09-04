import type { Metadata } from "next";
import Link from "next/link";
import { SafeInstructions } from "@/app/typing/word-efficiency/_components/safe-instructions";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_WORD_INSTRUCTIONS,
  type WordQuestion,
  type WordVersion,
} from "@/lib/word-efficiency";
import {
  duplicateWordEfficiencyTest,
  saveWordEfficiencyTest,
  setWordEfficiencyStatus,
  retryWordEfficiencyStorageCleanup,
} from "./actions";
import { QuestionEditor } from "./question-editor";
import { DeliveryPdfFields } from "./delivery-pdf-fields";
import { WorkingMatterDocxFields } from "./working-matter-docx-fields";
import { SaveLocalDraftButton } from "./draft-preserver";
import{PermanentDeleteDangerZone}from"./permanent-delete-danger-zone";
export const metadata: Metadata = { title: "Word Efficiency Tests | Admin" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: tests, error } = await supabase
    .from("word_efficiency_tests")
    .select(
      "id,slug,title,language,status,current_version_id,current_version_number,updated_at",
    )
    .order("updated_at", { ascending: false });
  const { data: versions } = await supabase.from("word_efficiency_versions").select("*");
  const { data: attempts } = await supabase
    .from("word_efficiency_attempts")
    .select("id,test_id,status,result,prepared_at,submitted_at,student_id");
  const{data:cleanupRows}=await supabase.from("word_efficiency_storage_cleanup").select("audit_id,status").in("status",["pending","failed"]);
  const cleanupAudits=[...new Set((cleanupRows??[]).map(row=>row.audit_id))];
  const map = new Map(
    (versions ?? []).map((version) => [version.id, version as WordVersion]),
  );
  const editing = (tests ?? []).find((test) => test.id === params.edit);
  const current = editing ? map.get(editing.current_version_id) : undefined;
  const { data: questions } = current
    ? await supabase
        .from("word_efficiency_questions")
        .select(
          "id,question_number,instruction,marks,section,display_order,is_visible",
        )
        .eq("version_id", current.id)
        .order("display_order")
    : { data: [] };
  const {data:gradingRules}=current?await supabase.from("word_efficiency_grading_rules").select("question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks").eq("version_id",current.id):{data:[]};
  const gradingRuleMap=new Map((gradingRules??[]).map(rule=>[rule.question_id,rule]));
  const initialQuestions: WordQuestion[] = (questions ?? []).map(
    (question) => {const rule=gradingRuleMap.get(question.id);return({
      id: question.id,
      number: question.question_number,
      instruction: question.instruction,
      marks: Number(question.marks),
      section: question.section,
      display_order: question.display_order,
      is_visible: question.is_visible,
      gradingRule:rule?{target:rule.exact_target,expectedOperation:rule.expected_operation,expectedValue:JSON.stringify(rule.expected_value),allocatedMarks:Number(rule.allocated_marks),partialMarks:rule.partial_marks==null?null:Number(rule.partial_marks)}:null,
    })},
  );
  const selectedAttempts = editing
    ? (attempts ?? []).filter((attempt) => attempt.test_id === editing.id)
    : [];
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/admin" className="font-black text-blue-700">
          ← Admin dashboard
        </Link>
        <header className="mt-4 rounded-3xl bg-gradient-to-r from-slate-950 to-blue-900 p-7 text-white">
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">
            Administrator · MFA protected
          </p>
          <h1 className="mt-2 text-3xl font-black">Word Efficiency Tests</h1>
          <p className="mt-2 text-slate-300">
            Manage immutable questions, individual marks, instructions, duration
            choices and private PDFs.
          </p>
        </header>
        {params.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-800"
          >
            {params.error}
          </p>
        )}
        {params.saved && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-green-50 p-4 font-bold text-green-800"
          >
            A new immutable test version was saved.
          </p>
        )}
        {params.deleted&&<p role="status" className="mt-5 rounded-xl bg-green-50 p-4 font-bold text-green-800">The test and all database records were permanently deleted.{params.cleanup?` ${params.cleanup} storage object cleanup operation(s) remain recorded for retry.`:" Queued storage objects were removed or safely retained because they remain shared."}</p>}
        {params.cleanupRetried&&<p role="status" className="mt-5 rounded-xl bg-blue-50 p-4 font-bold text-blue-800">Storage cleanup retry finished.{params.cleanup?` ${params.cleanup} object(s) still require another retry.`:" All queued objects are removed."}</p>}
        {cleanupAudits.length>0&&<section className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4"><h2 className="font-black text-amber-950">Pending deleted-test storage cleanup</h2><p className="mt-1 text-sm text-amber-800">Database content remains permanently deleted. Retry only the isolated storage jobs recorded during deletion.</p><div className="mt-3 flex flex-wrap gap-2">{cleanupAudits.map(auditId=><form action={retryWordEfficiencyStorageCleanup} key={auditId}><input type="hidden" name="auditId" value={auditId}/><button className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-black text-white">Retry orphan file cleanup</button></form>)}</div></section>}
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,.85fr)]">
          <section className="rounded-3xl bg-white p-5 shadow sm:p-7">
            <h2 className="text-2xl font-black">
              {editing
                ? `Edit ${editing.title}`
                : "Create Word Efficiency test"}
            </h2>
            <form action={saveWordEfficiencyTest} className="mt-6 grid gap-5">
              {editing && (
                <input type="hidden" name="testId" value={editing.id} />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Test title">
                  <input
                    className="input"
                    name="title"
                    defaultValue={current?.title ?? ""}
                    required
                  />
                </Field>
                <Field label="Language">
                  <select
                    className="input"
                    name="language"
                    defaultValue={current?.language ?? "English"}
                  >
                    <option>English</option>
                    <option>Hindi</option>
                  </select>
                </Field>
              </div>
              <Field label="Short description">
                <textarea
                  className="input min-h-20"
                  name="description"
                  defaultValue={current?.description ?? ""}
                />
              </Field>
              <Field label="Instructions (numbered lines and **bold** are supported)">
                <textarea
                  className="input min-h-52"
                  name="instructions"
                  defaultValue={
                    current?.instructions_markdown ??
                    DEFAULT_WORD_INSTRUCTIONS.English
                  }
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Passing marks">
                  <input
                    className="input"
                    name="passingMarks"
                    type="number"
                    min="0"
                    step=".01"
                    defaultValue={current?.passing_marks ?? ""}
                  />
                </Field>
                <Field label="Allowed durations in minutes (comma separated)">
                  <input
                    className="input"
                    name="durationOptions"
                    defaultValue={
                      current?.duration_options
                        ?.map((value) => value / 60)
                        .join(", ") ?? "10"
                    }
                    required
                  />
                </Field>
              </div>
              <DeliveryPdfFields
                defaultOnscreen={current?.delivery_onscreen ?? true}
                defaultPdf={current?.delivery_pdf ?? false}
                existingPdf={
                  editing && current?.pdf_file_name
                    ? {
                        testId: editing.id,
                        fileName: current.pdf_file_name,
                        sizeBytes: current.pdf_size_bytes,
                        pageCount: current.pdf_page_count,
                        uploadedAt: current.pdf_uploaded_at,
                      }
                    : null
                }
              />
              <WorkingMatterDocxFields initialSnapshot={current?.working_matter_snapshot??null}/>
              {/* "Real file delivery (optional)" was removed from this form at the
                  admin's request. Confirmed zero existing test versions had it
                  enabled (delivery_realfile=true) before removing the checkbox, so
                  no already-created test silently loses this setting on its next
                  edit-save -- form.get("deliveryRealFile") simply always reads
                  absent now, same as it always defaulted to for every test. */}
              <QuestionEditor initialQuestions={initialQuestions} />
              <div className="grid gap-3 sm:grid-cols-2">
                <SaveLocalDraftButton />
                <button
                  name="intent"
                  value="publish"
                  className="rounded-xl bg-blue-700 px-5 py-3 font-black text-white"
                >
                  Save and Publish
                </button>
              </div>
            </form>
            {current && (
              <section className="mt-8 rounded-2xl bg-slate-50 p-5">
                <h3 className="font-black">Instruction preview</h3>
                <div className="mt-3">
                  <SafeInstructions markdown={current.instructions_markdown} />
                </div>
              </section>
            )}
          </section>
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">Managed tests</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black shadow">
                {tests?.length ?? 0}
              </span>
            </div>
            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">
                Database error: {error.message}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {(tests ?? []).map((test) => {
                  const version = map.get(test.current_version_id);
                  const count = (attempts ?? []).filter(
                    (attempt) => attempt.test_id === test.id,
                  ).length;
                  const testVersions=(versions??[]).filter(item=>item.test_id===test.id);
                  const testAttempts=(attempts??[]).filter(item=>item.test_id===test.id);
                  const activeAttemptCount=testAttempts.filter(item=>["prepared","active","paused"].includes(item.status)).length;
                  const resultCount=testAttempts.filter(item=>["submitted","completed"].includes(item.status)).length;
                  const fileCount=new Set(testVersions.flatMap(item=>[item.pdf_path,item.working_matter_snapshot?.source?.storagePath].filter(Boolean))).size;
                  return (
                    <article
                      key={test.id}
                      className="rounded-2xl bg-white p-5 shadow"
                    >
                      <div className="flex justify-between gap-3">
                        <div>
                          <h3 className="font-black">{test.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {test.language} · Version{" "}
                            {test.current_version_number} ·{" "}
                            {version?.question_count ?? 0} questions ·{" "}
                            {version?.maximum_marks ?? 0} marks
                          </p>
                        </div>
                        <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black capitalize">
                          {test.status}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        {count} attempt{count === 1 ? "" : "s"} ·{" "}
                        {[
                          version?.delivery_onscreen && "On-screen",
                          version?.delivery_pdf && "PDF",
                        ]
                          .filter(Boolean)
                          .join(" + ") || "Not ready"}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Link
                          href={`?edit=${test.id}`}
                          className="rounded-lg bg-blue-50 px-3 py-2 text-center text-sm font-bold text-blue-800"
                        >
                          Edit / Preview
                        </Link>
                        <Link
                          href={`?edit=${test.id}#attempts`}
                          className="rounded-lg bg-violet-50 px-3 py-2 text-center text-sm font-bold text-violet-800"
                        >
                          View Attempts
                        </Link>
                        <Link
                          href={`/admin/word-efficiency-tests/${test.id}/model-answer`}
                          className="rounded-lg bg-amber-50 px-3 py-2 text-center text-sm font-bold text-amber-800"
                        >
                          Model Answer
                        </Link>
                        <form action={duplicateWordEfficiencyTest}>
                          <input type="hidden" name="testId" value={test.id} />
                          <button className="w-full rounded-lg bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-800">
                            Duplicate
                          </button>
                        </form>
                        {test.status === "archived" ? <Status id={test.id} status="unpublished" label="Restore / Unarchive"/> : test.status === "published" ? (
                          <Status
                            id={test.id}
                            status="unpublished"
                            label="Unpublish"
                          />
                        ) : (
                          <Status
                            id={test.id}
                            status="published"
                            label="Publish"
                          />
                        )}
                        <Status
                          id={test.id}
                          status="archived"
                          label="Archive"
                        />
                        <PermanentDeleteDangerZone impact={{testId:test.id,title:test.title,status:test.status,versionCount:testVersions.length,attemptCount:testAttempts.length,activeAttemptCount,resultCount,fileCount,requestId:crypto.randomUUID()}}/>
                      </div>
                    </article>
                  );
                })}
                {!tests?.length && (
                  <p className="rounded-2xl border border-dashed bg-white p-8 text-center text-slate-500">
                    No Word Efficiency tests yet.
                  </p>
                )}
              </div>
            )}
            <section
              id="attempts"
              className="mt-6 rounded-2xl bg-white p-5 shadow"
            >
              <h2 className="font-black">Attempts and results</h2>
              {editing ? (
                selectedAttempts.length ? (
                  <div className="mt-3 space-y-2">
                    {selectedAttempts.map((attempt, index) => (
                      <article
                        key={`${attempt.student_id}-${attempt.prepared_at}-${index}`}
                        className="rounded-lg bg-slate-50 p-3 text-sm"
                      >
                        <strong>Attempt {index + 1}</strong> · {attempt.status}{" "}
                        ·{" "}
                        {attempt.submitted_at
                          ? new Date(attempt.submitted_at).toLocaleString()
                          : "Not submitted"}
                        {(["submitted","completed"].includes(attempt.status))&&<Link href={`/admin/word-efficiency-tests/attempts/${attempt.id}`} className="ml-3 font-black text-blue-700">{attempt.status==="completed"?"View result":"Grade attempt"}</Link>}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm">No attempts for this test.</p>
                )
              ) : (
                <p className="mt-2 text-sm">
                  Select a test to inspect attempts and results.
                </p>
              )}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Status({
  id,
  status,
  label,
}: {
  id: string;
  status: string;
  label: string;
}) {
  return (
    <form action={setWordEfficiencyStatus}>
      <input type="hidden" name="testId" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`w-full rounded-lg px-3 py-2 text-sm font-bold ${status==="archived"?"bg-amber-500 text-slate-950":"bg-slate-100"}`}>
        {label}
      </button>
    </form>
  );
}

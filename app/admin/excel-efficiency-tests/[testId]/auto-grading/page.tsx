import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButton } from "@/app/_components/back-button";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { regradeExcelEfficiencyAttempts, setExcelEfficiencyAutoPublish } from "./actions";

export const metadata: Metadata = { title: "Excel Auto-grading | Admin" };

type QuestionCheck = { number: number; hasRule: boolean; allocatedMarks: number | null; modelGets: number | null; ok: boolean };
type Check = { versionId: string; hasModelAnswer: boolean; ready: boolean; questions: QuestionCheck[] };

function Notice({ tone, children }: { tone: "green" | "red"; children: React.ReactNode }) {
  return <p role={tone === "red" ? "alert" : "status"} className={`mt-5 rounded-xl p-4 font-bold ${tone === "red" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{children}</p>;
}

export default async function ExcelAutoGradingPage({ params, searchParams }: { params: Promise<{ testId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const { testId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: test } = await supabase.from("excel_efficiency_tests").select("id,auto_publish_results,current_version_id").eq("id", testId).maybeSingle();
  if (!test) notFound();
  const { data: version } = test.current_version_id ? await supabase.from("excel_efficiency_versions").select("title").eq("id", test.current_version_id).maybeSingle() : { data: null };
  const { data, error } = await supabase.rpc("check_excel_efficiency_auto_grading", { p_test_id: testId });
  const check = (error ? null : data) as Check | null;
  const enabled = Boolean(test.auto_publish_results);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/admin/excel-efficiency-tests" label="Excel Efficiency tests" />
        <header className="mt-4 rounded-3xl bg-gradient-to-r from-slate-950 to-emerald-900 p-7 text-white">
          <p className="text-xs font-black uppercase tracking-wider text-emerald-300">Automatic grading</p>
          <h1 className="mt-2 text-3xl font-black">{version?.title ?? "Excel Efficiency test"}</h1>
          <p className="mt-2 text-slate-300">Marks are worked out from the rules built from your Model Answer, the moment a student submits. No AI is involved.</p>
        </header>

        {query.error && <Notice tone="red">{query.error}</Notice>}
        {query.enabled && <Notice tone="green">Automatic publishing is ON. New submissions are published to students as soon as they are scored.</Notice>}
        {query.disabled && <Notice tone="green">Automatic publishing is OFF. Submissions wait for a teacher to publish them.</Notice>}
        {query.regraded !== undefined && <Notice tone="green">Re-grade finished: {query.regraded} attempt(s) checked, {query.changed ?? "0"} question score(s) changed.</Notice>}

        <section className="mt-6 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-black">Step 1 · Check the rules</h2>
          <p className="mt-1 text-sm text-slate-600">Your own Model Answer is run through its own rules. Every question must earn its full marks, otherwise no student could ever earn them either.</p>
          {!check ? (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800">The check could not run{error ? `: ${error.message}` : "."}</p>
          ) : (
            <>
              {!check.hasModelAnswer && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">No Model Answer is saved for this test yet. Solve the paper on the <a className="underline" href={`/admin/excel-efficiency-tests/${testId}/model-answer`}>Model Answer page</a> first.</p>}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead><tr className="bg-slate-100"><th className="p-3">Question</th><th className="p-3">Grading rule</th><th className="p-3">Marks the rules carry</th><th className="p-3">Model Answer earns</th><th className="p-3">Result</th></tr></thead>
                  <tbody>
                    {check.questions.map((question) => (
                      <tr key={question.number} className="border-b">
                        <td className="p-3 font-black">Q{question.number}</td>
                        <td className="p-3">{question.hasRule ? "Yes" : <span className="font-bold text-red-700">Missing</span>}</td>
                        <td className="p-3">{question.allocatedMarks ?? "—"}</td>
                        <td className="p-3">{question.modelGets ?? "—"}</td>
                        <td className="p-3">{question.ok ? <span className="font-black text-green-700">OK</span> : <span className="font-black text-red-700">Needs fixing</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={`mt-4 rounded-xl p-4 text-sm font-bold ${check.ready ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>
                {check.ready ? "All questions pass. This test can be graded and published automatically." : "Not ready. Fix the rows marked above on the Model Answer page (a missing rule, rules that do not carry all of the question's marks, or a rule the Model Answer itself does not satisfy), then check again."}
              </p>
            </>
          )}
        </section>

        <section className="mt-5 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-black">Step 2 · Publish results automatically</h2>
          <p className="mt-1 text-sm text-slate-600">When ON, a student sees their marks and result straight after submitting. A submission whose questions do not all have rules still waits for you. You can still adjust any single question afterwards.</p>
          <p className="mt-3 text-sm font-bold">Currently: <span className={enabled ? "text-green-700" : "text-slate-700"}>{enabled ? "ON" : "OFF"}</span></p>
          <form action={setExcelEfficiencyAutoPublish} className="mt-3">
            <input type="hidden" name="testId" value={test.id} />
            <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
            <button disabled={!enabled && !check?.ready} className="rounded-lg bg-emerald-700 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{enabled ? "Turn automatic publishing OFF" : "Turn automatic publishing ON"}</button>
            {!enabled && !check?.ready && <span className="ml-3 text-sm text-slate-500">Available once Step 1 passes.</span>}
          </form>
        </section>

        {check && (
          <section className="mt-5 rounded-2xl border bg-white p-6">
            <h2 className="text-xl font-black">Re-grade after fixing a rule</h2>
            <p className="mt-1 text-sm text-slate-600">Marks every submitted attempt again with the current rules. Marks a teacher gave by hand are never changed; only automatically scored questions are, and published results get their totals refreshed.</p>
            <form action={regradeExcelEfficiencyAttempts} className="mt-3">
              <input type="hidden" name="testId" value={test.id} />
              <input type="hidden" name="versionId" value={check.versionId} />
              <button className="rounded-lg bg-slate-800 px-5 py-3 font-black text-white">Re-grade automatically scored attempts</button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButton } from "@/app/_components/back-button";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SHEET_SETTINGS, type ExcelDocument, type SheetCell } from "@/lib/excel-document";
import { ModelAnswerEditor } from "./model-answer-editor";

export const metadata: Metadata = { title: "Excel Model Answer | Admin" };

// The sheet a student starts from (what prepare_excel_efficiency_attempt makes of the working sheet).
function startingSheet(matter: Record<string, unknown>): ExcelDocument {
  const merges = Array.isArray(matter.merges) ? matter.merges.filter((range): range is string => typeof range === "string" && /^[A-Z]{1,2}[0-9]{1,3}:[A-Z]{1,2}[0-9]{1,3}$/.test(range)) : [];
  return { schemaVersion: "3" as const, rows: Number(matter.rows) || 30, cols: Number(matter.cols) || 10, cells: (matter.cells ?? {}) as Record<string, SheetCell>, merges, sheet: { ...DEFAULT_SHEET_SETTINGS }, operations: [] as string[], savedAt: "1970-01-01T00:00:00.000Z" };
}

const MIGRATION_FILE = "supabase/migrations/202610291000_excel_efficiency_model_answer_and_auto_grading.sql";

function MigrationNotice({ testId, detail }: { testId: string; detail: string }) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/admin/excel-efficiency-tests" label="Excel Efficiency tests" />
        <section role="alert" className="mt-4 rounded-3xl border border-amber-300 bg-amber-50 p-7 text-amber-950">
          <h1 className="text-2xl font-black">One database update is needed first</h1>
          <p className="mt-3">The Excel Model Answer and Auto-grading pages need a database update that has not been run on this database yet.</p>
          <ol className="mt-4 list-decimal space-y-2 pl-6">
            <li>Open Supabase → <strong>SQL Editor</strong> → <strong>New query</strong>.</li>
            <li>Open the file <code className="break-all rounded bg-white px-1.5 py-0.5 font-bold">{MIGRATION_FILE}</code> from the project, copy all of it and paste it in.</li>
            <li>Press <strong>Run</strong>. It is safe to run twice.</li>
            <li>Come back to this page and reload it.</li>
          </ol>
          <p className="mt-4 text-sm">Test: {testId}</p>
          <p className="mt-1 break-words text-sm text-amber-900">What the database said: {detail}</p>
        </section>
      </div>
    </main>
  );
}

export default async function ExcelModelAnswerPage({ params }: { params: Promise<{ testId: string }> }) {
  await requireAdmin();
  const { testId } = await params;
  const supabase = await createClient();
  const { data: test } = await supabase.from("excel_efficiency_tests").select("id,current_version_id").eq("id", testId).maybeSingle();
  if (!test?.current_version_id) notFound();
  const { data: version, error: versionError } = await supabase.from("excel_efficiency_versions").select("id,title,working_matter_snapshot,model_answer_snapshot").eq("id", test.current_version_id).maybeSingle();
  // The page needs migration 202610291000 (the model_answer_snapshot column and the rules' read access). Without it
  // the query fails and the page used to answer "404"; say what is missing instead.
  if (versionError) return <MigrationNotice testId={test.id} detail={versionError.message} />;
  if (!version) notFound();
  const { data: questions } = await supabase.from("excel_efficiency_questions").select("id,question_number,instruction,marks").eq("version_id", version.id).order("display_order");
  const { data: rules, error: rulesError } = await supabase.from("excel_efficiency_grading_rules").select("question_id").eq("version_id", version.id);
  if (rulesError) return <MigrationNotice testId={test.id} detail={rulesError.message} />;
  const withRules = new Set((rules ?? []).map((rule) => rule.question_id));

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-3">
      <div className="mx-auto max-w-[1600px]">
        <BackButton href={`/admin/excel-efficiency-tests?edit=${test.id}`} label={version.title} />
        <ModelAnswerEditor
          versionId={version.id}
          original={startingSheet(version.working_matter_snapshot as Record<string, unknown>)}
          initialDocument={version.model_answer_snapshot}
          autoGradingHref={`/admin/excel-efficiency-tests/${test.id}/auto-grading`}
          questions={(questions ?? []).map((question) => ({ id: question.id, number: question.question_number, instruction: question.instruction ?? "", marks: Number(question.marks), graded: withRules.has(question.id) }))}
        />
      </div>
    </main>
  );
}

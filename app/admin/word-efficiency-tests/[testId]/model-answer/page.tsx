import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModelAnswerEditor } from "./model-answer-editor";

export const metadata: Metadata = { title: "Model Answer | Admin" };

export default async function ModelAnswerPage({ params }: { params: Promise<{ testId: string }> }) {
  await requireAdmin();
  const { testId } = await params;
  const supabase = await createClient();
  const { data: test } = await supabase.from("word_efficiency_tests").select("id,title,current_version_id").eq("id", testId).maybeSingle();
  if (!test?.current_version_id) notFound();
  const { data: version } = await supabase.from("word_efficiency_versions").select("id,working_matter_snapshot,model_answer_snapshot,editor_capabilities").eq("id", test.current_version_id).maybeSingle();
  if (!version) notFound();
  const { data: questions } = await supabase.from("word_efficiency_questions").select("id,question_number,instruction,marks").eq("version_id", version.id).order("display_order");
  const { data: gradingRules } = await supabase.from("word_efficiency_grading_rules").select("question_id,exact_target,expected_value,allocated_marks,additional_criteria").eq("version_id", version.id);
  const gradingRuleMap = new Map((gradingRules ?? []).map((rule) => [rule.question_id, rule]));

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-[1600px]">
        <Link href={`/admin/word-efficiency-tests?edit=${test.id}`} className="font-black text-blue-700">← {test.title}</Link>
        <header className="mt-4 rounded-3xl bg-gradient-to-r from-slate-950 to-blue-900 p-7 text-white">
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Administrator · Model Answer</p>
          <h1 className="mt-2 text-3xl font-black">Solve the Question Paper</h1>
          <p className="mt-2 max-w-3xl text-slate-300">
            Answer every question here, exactly as you want a student to. Every change you make is detected automatically below — assign each one to the question it answers, and a student earns full marks only when their final document matches your answer exactly for every change assigned to that question.
          </p>
        </header>
        <ModelAnswerEditor
          versionId={version.id}
          original={version.working_matter_snapshot}
          initialDocument={version.model_answer_snapshot}
          capabilities={version.editor_capabilities}
          questions={(questions ?? []).map((question) => {
            const rule = gradingRuleMap.get(question.id);
            const existingCriteria = rule ? [{ target: rule.exact_target, expectedValue: JSON.stringify(rule.expected_value) }, ...((rule.additional_criteria ?? []) as { target: string; expectedValue: unknown }[]).map((criterion) => ({ target: criterion.target, expectedValue: JSON.stringify(criterion.expectedValue) }))] : [];
            return { id: question.id, number: question.question_number, instruction: question.instruction, marks: Number(question.marks), existingCriteria };
          })}
        />
      </div>
    </main>
  );
}

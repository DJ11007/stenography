"use server";
// TEMPORARY, local development only -- not committed. Grades a document with the
// live answer key exactly as the server grades a submission (read-only).
import { createClient } from "@/lib/supabase/server";

export async function gradeAgainstLive(versionId: string, document: unknown) {
  const supabase = await createClient();
  const { data: version, error: versionError } = await supabase.from("word_efficiency_versions").select("model_answer_snapshot").eq("id", versionId).single();
  if (versionError) { const { data: who } = await supabase.auth.getUser(); return { error: versionError.message, user: who.user?.email ?? null }; }
  const { data: rules, error } = await supabase.from("word_efficiency_grading_rules").select("question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria").eq("version_id", versionId);
  if (error) return { error: error.message };
  const results = [];
  for (const rule of rules ?? []) {
    const { data, error: rpcError } = await supabase.rpc("evaluate_word_efficiency_grading_rule", {
      final_document: document, target: rule.exact_target, expected_operation: rule.expected_operation, expected_value: rule.expected_value,
      allocated_marks: rule.allocated_marks, partial_marks: rule.partial_marks, additional_criteria: rule.additional_criteria, model_document: version.model_answer_snapshot,
    });
    const failed: string[] = [];
    if (!rpcError && Number(data) < Number(rule.allocated_marks)) {
      for (const criterion of (rule.additional_criteria as { target: string; expectedValue?: unknown }[]) ?? []) {
        const { data: one } = await supabase.rpc("evaluate_word_efficiency_grading_rule", {
          final_document: document, target: rule.exact_target, expected_operation: rule.expected_operation, expected_value: rule.expected_value,
          allocated_marks: 1, partial_marks: 0, additional_criteria: [criterion], model_document: version.model_answer_snapshot,
        });
        if (Number(one) < 1) failed.push(`${criterion.target}=${JSON.stringify(criterion.expectedValue)}`);
      }
    }
    results.push({ question: rule.question_id, marks: data, of: rule.allocated_marks, error: rpcError?.message, failed });
  }
  return { results };
}

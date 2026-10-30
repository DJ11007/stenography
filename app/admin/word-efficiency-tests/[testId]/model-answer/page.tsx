import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButton } from "@/app/_components/back-button";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ModelAnswerCriterion } from "@/lib/word-document-diff";
import { ModelAnswerEditor } from "./model-answer-editor";

type StoredCriterion = { target: string; expectedValue: unknown; alternatives?: unknown[]; ignoreCase?: boolean };

// A rule saved by the current Model Answer page (operation
// "model-answer-match-v2") keeps every criterion in additional_criteria, with
// the value it had when its question was saved as the first alternative. An
// older rule's primary target is one more criterion; any target that names a
// block by id instead of position ("blocks.block-10.type") never resolved, so
// it is dropped rather than carried forward.
function existingModelAnswerCriteria(rule: { exact_target: string; expected_operation: string; expected_value: unknown; additional_criteria: unknown }): ModelAnswerCriterion[] {
  const stored = (Array.isArray(rule.additional_criteria) ? rule.additional_criteria : []) as StoredCriterion[];
  const all = rule.expected_operation === "model-answer-match-v2" ? stored : [{ target: rule.exact_target, expectedValue: rule.expected_value }, ...stored];
  // Hand-written rule criteria ({ rule: "words" | "text" | "table" ... }, migration 202610201200)
  // have no single target to show here; they are kept in the database as they are.
  return all
    .filter((criterion) => typeof criterion.target === "string")
    .filter((criterion) => !/^blocks\.[^.]*[^0-9.][^.]*\./.test(criterion.target))
    .map((criterion) => ({ target: criterion.target, savedValue: criterion.alternatives?.[0] ?? criterion.expectedValue, caseOnly: criterion.ignoreCase === false }));
}

export const metadata: Metadata = { title: "Model Answer | Admin" };

export default async function ModelAnswerPage({ params }: { params: Promise<{ testId: string }> }) {
  await requireAdmin();
  const { testId } = await params;
  const supabase = await createClient();
  const { data: test } = await supabase.from("word_efficiency_tests").select("id,title,current_version_id").eq("id", testId).maybeSingle();
  if (!test?.current_version_id) notFound();
  const { data: version } = await supabase.from("word_efficiency_versions").select("id,working_matter_snapshot,model_answer_snapshot").eq("id", test.current_version_id).maybeSingle();
  if (!version) notFound();
  const { data: questions } = await supabase.from("word_efficiency_questions").select("id,question_number,instruction,marks").eq("version_id", version.id).order("display_order");
  const { data: gradingRules } = await supabase.from("word_efficiency_grading_rules").select("question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria,part_label").eq("version_id", version.id);
  // A question can have several rules (its parts), so every row is kept, not one per question.
  const rulesByQuestion = new Map<string, NonNullable<typeof gradingRules>>();
  for (const rule of gradingRules ?? []) rulesByQuestion.set(rule.question_id, [...(rulesByQuestion.get(rule.question_id) ?? []), rule]);

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-3">
      <div className="mx-auto max-w-[1600px]">
        <BackButton href={`/admin/word-efficiency-tests/design?edit=${test.id}`} label={test.title} />
        <ModelAnswerEditor
          versionId={version.id}
          original={version.working_matter_snapshot}
          initialDocument={version.model_answer_snapshot}
          questions={(questions ?? []).map((question) => {
            const rules = rulesByQuestion.get(question.id) ?? [];
            // Rules this page cannot rebuild from the finished answer (a "rule" criterion -- words, text, table... -- or a rule
            // of another kind, with its part marks) are sent back unchanged whenever another question is saved.
            const hand = rules.some((rule) => rule.expected_operation !== "model-answer-match-v2" || (Array.isArray(rule.additional_criteria) && (rule.additional_criteria as { rule?: unknown }[]).some((criterion) => criterion && typeof criterion === "object" && "rule" in criterion)));
            const keptRules = hand ? rules.map((rule) => ({ exactTarget: rule.exact_target, expectedOperation: rule.expected_operation, expectedValue: JSON.stringify(rule.expected_value ?? null), allocatedMarks: Number(rule.allocated_marks), partialMarks: rule.partial_marks === null ? null : Number(rule.partial_marks), partLabel: rule.part_label, additionalCriteria: Array.isArray(rule.additional_criteria) ? rule.additional_criteria : [] })) : [];
            return { id: question.id, number: question.question_number, instruction: question.instruction, marks: Number(question.marks), graded: rules.length > 0, keptRules, existingCriteria: rules.length && !hand ? existingModelAnswerCriteria(rules[0]) : [] };
          })}
        />
      </div>
    </main>
  );
}

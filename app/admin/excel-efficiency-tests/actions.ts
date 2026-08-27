"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calculateExcelQuestionTotal, parseExcelDurationOptions, parseExcelQuestions, safeExcelSlug, validateExcelDraft, type ExcelLanguage } from "@/lib/excel-efficiency";
import { parseWorkingSheetXlsx, validateWorkingSheetFile, type WorkingSheetSnapshot } from "@/lib/excel-sheet";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const refresh = (testId?: string) => {
  revalidatePath("/admin/excel-efficiency-tests");
  revalidatePath("/typing/excel-efficiency");
  revalidatePath("/typing/excel-efficiency/english");
  revalidatePath("/typing/excel-efficiency/hindi");
  if (testId) {
    revalidatePath(`/typing/excel-efficiency/english/${testId}/instructions`);
    revalidatePath(`/typing/excel-efficiency/hindi/${testId}/instructions`);
    revalidatePath(`/typing/excel-efficiency/english/${testId}/workspace`);
    revalidatePath(`/typing/excel-efficiency/hindi/${testId}/workspace`);
  }
};

export async function extractWorkingMatterXlsx(form: FormData) {
  await requireAdmin();
  const language: ExcelLanguage = value(form, "language") === "Hindi" ? "Hindi" : "English";
  const upload = form.get("workingMatterFile");
  if (!(upload instanceof File) || !upload.size) return { ok: false, error: "Choose a .xlsx Working Matter file.", snapshot: null };
  const errors = validateWorkingSheetFile(upload);
  if (errors.length) return { ok: false, error: errors[0], snapshot: null };
  try {
    const snapshot = parseWorkingSheetXlsx(new Uint8Array(await upload.arrayBuffer()), language);
    snapshot.source = { fileName: upload.name, sizeBytes: upload.size };
    return { ok: true, error: null, snapshot };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Working Matter XLSX could not be read.", snapshot: null };
  }
}

export async function saveExcelEfficiencyTest(form: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const testId = value(form, "testId") || null;
  const language: ExcelLanguage = value(form, "language") === "Hindi" ? "Hindi" : "English";
  const questions = parseExcelQuestions(value(form, "questions"));
  const durations = parseExcelDurationOptions(value(form, "durationOptions"));
  const passing = value(form, "passingMarks") ? Number(value(form, "passingMarks")) : null;
  const matterRaw = value(form, "workingMatterSnapshot");
  let workingMatter: WorkingSheetSnapshot | null = null;
  try {
    workingMatter = matterRaw ? (JSON.parse(matterRaw) as WorkingSheetSnapshot) : null;
  } catch (error) {
    redirect(`/admin/excel-efficiency-tests?error=${encodeURIComponent(error instanceof Error ? error.message : "Working Matter is invalid")}`);
  }
  const draft = { title: value(form, "title"), language, instructions: value(form, "instructions"), durations, questionCount: questions.length, maximumMarks: calculateExcelQuestionTotal(questions), passingMarks: passing, questions, hasWorkingMatter: Boolean(workingMatter) };
  const errors = validateExcelDraft(draft);
  if (errors.length) redirect(`/admin/excel-efficiency-tests?error=${encodeURIComponent(errors[0])}`);
  const databaseQuestions = questions.map(({ gradingRule: _gradingRule, ...question }) => ({ number: question.question_number, instruction: question.instruction, marks: question.marks, section: question.section, display_order: question.display_order, is_visible: question.is_visible }));
  const payload = { title: draft.title, slug: safeExcelSlug(value(form, "slug") || draft.title), language, description: value(form, "description"), instructions_markdown: draft.instructions, question_count: draft.questionCount, maximum_marks: draft.maximumMarks, duration_options: durations, passing_marks: passing ?? "", questions: databaseQuestions, publish: value(form, "intent") === "publish", working_matter_snapshot: workingMatter };
  const { data: savedId, error } = await supabase.rpc("save_excel_efficiency_test", { p_test_id: testId, p_payload: payload });
  if (error || !savedId) redirect(`/admin/excel-efficiency-tests?error=${encodeURIComponent(error?.message ?? "Unable to save test")}`);
  const { data: savedTest } = await supabase.from("excel_efficiency_tests").select("current_version_id").eq("id", savedId).single();
  const gradingRules = questions.flatMap((question) => (question.gradingRule ? [{ questionNumber: question.question_number, exactTarget: question.gradingRule.target, expectedOperation: question.gradingRule.expectedOperation, expectedValue: question.gradingRule.expectedValue, allocatedMarks: question.gradingRule.allocatedMarks, partialMarks: question.gradingRule.partialMarks }] : []));
  const { error: ruleError } = await supabase.rpc("save_excel_efficiency_grading_rules", { p_version_id: savedTest?.current_version_id, p_rules: gradingRules });
  if (ruleError) redirect(`/admin/excel-efficiency-tests?error=${encodeURIComponent(`Test version saved, but grading rules failed: ${ruleError.message}`)}`);
  refresh(savedId);
  redirect("/admin/excel-efficiency-tests?saved=1");
}

export async function setExcelEfficiencyStatus(form: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const testId = value(form, "testId");
  await supabase.rpc("set_excel_efficiency_status", { p_test_id: testId, p_status: value(form, "status") });
  refresh(testId);
}

export async function duplicateExcelEfficiencyTest(form: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = value(form, "testId");
  const { data: test } = await supabase.from("excel_efficiency_tests").select("current_version_id,slug").eq("id", id).single();
  if (!test?.current_version_id) return;
  const { data: version } = await supabase.from("excel_efficiency_versions").select("*").eq("id", test.current_version_id).single();
  const { data: questions } = await supabase.from("excel_efficiency_questions").select("question_number,instruction,marks,section,display_order,is_visible").eq("version_id", test.current_version_id).order("display_order");
  if (!version) return;
  const payload = { title: `${version.title} Copy`, slug: `${test.slug}-copy-${crypto.randomUUID().slice(0, 6)}`, language: version.language, description: version.description, instructions_markdown: version.instructions_markdown, question_count: version.question_count, maximum_marks: version.maximum_marks, duration_options: version.duration_options, passing_marks: version.passing_marks ?? "", questions: (questions ?? []).map((q) => ({ number: q.question_number, instruction: q.instruction, marks: q.marks, section: q.section, display_order: q.display_order, is_visible: q.is_visible })), publish: false, working_matter_snapshot: version.working_matter_snapshot };
  const { error } = await supabase.rpc("save_excel_efficiency_test", { p_test_id: null, p_payload: payload });
  refresh();
  if (error) redirect(`/admin/excel-efficiency-tests?error=${encodeURIComponent(error.message)}`);
}

export async function deleteExcelEfficiencyTest(form: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const testId = value(form, "testId");
  const { data, error } = await supabase.rpc("delete_excel_efficiency_test", { p_test_id: testId });
  if (error) redirect(`/admin/excel-efficiency-tests?error=${encodeURIComponent(error.message)}`);
  if (!data) redirect("/admin/excel-efficiency-tests?error=Tests%20with%20existing%20attempts%20cannot%20be%20deleted.%20Archive%20it%20instead.");
  refresh();
  redirect("/admin/excel-efficiency-tests?deleted=1");
}

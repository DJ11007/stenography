import type { WorkingSheetSnapshot } from "./excel-sheet.ts";

export type ExcelLanguage = "English" | "Hindi";
export type ExcelQuestion = { id: string; version_id: string; question_number: number; instruction: string; marks: number; section: string | null; display_order: number; is_visible: boolean; gradingRule?: { target: string; expectedOperation: string; expectedValue: string; allocatedMarks: number; partialMarks: number | null } };
export type ExcelVersion = { id: string; test_id: string; version_number: number; title: string; language: ExcelLanguage; description: string; instructions_markdown: string; question_count: number; maximum_marks: number; duration_options: number[]; passing_marks: number | null; working_matter_snapshot?: WorkingSheetSnapshot | null };
export type ExcelTest = { id: string; slug: string; title: string; language: ExcelLanguage; status: string; current_version_id: string; current_version_number: number; published_at: string | null; updated_at: string };

export function formatExcelDuration(seconds: number) { const minutes = seconds / 60; return `${minutes} minute${minutes === 1 ? "" : "s"}`; }

export function parseExcelDurationOptions(raw: string) {
  const values = [...new Set(raw.split(",").map((item) => Math.round(Number(item.trim()))).filter((minutes) => Number.isFinite(minutes) && minutes > 0 && minutes <= 240))].sort((a, b) => a - b);
  return values.map((minutes) => minutes * 60);
}

export function calculateExcelQuestionTotal(questions: { marks: number }[]) { return Math.round(questions.reduce((sum, question) => sum + question.marks, 0) * 100) / 100; }

export function safeExcelSlug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `excel-test-${Date.now()}`; }

export function validateExcelDraft(draft: { title: string; language: ExcelLanguage; instructions: string; durations: number[]; questionCount: number; maximumMarks: number; passingMarks: number | null; questions: { instruction: string; marks: number }[]; hasWorkingMatter: boolean }) {
  const errors: string[] = [];
  if (draft.title.trim().length < 2) errors.push("Test title is required.");
  if (draft.instructions.trim().length < 10) errors.push("Instructions are required.");
  if (!draft.durations.length) errors.push("At least one duration option is required.");
  if (!draft.hasWorkingMatter) errors.push("Upload a Working Matter XLSX before saving.");
  if (!draft.questions.length) errors.push("At least one question is required.");
  if (draft.questions.some((question) => !question.instruction.trim())) errors.push("Every question needs an instruction.");
  if (draft.questions.some((question) => !(question.marks > 0))) errors.push("Every question needs marks greater than zero.");
  if (draft.passingMarks !== null && (draft.passingMarks < 0 || draft.passingMarks > draft.maximumMarks)) errors.push("Passing marks must be between 0 and the maximum marks.");
  return errors;
}

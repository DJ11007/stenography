import type { WorkingSheetSnapshot } from "./excel-sheet.ts";

export type ExcelLanguage = "English" | "Hindi";
export type ExcelGradingRule = { target: string; expectedOperation: string; expectedValue: string; allocatedMarks: number; partialMarks: number | null };
export type ExcelQuestion = { id: string; version_id: string; question_number: number; instruction: string; marks: number; section: string | null; display_order: number; is_visible: boolean; gradingRule?: ExcelGradingRule | null };
export type ExcelVersion = { id: string; test_id: string; version_number: number; title: string; language: ExcelLanguage; description: string; instructions_markdown: string; question_count: number; maximum_marks: number; duration_options: number[]; passing_marks: number | null; working_matter_snapshot?: WorkingSheetSnapshot | null };
export type ExcelTest = { id: string; slug: string; title: string; language: ExcelLanguage; status: string; current_version_id: string; current_version_number: number; published_at: string | null; updated_at: string };

export function formatExcelDuration(seconds: number) { const minutes = seconds / 60; return `${minutes} minute${minutes === 1 ? "" : "s"}`; }

export const DEFAULT_EXCEL_INSTRUCTIONS: Record<ExcelLanguage, string> = {
  English: "1. Carefully read the instructions and solve the questions accordingly.\n2. All questions are mandatory.\n3. The question paper contains the configured number of questions.\n4. **Maximum marks** and question-wise marks are shown with the questions.\n5. Complete each task directly in the spreadsheet using the given commands.",
  Hindi: "1. दिए गए निर्देशों को ध्यानपूर्वक पढ़ें।\n2. सभी प्रश्न अनिवार्य हैं।\n3. प्रश्नपत्र में निर्धारित संख्या में प्रश्न हैं।\n4. **अधिकतम अंक** और प्रत्येक प्रश्न के अंक प्रश्न के साथ दिए गए हैं।\n5. दिए गए कमांड का उपयोग करते हुए प्रत्येक कार्य सीधे स्प्रेडशीट में पूरा करें।",
};

export function parseExcelDurationOptions(raw: string) {
  const values = [...new Set(raw.split(",").map((item) => Math.round(Number(item.trim()))).filter((minutes) => Number.isFinite(minutes) && minutes > 0 && minutes <= 240))].sort((a, b) => a - b);
  return values.map((minutes) => minutes * 60);
}

export function calculateExcelQuestionTotal(questions: { marks: number }[]) { return Math.round(questions.reduce((sum, question) => sum + question.marks, 0) * 100) / 100; }

export const MAX_EXCEL_QUESTION_MARKS = 1000;

export function calculateExcelQuestionSummary(questions: { marks: number }[]) {
  const total = calculateExcelQuestionTotal(questions);
  const missing = questions.filter((question) => !Number.isFinite(question.marks) || question.marks <= 0).length;
  return { questionCount: questions.length, maximumMarks: total, questionsWithoutMarks: missing, averageMarks: questions.length ? Number((total / questions.length).toFixed(2)) : 0 };
}

export function safeExcelSlug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `excel-test-${Date.now()}`; }

export function parseExcelQuestions(value: string): ExcelQuestion[] {
  try {
    const parsed = JSON.parse(value) as Partial<ExcelQuestion & { number: number }>[];
    if (Array.isArray(parsed)) return parsed.map((question, index) => ({ ...(question.id ? { id: question.id } : {}), id: question.id ?? "", version_id: "", question_number: Number((question as { number?: number }).number ?? question.question_number), instruction: String(question.instruction ?? "").trim(), marks: question.marks === null || question.marks === undefined || Number.isNaN(question.marks) ? Number.NaN : Number(question.marks), section: String(question.section ?? "").trim() || null, display_order: Number(question.display_order ?? index + 1), is_visible: question.is_visible !== false, ...(question.gradingRule && typeof question.gradingRule === "object" ? { gradingRule: question.gradingRule } : {}) }));
  } catch { /* fall through to line-based parsing */ }
  return [];
}

export function validateExcelDraft(draft: { title: string; language: ExcelLanguage; instructions: string; durations: number[]; questionCount: number; maximumMarks: number; passingMarks: number | null; questions: ExcelQuestion[]; hasWorkingMatter: boolean }) {
  const errors: string[] = [];
  const numbers = draft.questions.map((question) => question.question_number);
  const orders = draft.questions.map((question) => question.display_order);
  if (draft.title.trim().length < 2) errors.push("Test title is required.");
  if (draft.instructions.trim().length < 10) errors.push("Instructions are required.");
  if (/<\/?(?:script|iframe|object|embed|style)|on\w+\s*=/iu.test(draft.instructions)) errors.push("Executable HTML is not allowed in instructions.");
  if (!draft.durations.length) errors.push("At least one duration option is required.");
  if (!draft.hasWorkingMatter) errors.push("Upload a Working Matter XLSX before saving.");
  if (!draft.questions.length) errors.push("At least one question is required.");
  if (draft.questions.length !== draft.questionCount) errors.push("Configured question count must match the question rows.");
  if (new Set(numbers).size !== numbers.length || numbers.some((number) => !Number.isInteger(number) || number < 1)) errors.push("Question numbers must be unique positive whole numbers.");
  if (new Set(orders).size !== orders.length || orders.some((order) => !Number.isInteger(order) || order < 1) || [...orders].sort((a, b) => a - b).some((order, index) => order !== index + 1)) errors.push("Question display order must be consecutive and unique.");
  if (draft.questions.some((question) => question.is_visible && !question.instruction.trim())) errors.push("Every visible question needs an instruction.");
  if (draft.questions.some((question) => !Number.isFinite(question.marks) || question.marks <= 0 || question.marks > MAX_EXCEL_QUESTION_MARKS)) errors.push(`Each question must have marks greater than zero and no more than ${MAX_EXCEL_QUESTION_MARKS}.`);
  if (draft.questions.some((question) => question.gradingRule && (!question.gradingRule.target.trim() || !question.gradingRule.expectedOperation.trim() || question.gradingRule.allocatedMarks <= 0 || question.gradingRule.allocatedMarks > question.marks || (question.gradingRule.partialMarks !== null && (question.gradingRule.partialMarks < 0 || question.gradingRule.partialMarks > question.gradingRule.allocatedMarks))))) errors.push("Each automatic grading rule needs an exact target, operation, expected value, valid allocated marks, and optional partial marks within the allocation.");
  if (Math.abs(calculateExcelQuestionTotal(draft.questions) - draft.maximumMarks) > 0.001) errors.push("Maximum marks must equal the sum of individual question marks.");
  if (draft.passingMarks !== null && (draft.passingMarks < 0 || draft.passingMarks > draft.maximumMarks)) errors.push("Passing marks must be between 0 and the maximum marks.");
  return errors;
}

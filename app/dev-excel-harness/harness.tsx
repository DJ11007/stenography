"use client";
import { ExcelWorkspace } from "../typing/excel-efficiency/[language]/[testId]/workspace/excel-workspace";
import type { ExcelDocument } from "@/lib/excel-document";

// EXCEL EFFICIENCY TEST 1's 10 questions (version d12f2b8b), copied here for the dev-only preview.
const questions = [
  "Apply following formatting to range A27:L27. (a) Merge and Center (b) Font color-red (c) Font Size 14pt",
  "Apply following formatting to range A28:L31. (a) Merge across (b) font red (c) Font size 14",
  "Merge the cells and Middle align for the following ranges (a) A1:G1 (b) A6:G6 (c) A9:G9",
  "Apply the formatting of cell B5 to following using format Painter. (a) B13 (b) B21 (c) B26",
  "Remove current workbook Gridlines.",
  "find the Total fee for offline classes in the following cell for each course. (a) I5 (b) I13 (c) I21 (d) I25",
  "Set print Area for the range A1:L31.",
  "Give Page number to the Right section of the Header.",
  "Set the Orientation of the Sheet in Landscape View and page size in legal.",
  "Remove the Headings of column and Row.",
].map((instruction, index) => ({ id: `q${index}`, number: index + 1, display_order: index + 1, instruction, marks: 2.5, section: null, is_visible: true }));

export function ExcelHarness({ original }: { original: ExcelDocument }) {
  const snapshot = { title: "EFFICIENCY TEST 1", language: "English", instructions_markdown: "", duration_seconds: 600, question_count: 10, maximum_marks: 25, questions, show_questions: true, delivery_onscreen: true, question_toggle: true };
  return <ExcelWorkspace attemptId="00000000-0000-0000-0000-000000000000" snapshot={snapshot} status="in_progress" remainingSeconds={600} original={original} />;
}

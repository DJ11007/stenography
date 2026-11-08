import { cache } from "react";
import { requireStudent, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type QuestionPaper = {
  subject: "word" | "excel";
  title: string;
  language: "English" | "Hindi";
  durationSeconds: number;
  maximumMarks: number;
  passingMarks: number | null;
  instructions: string;
  questions: { number: number; instruction: string; marks: number; section: string | null }[];
  ready: boolean;
  isAdmin: boolean;
};

// The printable question paper of a Word / Excel Efficiency test, made from its current version's questions so it
// always matches the test. Students get it only for a published test the admin has turned "Question paper" on for;
// the admin can open any test's paper (the Preview link on the admin list) to check it first.
export const loadQuestionPaper = cache(async (subject: "word" | "excel", languageSlug: string, testId: string): Promise<QuestionPaper | null> => {
  const language = languageSlug === "hindi" ? "Hindi" : languageSlug === "english" ? "English" : null;
  if (!language || !/^[0-9a-f-]{36}$/i.test(testId)) return null;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";
  if (!isAdmin) await requireStudent();
  const prefix = subject === "word" ? "word" : "excel";
  type TestRow = { id: string; title: string; status: string; current_version_id: string | null; question_paper_ready?: boolean; is_live: boolean | null; live_ends_at: string | null };
  const columns = "id,title,language,status,current_version_id,is_live,live_ends_at";
  let { data: test, error } = await supabase.from(`${prefix}_efficiency_tests`).select(`${columns},question_paper_ready`).eq("id", testId).eq("language", language).maybeSingle<TestRow>();
  // Before migration 202611081300 there is no question_paper_ready: no test is ready, the admin can still preview.
  if (error && /question_paper_ready/i.test(error.message)) ({ data: test, error } = await supabase.from(`${prefix}_efficiency_tests`).select(columns).eq("id", testId).eq("language", language).maybeSingle<TestRow>());
  if (error || !test?.current_version_id) return null;
  const ready = test.status === "published" && test.question_paper_ready === true;
  // A live test's questions stay private until its live window is over.
  const liveRunning = test.is_live === true && (!test.live_ends_at || new Date(test.live_ends_at).getTime() > Date.now());
  if (liveRunning && !isAdmin) return null;
  if (!ready && !isAdmin) return null;
  const { data: version } = await supabase.from(`${prefix}_efficiency_versions`).select("title,maximum_marks,passing_marks,duration_options,instructions_markdown").eq("id", test.current_version_id).maybeSingle();
  if (!version) return null;
  const { data: rows } = await supabase.from(`${prefix}_efficiency_questions`).select("question_number,instruction,marks,section,display_order,is_visible").eq("version_id", test.current_version_id).order("display_order").order("question_number");
  const questions = (rows ?? []).filter((row) => row.is_visible !== false)
    .map((row) => ({ number: Number(row.question_number), instruction: String(row.instruction ?? ""), marks: Number(row.marks), section: row.section ? String(row.section) : null }));
  const durations = Array.isArray(version.duration_options) ? version.duration_options.map(Number).filter((value: number) => value > 0) : [];
  return {
    subject, title: String(version.title || test.title), language, durationSeconds: durations[0] ?? 0,
    maximumMarks: Number(version.maximum_marks), passingMarks: version.passing_marks == null ? null : Number(version.passing_marks),
    instructions: String(version.instructions_markdown ?? ""), questions, ready, isAdmin,
  };
});

/** "2.5" / "1.66" / "3": marks as written on a paper. */
export function formatPaperMarks(marks: number) {
  return Number.isInteger(marks) ? String(marks) : String(Math.round(marks * 100) / 100);
}

/** Whether students can download this test's question paper (false until migration 202611081300 has been run). */
export async function questionPaperReady(subject: "word" | "excel", testId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from(subject === "word" ? "word_efficiency_tests" : "excel_efficiency_tests").select("question_paper_ready").eq("id", testId).maybeSingle();
  return !error && data?.question_paper_ready === true;
}

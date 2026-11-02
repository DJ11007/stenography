import { createClient } from "./supabase/server";

// A PostgrestError extends Error, and Error instances lose their own
// properties (message/code/details/hint) when Next.js forwards a server
// console.error call to the browser's dev overlay -- they render as an
// unhelpful "{}" there even though the error itself is populated. Logging
// the specific fields as a plain object survives that forwarding intact.
function logRpcFailure(label: string, error: { message: string; code: string; details: string; hint: string }) {
  console.error(label, { message: error.message, code: error.code, details: error.details, hint: error.hint });
}

export type PublicLiveResult = { student_name: string; test_title: string; language: string; net_wpm: number; accuracy: number; submitted_at: string };
export type LiveTestTopRanker = { student_id: string; student_name: string; net_wpm: number };
export type LiveEfficiencyTest = { id: string; subject: "word" | "excel"; slug: string; title: string; language: string; is_live: boolean; live_starts_at: string | null; live_ends_at: string | null; results_publish_at: string | null; duration_options: number[]; results_delay_minutes?: number | null };

export async function getPublishedLiveResults(limit = 30): Promise<PublicLiveResult[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("published_live_results", { p_limit: limit });
  if (error) { logRpcFailure("Live results listing failed", error); return []; }
  return (data ?? []) as PublicLiveResult[];
}

// Per-language top-10 leaderboard for the homepage (the RPC itself caps
// at 20 -- see published_live_test_top_rankers' own migration comment).
export async function getLiveTestTopRankers(language: string, limit = 10): Promise<LiveTestTopRanker[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("published_live_test_top_rankers", { p_language: language, p_limit: limit });
  if (error) { logRpcFailure(`Top rankers listing failed (${language})`, error); return []; }
  return (data ?? []) as LiveTestTopRanker[];
}

export async function getLiveEfficiencyTests(): Promise<LiveEfficiencyTest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("published_live_efficiency_tests");
  if (error) { logRpcFailure("Live efficiency tests listing failed", error); return []; }
  return (data ?? []) as LiveEfficiencyTest[];
}

// Real requested feature: published_live_results only ever returns the
// latest 30 rows overall, so a result from a few days back becomes
// unfindable once enough newer attempts pile up. These two power a date
// browser on /live-test -- dates() lists which IST calendar days actually
// have a published result (so the picker never offers an empty day), and
// byDate() returns that whole day's results, uncapped by the 30-row limit.
export async function getPublishedLiveResultDates(limit = 90): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("published_live_result_dates", { p_limit: limit });
  if (error) { logRpcFailure("Live result dates listing failed", error); return []; }
  return (data ?? []).map((row: { result_date: string }) => row.result_date);
}

export async function getPublishedLiveResultsByDate(date: string, limit = 200): Promise<PublicLiveResult[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("published_live_results_by_date", { p_date: date, p_limit: limit });
  if (error) { logRpcFailure(`Live results by date listing failed (${date})`, error); return []; }
  return (data ?? []) as PublicLiveResult[];
}

// Home page "Live Exam" section (migration 202611011900): the upcoming / running live exams, and the latest live
// exam's top rankers once its results are open. An error (for example before the migration is run) hides the section.
export type UpcomingLiveExam = { id: string; title: string; starts_at: string; ends_at: string; parts: number; part_names: string };
export type LiveExamTopRanker = { exam_id: string; exam_title: string; exam_date: string; max_total: number; rank: number; student_name: string; total: number };

export async function getUpcomingLiveExams(limit = 5): Promise<UpcomingLiveExam[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_live_exams_upcoming", { p_limit: limit });
  if (error) { logRpcFailure("Upcoming live exams listing failed", error); return []; }
  return (data ?? []) as UpcomingLiveExam[];
}

export async function getLiveExamTopRankers(limit = 10): Promise<LiveExamTopRanker[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_live_exam_top_rankers", { p_limit: limit });
  if (error) { logRpcFailure("Live exam top rankers listing failed", error); return []; }
  return (data ?? []) as LiveExamTopRanker[];
}

// The public "all results" page (/live-exam-results, migration 202611022000): the exams whose results are open, and one
// exam's full result sheet (the latest when no exam is given).
export type LiveExamWithResults = { id: string; title: string; exam_date: string };
export type LiveExamResultRow = { exam_id: string; exam_title: string; exam_date: string; sections: { position: number; label: string; maxMarks: number }[]; rank: number; student_name: string; section_marks: { position: number; marks: number | null }[]; total: number; max_total: number };

export async function getLiveExamsWithResults(): Promise<LiveExamWithResults[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_live_exams_with_results");
  if (error) { logRpcFailure("Live exams with results listing failed", error); return []; }
  return (data ?? []) as LiveExamWithResults[];
}

export async function getLiveExamResults(examId: string | null): Promise<LiveExamResultRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_live_exam_results", { p_exam_id: examId });
  if (error) { logRpcFailure("Live exam results listing failed", error); return []; }
  return (data ?? []) as LiveExamResultRow[];
}

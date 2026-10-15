import type { SupabaseClient } from "@supabase/supabase-js";

// One list of everything a student has attempted -- typing tests set up in
// admin (test_attempts), built-in typing tests (practice_attempts) and Word /
// Excel efficiency tests -- newest first, for the student dashboard and the
// My Results page. Reads go through the student's own session (RLS: own rows).
export type AttemptHistoryItem = { id: string; kind: "typing" | "built-in" | "word" | "excel"; title: string; at: string; score: string; detail: string; href: string };

type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : "");
const num = (value: unknown) => (value == null || value === "" || Number.isNaN(Number(value)) ? null : Number(value));
const wpm = (result: Row) => { const value = num(result.marksNetWpm) ?? num(result.netWpm); return value == null ? "—" : `${Math.round(value * 10) / 10} WPM`; };

function efficiency(row: Row, kind: "word" | "excel"): AttemptHistoryItem {
  const result = (row.result ?? {}) as Row, snapshot = (row.snapshot ?? {}) as Row;
  const status = text(row.status), published = Boolean(row.result_published_at);
  const marks = num(result.marks), maximum = num(result.maximum_marks);
  const score = status === "active" || status === "prepared" ? "In progress" : published && marks != null ? `${marks} / ${maximum ?? "?"}` : "Result pending";
  return { id: text(row.id), kind, title: text(snapshot.title) || (kind === "word" ? "Word efficiency test" : "Excel efficiency test"), at: text(row.submitted_at) || text(row.started_at), score, detail: kind === "word" ? "Word efficiency" : "Excel efficiency", href: `/typing/${kind}-efficiency/results/${text(row.id)}` };
}

export async function studentAttemptHistory(supabase: SupabaseClient, studentId: string, limit?: number): Promise<AttemptHistoryItem[]> {
  const cap = limit ?? 5000;
  const [typing, practice, word, excel] = await Promise.all([
    supabase.from("test_attempts").select("id,test_id,result,submitted_at,is_live_attempt").eq("student_id", studentId).order("submitted_at", { ascending: false }).limit(Math.min(cap, 1000)),
    supabase.from("practice_attempts").select("id,title,mode,result,submitted_at").eq("student_id", studentId).order("submitted_at", { ascending: false }).limit(Math.min(cap, 1000)),
    supabase.from("word_efficiency_attempts").select("id,status,snapshot,result,started_at,submitted_at,result_published_at").eq("student_id", studentId).order("started_at", { ascending: false }).limit(Math.min(cap, 1000)),
    supabase.from("excel_efficiency_attempts").select("id,status,snapshot,result,started_at,submitted_at,result_published_at").eq("student_id", studentId).order("started_at", { ascending: false }).limit(Math.min(cap, 1000)),
  ]);
  const testIds = [...new Set((typing.data ?? []).map(row => row.test_id as string))];
  const { data: tests } = testIds.length ? await supabase.from("tests").select("id,title").in("id", testIds) : { data: [] as { id: string; title: string }[] };
  const titles = new Map((tests ?? []).map(test => [test.id, test.title]));
  const items: AttemptHistoryItem[] = [
    ...(typing.data ?? []).map(row => ({ id: row.id, kind: "typing" as const, title: titles.get(row.test_id) ?? "Typing test", at: row.submitted_at, score: wpm((row.result ?? {}) as Row), detail: row.is_live_attempt ? "Live test" : "Typing test", href: `/typing/attempts/${row.id}` })),
    ...(practice.data ?? []).map(row => ({ id: row.id, kind: "built-in" as const, title: row.title, at: row.submitted_at, score: wpm((row.result ?? {}) as Row), detail: "Built-in typing test", href: `/typing/attempts/${row.id}` })),
    ...(word.data ?? []).map(row => efficiency(row, "word")),
    ...(excel.data ?? []).map(row => efficiency(row, "excel")),
  ];
  items.sort((a, b) => b.at.localeCompare(a.at));
  return limit ? items.slice(0, limit) : items;
}

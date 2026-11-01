import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { liveExamResultsCsv, type LiveExamResultRow } from "@/lib/live-exam";
import { createClient } from "@/lib/supabase/server";

// The results sheet of a live exam (opens in Excel): Rank, Name, Login ID, each section with its maximum marks
// (e.g. "Hindi Typing (25)"), and the total out of all sections' maximum (e.g. "Total (100)").
export async function GET(_: Request, { params }: { params: Promise<{ examId: string }> }) {
  await requireAdmin();
  const { examId } = await params;
  const supabase = await createClient();
  const [{ data: exam }, { data: sections }, { data: rows, error }] = await Promise.all([
    supabase.from("live_exams").select("title").eq("id", examId).maybeSingle(),
    supabase.from("live_exam_sections").select("label,max_marks").eq("exam_id", examId).order("seq"),
    supabase.rpc("admin_live_exam_results", { p_exam_id: examId }),
  ]);
  if (!exam || error) return new NextResponse("Results unavailable", { status: 404 });
  const { data: emails } = await supabase.from("profiles").select("id,email").in("id", ((rows ?? []) as LiveExamResultRow[]).map((row) => row.student_id));
  const emailOf = new Map((emails ?? []).map((row) => [row.id, row.email as string | null]));
  const csv = liveExamResultsCsv((sections ?? []).map((section) => ({ label: section.label, maxMarks: Number(section.max_marks) })), ((rows ?? []) as LiveExamResultRow[]).map((row) => ({ ...row, email: emailOf.get(row.student_id) ?? null })));
  const name = exam.title.replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "-") || "live-exam";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-results.csv"`, "Cache-Control": "no-store" } });
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { istInputToIso, type LiveExamSection } from "@/lib/live-exam";
import { createClient } from "@/lib/supabase/server";

const back = (query: string) => redirect(`/admin/live-exams${query}`);

// Saves an exam and its sections in one call (save_live_exam checks the admin, the tests and that it has not started).
export async function saveLiveExam(form: FormData) {
  await requireAdmin();
  const examId = String(form.get("examId") ?? "") || null;
  const editQuery = examId ? `?edit=${examId}` : `?new=${encodeURIComponent(String(form.get("pattern") ?? "custom"))}`;
  const title = String(form.get("title") ?? "").trim();
  const startsAt = istInputToIso(String(form.get("startsAt") ?? ""));
  const resultsAt = istInputToIso(String(form.get("resultsAt") ?? ""));
  let sections: LiveExamSection[] = [];
  try { sections = JSON.parse(String(form.get("sections") ?? "[]")); } catch { sections = []; }
  const problem = !title ? "Give the exam a title."
    : !startsAt ? "Set the date and start time."
    : resultsAt && resultsAt < startsAt ? "The result time cannot be before the start time."
    : !sections.length ? "Add at least one section."
    : sections.find((section) => !section.testId) ? `Choose a test for "${sections.find((section) => !section.testId)!.label}".`
    : null;
  if (problem) back(`${editQuery}&error=${encodeURIComponent(problem)}`);
  const payload = {
    title, pattern: String(form.get("pattern") ?? "custom"), startsAt, resultsAt, status: String(form.get("status") ?? "draft"),
    instructions: String(form.get("instructions") ?? "").trim(),
    sections: sections.map((section) => ({ ...section, durationSeconds: Math.round(section.durationSeconds), gapAfterSeconds: Math.round(section.gapAfterSeconds) })),
  };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_live_exam", { p_exam_id: examId, p_payload: payload });
  if (error) back(`${editQuery}&error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/live-exams");
  back(`?edit=${data}&saved=1`);
}

// A draft exam can be deleted; a published one is cancelled instead so its attempts stay.
export async function deleteLiveExam(form: FormData) {
  await requireAdmin();
  const examId = String(form.get("examId") ?? "");
  const supabase = await createClient();
  const { data: exam } = await supabase.from("live_exams").select("status").eq("id", examId).maybeSingle();
  const { error } = exam?.status === "draft"
    ? await supabase.from("live_exams").delete().eq("id", examId)
    : await supabase.from("live_exams").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", examId);
  if (error) back(`?edit=${examId}&error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/live-exams");
  back(exam?.status === "draft" ? "?deleted=1" : `?edit=${examId}&cancelled=1`);
}

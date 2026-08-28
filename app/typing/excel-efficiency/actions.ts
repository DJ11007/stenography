"use server";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validateExcelOperations } from "@/lib/excel-document";

export async function prepareExcelAttempt(form: FormData) {
  await requireStudent();
  if (form.get("accepted") !== "on") return;
  const testId = String(form.get("testId") ?? "");
  const duration = Number(form.get("duration"));
  const language = String(form.get("language") === "hindi" ? "hindi" : "english");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prepare_excel_efficiency_attempt", { p_test_id: testId, p_duration_seconds: duration, p_show_questions: form.get("showQuestions") === "on" });
  if (error || !data) redirect(`/typing/excel-efficiency/${language}/${testId}/instructions?duration=${duration}&error=${encodeURIComponent(error?.message ?? "Unable to prepare attempt")}`);
  redirect(`/typing/excel-efficiency/${language}/${testId}/workspace?attempt=${data}`);
}

// autosaveExcelDocument/submitExcelDocument deliberately do NOT call requireStudent() -- see the
// matching comment in app/typing/word-efficiency/actions.ts. These fire on every debounced edit
// during a live attempt; requireStudent()'s extra auth.getUser() + profiles lookup added real
// latency and could false-positive redirect a mid-exam student to /login on a transient hiccup.
// The RPC already enforces ownership and role via auth.uid()/is_active_word_efficiency_student().
export async function autosaveExcelDocument(attemptId: string, document: unknown): Promise<{ ok: boolean; error: string }> {
  try {
    const safeDocument = validateExcelOperations(document);
    const supabase = await createClient();
    const { error } = await supabase.rpc("autosave_excel_efficiency_document", { p_attempt_id: attemptId, p_document: safeDocument });
    if (error) return { ok: false, error: process.env.NODE_ENV === "development" ? `Autosave failed: ${error.message}` : "Autosave failed." };
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Autosave failed." };
  }
}

export async function submitExcelDocument(attemptId: string, document: unknown): Promise<{ ok: boolean; error: string }> {
  try {
    const safeDocument = validateExcelOperations(document);
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_excel_efficiency_document", { p_attempt_id: attemptId, p_document: safeDocument });
    if (error) return { ok: false, error: process.env.NODE_ENV === "development" ? `Submission failed: ${error.message}` : "Submission failed." };
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Submission failed." };
  }
}

"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Turns a test's printable question paper on or off (the "Download question paper" button on its Instructions page).
export async function setQuestionPaperReady(subject: "word" | "excel", testId: string, ready: boolean): Promise<{ ok: boolean; error: string }> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(testId)) return { ok: false, error: "Unknown test." };
  const supabase = await createClient();
  const { error } = await supabase.from(subject === "word" ? "word_efficiency_tests" : "excel_efficiency_tests").update({ question_paper_ready: ready }).eq("id", testId);
  if (error) return { ok: false, error: /question_paper_ready/i.test(error.message) ? "Run supabase/migrations/202611081300_efficiency_question_paper_ready.sql in the Supabase SQL Editor first." : error.message };
  revalidatePath(subject === "word" ? "/admin/word-efficiency-tests" : "/admin/excel-efficiency-tests");
  revalidatePath(subject === "word" ? "/typing/word-efficiency" : "/typing/excel-efficiency", "layout");
  return { ok: true, error: "" };
}

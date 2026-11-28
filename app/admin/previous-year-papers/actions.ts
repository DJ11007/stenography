"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isPreviousYearSection, parsePreviousYearForm } from "@/lib/previous-year-papers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only pages of this app: the form sends the page it sits on, so the admin lands back there.
function safeReturn(value: FormDataEntryValue | null) {
  const path = String(value ?? "");
  return path.startsWith("/admin") && !path.startsWith("//") ? path : "/admin/previous-year-papers";
}
function withMessage(path: string, kind: "saved" | "error", message: string) {
  const key = kind === "saved" ? "pypSaved" : "pypError";
  const [base, hash = ""] = path.split("#");
  const url = new URL(base, "http://local");
  url.searchParams.delete("pypSaved");
  url.searchParams.delete("pypError");
  url.searchParams.set(key, message);
  return `${url.pathname}${url.search}#${hash || "previous-year"}`;
}

/** Marks a test as a previous-year exam paper (or updates it), or removes the mark. */
export async function savePreviousYearPaper(formData: FormData) {
  await requireAdmin();
  const returnTo = safeReturn(formData.get("returnTo"));
  const section = formData.get("section");
  const testId = String(formData.get("testId") ?? "");
  if (!isPreviousYearSection(section) || !UUID.test(testId)) redirect(withMessage(returnTo, "error", "Choose a test."));
  const supabase = await createClient();
  if (formData.get("intent") === "remove") {
    const { error } = await supabase.from("previous_year_papers").delete().eq("section", section).eq("test_id", testId);
    if (error) redirect(withMessage(returnTo, "error", `The previous-year mark could not be removed (${error.code || "database error"}).`));
    revalidatePath("/", "layout");
    redirect(withMessage(returnTo, "saved", "This test is a normal test again."));
  }
  const parsed = parsePreviousYearForm({ examName: formData.get("examName"), examDate: formData.get("examDate"), examYear: formData.get("examYear"), description: formData.get("description") });
  if (!parsed.ok) redirect(withMessage(returnTo, "error", parsed.error));
  const { examName, examDate, examYear, description } = parsed.value;
  const { error } = await supabase.from("previous_year_papers").upsert(
    { section, test_id: testId, exam_name: examName, exam_date: examDate, exam_year: examYear, description, updated_at: new Date().toISOString() },
    { onConflict: "section,test_id" },
  );
  if (error) {
    const missing = error.code === "42P01" || error.code === "PGRST205";
    redirect(withMessage(returnTo, "error", missing ? "Apply migration 202611282000_previous_year_papers.sql first." : `The previous-year details could not be saved (${error.code || "database error"}).`));
  }
  revalidatePath("/", "layout");
  redirect(withMessage(returnTo, "saved", "Saved: this test now shows as a previous-year paper."));
}

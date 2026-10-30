"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const page = (testId: string) => `/admin/excel-efficiency-tests/${testId}/auto-grading`;

export async function setExcelEfficiencyAutoPublish(formData: FormData) {
  await requireAdmin();
  const testId = String(formData.get("testId") ?? "");
  const enabled = formData.get("enabled") === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_excel_efficiency_auto_publish", { p_test_id: testId, p_enabled: enabled });
  if (error) redirect(`${page(testId)}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(page(testId));
  redirect(`${page(testId)}?${enabled ? "enabled" : "disabled"}=1`);
}

export async function regradeExcelEfficiencyAttempts(formData: FormData) {
  await requireAdmin();
  const testId = String(formData.get("testId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regrade_excel_efficiency_version", { p_version_id: versionId });
  if (error) redirect(`${page(testId)}?error=${encodeURIComponent(error.message)}`);
  const result = (data ?? {}) as { attemptsExamined?: number; scoresChanged?: number };
  revalidatePath(page(testId));
  redirect(`${page(testId)}?regraded=${Number(result.attemptsExamined ?? 0)}&changed=${Number(result.scoresChanged ?? 0)}`);
}

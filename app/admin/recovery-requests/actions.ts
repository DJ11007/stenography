"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type RecoveryReviewState = { error?: string; success?: string };

export async function reviewRecoveryRequest(_: RecoveryReviewState, formData: FormData): Promise<RecoveryReviewState> {
  await requireAdmin();
  const requestId = String(formData.get("requestId") ?? "");
  const decision = formData.get("decision") === "approved" ? "approved" : formData.get("decision") === "rejected" ? "rejected" : null;
  if (!requestId || !decision) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_account_recovery", { p_request_id: requestId, p_decision: decision, p_target_user_id: null });
  if (error) return { error: error.message };
  revalidatePath("/admin/recovery-requests");
  return { success: decision === "approved" ? "Marked approved. Now go to Students to actually restore this person's access (reset their password or send a reset link)." : "Marked rejected." };
}

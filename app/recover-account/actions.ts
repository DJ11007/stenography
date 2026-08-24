"use server";

import { GENERIC_RECOVERY_MESSAGE, requestFingerprint, stableRecoveryHash } from "@/lib/account-recovery";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccountRecoveryState = { message?: string };

export async function createRecoveryRequest(_: AccountRecoveryState, formData: FormData): Promise<AccountRecoveryState> {
  const studentId = String(formData.get("studentId") ?? "").trim();
  const institutionCode = String(formData.get("institutionCode") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  const recoveryType = formData.get("recoveryType") === "admin" ? "admin" : "student";
  if (studentId.length < 3 || institutionCode.length < 2 || detail.length < 3) return { message: GENERIC_RECOVERY_MESSAGE };

  try {
    const admin = createAdminClient();
    const identifiersHash = stableRecoveryHash(`${studentId}|${institutionCode}|${detail}`);
    if (admin && identifiersHash) {
      await admin.rpc("submit_account_recovery_request", {
        p_request_type: recoveryType,
        p_student_id_hint: studentId.slice(-4),
        p_institution_code: institutionCode.slice(0, 32),
        p_identifiers_hash: identifiersHash,
        p_fingerprint_hash: await requestFingerprint(),
      });
    }
  } catch {}
  return { message: GENERIC_RECOVERY_MESSAGE };
}

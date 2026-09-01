"use server";

import { GENERIC_RECOVERY_MESSAGE, requestFingerprint, stableRecoveryHash } from "@/lib/account-recovery";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccountRecoveryState = { message?: string };

// This app is a single institute, so there is nothing meaningful for a
// student to type into an "institution code" field -- it was a leftover
// from a multi-institute design that was never built. The column still
// exists (account_recovery_requests.institution_code is not-null), so a
// fixed constant is stored in its place instead of asking students to guess
// at a code nobody ever assigned them.
const SINGLE_INSTITUTION_CODE = "SAMRADHI-CLASSES";

export async function createRecoveryRequest(_: AccountRecoveryState, formData: FormData): Promise<AccountRecoveryState> {
  const studentId = String(formData.get("studentId") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  const recoveryType = formData.get("recoveryType") === "admin" ? "admin" : "student";
  if (studentId.length < 3 || detail.length < 3) return { message: GENERIC_RECOVERY_MESSAGE };
  const institutionCode = SINGLE_INSTITUTION_CODE;

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

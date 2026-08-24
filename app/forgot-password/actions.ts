"use server";

import { headers } from "next/headers";
import {
  GENERIC_RECOVERY_MESSAGE,
  normalizePhone,
  phoneRecoveryEnabled,
  requestFingerprint,
  stableRecoveryHash,
} from "@/lib/account-recovery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RecoveryState = { message?: string; error?: string };

async function permitted(kind: "password_email" | "password_phone", identifier: string) {
  const admin = createAdminClient();
  const identifierHash = stableRecoveryHash(identifier);
  if (!admin || !identifierHash) return true;
  const fingerprint = await requestFingerprint();
  const { data, error } = await admin.rpc("record_recovery_attempt", {
    p_kind: kind,
    p_fingerprint_hash: fingerprint,
    p_identifier_hash: identifierHash,
  });
  return !error && data === true;
}

export async function requestPasswordReset(_: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { message: GENERIC_RECOVERY_MESSAGE };
  if (!(await permitted("password_email", email))) return { message: GENERIC_RECOVERY_MESSAGE };

  try {
    const origin = (await headers()).get("origin") || process.env.NEXT_PUBLIC_SITE_URL;
    if (!origin) return { message: GENERIC_RECOVERY_MESSAGE };
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin.replace(/\/$/, "")}/auth/callback?next=/update-password`,
    });
  } catch {
    // Deliberately indistinguishable from an unknown account or provider outage.
  }
  return { message: GENERIC_RECOVERY_MESSAGE };
}

export async function requestPhoneOtp(_: RecoveryState, formData: FormData): Promise<RecoveryState> {
  if (!phoneRecoveryEnabled()) return { message: GENERIC_RECOVERY_MESSAGE };
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone || !(await permitted("password_phone", phone))) return { message: GENERIC_RECOVERY_MESSAGE };
  try {
    const supabase = await createClient();
    await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  } catch {}
  return { message: GENERIC_RECOVERY_MESSAGE };
}

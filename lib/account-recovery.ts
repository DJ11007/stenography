import "server-only";

import { createHash, createHmac } from "node:crypto";
import { headers } from "next/headers";

export const GENERIC_RECOVERY_MESSAGE =
  "If the details match an eligible account, recovery instructions or a support response will be sent.";

export const RECOVERY_WINDOW_MS = 60 * 60 * 1000;
export const RECOVERY_LIMIT = 5;

export function isStrongPassword(password: string) {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function isAllowedRecoveryRedirect(pathname: string) {
  return pathname === "/update-password";
}

export function normalizePhone(value: string) {
  const normalized = value.replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

export function stableRecoveryHash(value: string) {
  const secret = process.env.RECOVERY_HASH_SECRET;
  if (!secret || secret.length < 32) return null;
  return createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex");
}

export async function requestFingerprint() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || requestHeaders.get("x-real-ip") || "unknown";
  const agent = requestHeaders.get("user-agent") || "unknown";
  return stableRecoveryHash(`${ip}|${agent}`) ?? createHash("sha256").update(`${ip}|${agent}`).digest("hex");
}

export function phoneRecoveryEnabled() {
  return process.env.SUPABASE_PHONE_RECOVERY_ENABLED === "true";
}

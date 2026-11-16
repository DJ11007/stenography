"use server";

import { requireAdmin } from "@/lib/auth";
import { issueActivationKey } from "@/lib/activation-keys";

export async function makeActivationKey(deviceId: string, note: string): Promise<{ key?: string; error?: string }> {
  await requireAdmin();
  const id = deviceId.trim();
  if (!/^[A-Za-z0-9-]{6,100}$/.test(id)) return { error: "That doesn't look like a Device ID. Copy it exactly from the student's Activate screen." };
  try {
    return { key: issueActivationKey(id, note.trim().slice(0, 80)) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The key could not be made." };
  }
}

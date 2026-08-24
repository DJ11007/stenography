"use server";

import { isStrongPassword } from "@/lib/account-recovery";
import { createClient } from "@/lib/supabase/server";

export type UpdatePasswordState = { error?: string; success?: string };

export async function updatePassword(_: UpdatePasswordState, formData: FormData): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password !== confirmation) return { error: "Passwords do not match." };
  if (!isStrongPassword(password)) return { error: "Use at least 12 characters with upper- and lowercase letters, a number, and a symbol." };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "This recovery link is invalid or expired. Request a new one." };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: "This recovery link is invalid or expired. Request a new one." };
    await supabase.auth.signOut({ scope: "others" });
    return { success: "Your password has been updated. You can now return to login." };
  } catch {
    return { error: "Password could not be updated. Request a new recovery link." };
  }
}

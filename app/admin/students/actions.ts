"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type StudentActionState = { error?: string; success?: string };

async function studentEmail(studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("email").eq("id", studentId).maybeSingle();
  return data?.email ?? null;
}

export async function resendStudentConfirmation(_: StudentActionState, formData: FormData): Promise<StudentActionState> {
  await requireAdmin();
  const studentId = String(formData.get("studentId") ?? "");
  const email = await studentEmail(studentId);
  if (!email) return { error: "Student not found." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) return { error: error.message };
  return { success: `Confirmation email resent to ${email}.` };
}

export async function confirmStudentEmailManually(_: StudentActionState, formData: FormData): Promise<StudentActionState> {
  await requireAdmin();
  const studentId = String(formData.get("studentId") ?? "");
  const admin = createAdminClient();
  if (!admin) return { error: "Admin email tools are not configured on this server." };

  const { error } = await admin.auth.admin.updateUserById(studentId, { email_confirm: true });
  if (error) return { error: error.message };
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);
  return { success: "Email confirmed manually. The student can sign in now." };
}

export async function sendStudentPasswordReset(_: StudentActionState, formData: FormData): Promise<StudentActionState> {
  await requireAdmin();
  const studentId = String(formData.get("studentId") ?? "");
  const email = await studentEmail(studentId);
  if (!email) return { error: "Student not found." };

  const origin = (await headers()).get("origin") || process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) return { error: "Could not determine the site URL." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin.replace(/\/$/, "")}/auth/callback?next=/update-password`,
  });
  if (error) return { error: error.message };
  return { success: `Password reset link sent to ${email}.` };
}

export async function setStudentActive(_: StudentActionState, formData: FormData): Promise<StudentActionState> {
  await requireAdmin();
  const studentId = String(formData.get("studentId") ?? "");
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", studentId);
  if (error) return { error: error.message };
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);
  return { success: active ? "Account reactivated." : "Account deactivated." };
}

function optionalNonNegativeInt(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
}

export async function setStudentAccessPackage(_: StudentActionState, formData: FormData): Promise<StudentActionState> {
  await requireAdmin();
  const studentId = String(formData.get("studentId") ?? "");
  const testLimit = optionalNonNegativeInt(formData, "testLimit");
  const validityDays = optionalNonNegativeInt(formData, "validityDays");
  const graceDays = optionalNonNegativeInt(formData, "graceDays") ?? 0;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_student_access", { p_student_id: studentId, p_test_limit: testLimit, p_validity_days: validityDays, p_grace_days: graceDays, p_locked: false });
  if (error) return { error: error.message };
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/admin/track");
  return { success: "Access package saved. Usage count resets from now." };
}

export async function setStudentAccessLocked(_: StudentActionState, formData: FormData): Promise<StudentActionState> {
  await requireAdmin();
  const studentId = String(formData.get("studentId") ?? "");
  const locked = formData.get("locked") === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_student_locked", { p_student_id: studentId, p_locked: locked });
  if (error) return { error: error.message };
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/admin/track");
  return { success: locked ? "Test access locked." : "Test access unlocked." };
}

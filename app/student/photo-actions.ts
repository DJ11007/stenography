"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Records a student's photo (already uploaded to the "student-photos" bucket under "<student id>/…"), or removes it.
// set_profile_photo lets a student set only their own photo and an admin anyone's.
export async function setProfilePhoto(studentId: string, path: string | null): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: old } = await supabase.from("profiles").select("photo_path").eq("id", studentId).maybeSingle();
  const { error } = await supabase.rpc("set_profile_photo", { p_student_id: studentId, p_path: path });
  if (error) return { ok: false, error: /photo_path|set_profile_photo/i.test(error.message) ? "Photos need the database update first (migration 202611011100)." : error.message };
  const previous = (old as { photo_path?: string | null } | null)?.photo_path;
  if (previous && previous !== path) await supabase.storage.from("student-photos").remove([previous]);
  revalidatePath("/student/profile");
  revalidatePath(`/admin/students/${studentId}`);
  return { ok: true };
}

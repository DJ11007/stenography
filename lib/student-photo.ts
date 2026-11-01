import type { createClient } from "@/lib/supabase/server";

// A student's photo for showing on a page: a short-lived signed link to the private "student-photos" bucket, or null
// when there is none (or before migration 202611011100 added the photo_path column).
export async function studentPhotoUrl(supabase: Awaited<ReturnType<typeof createClient>>, studentId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("photo_path").eq("id", studentId).maybeSingle();
  const path = error ? null : (data as { photo_path?: string | null } | null)?.photo_path;
  if (!path) return null;
  const { data: signed } = await supabase.storage.from("student-photos").createSignedUrl(path, 3600);
  return signed?.signedUrl ?? null;
}

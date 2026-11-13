"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// A student's own uploaded dictation audio, reusing the stenography-audio
// bucket admin-authored dictations already live in (see migration
// 202611131900) -- stored under "<their auth.uid()>/<file>" so the new
// storage policy can scope access to exactly their own folder. Mirrors
// createTestAssetUploadUrl (app/admin/tests/actions.ts): the browser
// uploads the file bytes directly to Supabase Storage via this short-lived
// signed URL/token, never through this Server Action itself, for the same
// hosting-platform body-size-limit reason documented there.
export async function createMyDictationUploadUrl(fileName: string): Promise<{ path: string; token: string; bucket: string } | { error: string }> {
  const user = await requireUser();
  const safeName = fileName.normalize("NFKC").replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, "-").slice(0, 120);
  const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("stenography-audio").createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Could not prepare the upload." };
  return { path: data.path, token: data.token, bucket: "stenography-audio" };
}

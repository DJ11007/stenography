import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The installed SCTyping app downloads a stenography test's dictation audio once, through this route:
// it returns a short-lived signed URL for ONLY an audio file an admin published to the app (the
// storage policy "Published app steno audio is readable" allows nothing else for anonymous callers).
const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400, headers });
  try {
    const supabase = await createClient();
    const { data: path } = await supabase.rpc("public_app_steno_audio_path", { p_id: id });
    if (!path || typeof path !== "string") return NextResponse.json({ error: "no audio" }, { status: 404, headers });
    const { data, error } = await supabase.storage.from("stenography-audio").createSignedUrl(path, 900);
    if (error || !data?.signedUrl) return NextResponse.json({ error: "unavailable" }, { status: 502, headers });
    return NextResponse.json({ url: data.signedUrl }, { headers });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502, headers });
  }
}

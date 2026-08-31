import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ language: string; testId: string }> }) {
  await requireStudent();
  await params;
  const attemptId = new URL(request.url).searchParams.get("attempt");
  if (!attemptId) return new NextResponse("Missing attempt.", { status: 400 });
  const supabase = await createClient();
  const { data: source, error } = await supabase.rpc("get_word_efficiency_realfile_source", { p_attempt_id: attemptId });
  if (error || !source?.storagePath) return new NextResponse("Working Matter file unavailable.", { status: 404 });
  const { data, error: signError } = await supabase.storage.from(source.bucket).createSignedUrl(source.storagePath, 60, { download: source.fileName ?? "working-matter.docx" });
  if (signError || !data?.signedUrl) return new NextResponse("Working Matter download failed. Please retry.", { status: 503 });
  return NextResponse.redirect(data.signedUrl);
}

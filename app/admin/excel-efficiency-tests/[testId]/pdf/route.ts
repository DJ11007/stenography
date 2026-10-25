import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// "Download Current PDF" in the admin's Question Delivery and PDF box (as for Word Efficiency).
export async function GET(_: Request, { params }: { params: Promise<{ testId: string }> }) {
  await requireAdmin();
  const { testId } = await params;
  const supabase = await createClient();
  const { data: test } = await supabase.from("excel_efficiency_tests").select("current_version_id").eq("id", testId).single();
  if (!test?.current_version_id) return new NextResponse("Not found", { status: 404 });
  const { data: version } = await supabase.from("excel_efficiency_versions").select("pdf_path").eq("id", test.current_version_id).single();
  if (!version?.pdf_path) return new NextResponse("No PDF is attached", { status: 404 });
  const { data, error } = await supabase.storage.from("excel-efficiency-pdfs").createSignedUrl(version.pdf_path, 60);
  if (error || !data) return new NextResponse("PDF unavailable", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}

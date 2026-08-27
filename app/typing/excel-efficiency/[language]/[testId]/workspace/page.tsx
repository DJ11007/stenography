import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExcelWorkspace } from "./excel-workspace";

export const metadata: Metadata = { title: "Excel Efficiency Workspace | Samradhi Classes", description: "Secure Excel Efficiency question-delivery and timed workspace." };

export default async function ExcelWorkspacePage({ params, searchParams }: { params: Promise<{ language: string; testId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { user } = await requireStudent();
  const route = await params;
  const query = await searchParams;
  const attemptId = query.attempt;
  if (!attemptId) redirect(`/typing/excel-efficiency/${route.language}`);
  const supabase = await createClient();
  const { data: attempt } = await supabase.from("excel_efficiency_attempts").select("id,test_id,student_id,status,started_at,snapshot,original_document_snapshot,document_autosave").eq("id", attemptId).eq("student_id", user.id).eq("test_id", route.testId).maybeSingle();
  if (!attempt) notFound();
  if (attempt.status === "submitted" || attempt.status === "completed") redirect(`/typing/excel-efficiency/results/${attempt.id}`);
  const snapshot = attempt.snapshot as Parameters<typeof ExcelWorkspace>[0]["snapshot"];
  if (snapshot.language.toLowerCase() !== route.language) notFound();
  return <ExcelWorkspace attemptId={attempt.id} snapshot={snapshot} status={attempt.status} startedAt={attempt.started_at} original={attempt.original_document_snapshot} initialDocument={attempt.document_autosave} />;
}

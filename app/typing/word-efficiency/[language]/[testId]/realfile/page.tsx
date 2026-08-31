import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RealFileWorkspace } from "./realfile-workspace";

export const metadata: Metadata = { title: "Word Efficiency — Real File | Samradhi Classes", description: "Download the Working Matter, edit it in MS Word, and upload your finished document." };

export default async function WordRealFilePage({ params, searchParams }: { params: Promise<{ language: string; testId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { user } = await requireStudent();
  const route = await params;
  const query = await searchParams;
  const attemptId = query.attempt;
  if (!attemptId) redirect(`/typing/word-efficiency/${route.language}`);
  const supabase = await createClient();
  const { data: attempt } = await supabase.from("word_efficiency_attempts").select("id,test_id,student_id,status,started_at,snapshot,delivery_method,selected_duration_seconds").eq("id", attemptId).eq("student_id", user.id).eq("test_id", route.testId).maybeSingle();
  if (!attempt) notFound();
  if (attempt.delivery_method !== "realfile") redirect(`/typing/word-efficiency/${route.language}/${route.testId}/workspace?attempt=${attempt.id}`);
  if (attempt.status === "submitted" || attempt.status === "completed") redirect(`/typing/word-efficiency/results/${attempt.id}`);
  const snapshot = attempt.snapshot as Parameters<typeof RealFileWorkspace>[0]["snapshot"];
  if (snapshot.language.toLowerCase() !== route.language) notFound();
  return <RealFileWorkspace attemptId={attempt.id} language={route.language} testId={route.testId} snapshot={snapshot} startedAt={attempt.started_at} />;
}

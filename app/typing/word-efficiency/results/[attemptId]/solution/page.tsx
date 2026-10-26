import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PaperSolution, type PaperSolutionData } from "@/components/efficiency/paper-solution";

export const metadata: Metadata = { title: "Paper Solution | Word Efficiency" };

// The paper solution of a Word Efficiency test, opened from the student's result page (migration 202610261200).
export default async function WordPaperSolutionPage({ params }: { params: Promise<{ attemptId: string }> }) {
  await requireStudent();
  const { attemptId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_word_efficiency_solution", { p_attempt_id: attemptId });
  if (error || !data || (data as PaperSolutionData).reason === "not found") notFound();
  return <PaperSolution subject="Word" solution={data as PaperSolutionData} resultHref={`/typing/word-efficiency/results/${attemptId}`} />;
}

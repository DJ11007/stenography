import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PaperSolution, type PaperSolutionData } from "@/components/efficiency/paper-solution";

export const metadata: Metadata = { title: "Paper Solution | Excel Efficiency" };

// The paper solution of an Excel Efficiency test, opened from the student's result page (migration 202610261000).
export default async function ExcelPaperSolutionPage({ params }: { params: Promise<{ attemptId: string }> }) {
  await requireStudent();
  const { attemptId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_excel_efficiency_solution", { p_attempt_id: attemptId });
  if (error || !data || (data as PaperSolutionData).reason === "not found") notFound();
  return <PaperSolution subject="Excel" solution={data as PaperSolutionData} resultHref={`/typing/excel-efficiency/results/${attemptId}`} />;
}

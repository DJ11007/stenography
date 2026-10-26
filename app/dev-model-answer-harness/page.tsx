// TEMPORARY, local development only -- not committed. Renders the real Word
// Efficiency editor exactly as the admin Model Answer page does, so a model
// answer can be solved without an admin session; each "Save" keeps the
// document snapshot in window.__snapshots for building grading rules.
import { notFound } from "next/navigation";
import test1 from "./test1.json";
import test2 from "./test2.json";
import test2v2 from "./test2v2.json";
import test3 from "./test3.json";
import test4 from "./test4.json";
import questions2 from "./questions2.json";
import questions3 from "./questions3.json";
import questions4 from "./questions4.json";
import { Harness } from "./harness";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ test?: string; version?: string; model?: string; file?: string }> }) {
  const { test: which, version, model, file } = await searchParams;
  if (process.env.NODE_ENV !== "development") notFound();
  // ?version=<id>: the saved version straight from the database (the signed-in admin session).
  if (version) {
    const supabase = await createClient();
    const { data: saved } = await supabase.from("word_efficiency_versions").select("working_matter_snapshot,model_answer_snapshot,editor_capabilities").eq("id", version).single();
    const { data: rows } = await supabase.from("word_efficiency_questions").select("id,question_number,display_order,instruction,marks,section,is_visible").eq("version_id", version).order("display_order");
    if (!saved) notFound();
    const questions = (rows ?? []).map(row => ({ ...row, question_version_id: row.id, number: row.question_number, marks: Number(row.marks) }));
    // ?model=1: open the finished model answer instead (for paper-solution screenshots).
    // Test 2 (d5e201a5): its saved model answer still has paragraph 1 red on yellow from an older paper;
    // the current paper (and the marking rules) want it green with "Guru" highlighted pink.
    const initial = model ? structuredClone(saved.model_answer_snapshot) as { blocks?: { runs?: { text: string; color: string | null; highlight: string | null }[] }[] } | null : null;
    // ?file=hindi-test1-model: a solved document from tests/fixtures (the Hindi tests have no saved model answer).
    const fixture = file && /^[a-z0-9-]+$/.test(file) ? JSON.parse(await (await import("node:fs/promises")).readFile(`${process.cwd()}/tests/fixtures/word-efficiency-${file}.json`, "utf8")) : null;
    if (fixture) return <Harness original={saved.working_matter_snapshot as never} initial={fixture} capabilities={saved.editor_capabilities} questions={questions as never} />;
    if (initial && version.startsWith("d5e201a5")) { for (const run of initial.blocks?.[1]?.runs ?? []) { run.color = "00B050"; run.highlight = run.text === "Guru" ? "FF00FF" : null; } (initial as { pageLayout?: Record<string, unknown> }).pageLayout!.border = "1.5px solid rgb(0, 0, 0) sides:bottom,right"; }
    return <Harness original={saved.working_matter_snapshot as never} initial={initial} capabilities={saved.editor_capabilities} questions={questions as never} />;
  }
  const data = which === "1" ? test1 : which === "2v2" ? test2v2 : which === "3" ? test3 : which === "4" ? test4 : test2;
  if (process.env.NODE_ENV !== "development") notFound();
  return <Harness original={data.working_matter_snapshot as never} capabilities={data.editor_capabilities} questions={which === "4" ? questions4 : which === "3" ? questions3 : questions2} />;
}

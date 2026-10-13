import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { WorkingMatterSnapshot } from "@/lib/word-docx";
import { WorkingMatterEditorPage } from "./working-matter-editor-page";

export const metadata: Metadata = { title: "Working Document | Admin" };

// The full-screen document editor. ?edit=<test id> edits an existing test's document; with no
// ?edit it is for a test that has not been saved yet. ?language=Hindi|English comes from the form.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const editId = params.edit || "";
  let title = "New test";
  let initial: WorkingMatterSnapshot | null = null;
  let language: "English" | "Hindi" = params.language === "Hindi" ? "Hindi" : "English";
  if (editId) {
    const supabase = await createClient();
    const { data: test } = await supabase.from("word_efficiency_tests").select("id,title,language,current_version_id").eq("id", editId).maybeSingle();
    if (test) {
      title = test.title;
      if (!params.language) language = test.language === "Hindi" ? "Hindi" : "English";
      const { data: version } = test.current_version_id ? await supabase.from("word_efficiency_versions").select("working_matter_snapshot").eq("id", test.current_version_id).maybeSingle() : { data: null };
      initial = (version?.working_matter_snapshot as WorkingMatterSnapshot | null) ?? null;
    }
  }
  const back = `/admin/word-efficiency-tests/design${editId ? `?edit=${encodeURIComponent(editId)}` : ""}`;
  return <WorkingMatterEditorPage target={editId || "new"} language={language} title={title} initialSnapshot={initial} backHref={back} />;
}

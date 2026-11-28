import { createClient } from "./supabase/server";
import { paperFromRow, type PreviousYearPaper, type PreviousYearSection } from "./previous-year-papers";

const COLUMNS = "section,test_id,exam_name,exam_date,exam_year,description";

// Before migration 202611282000 is applied the table does not exist: every page then simply shows no labels.
function tableMissing(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || /previous_year_papers/.test(error.message ?? ""));
}

/** The previous-year labels of these tests of one section, by test id. */
export async function getPreviousYearMap(section: PreviousYearSection, testIds: string[]): Promise<Map<string, PreviousYearPaper>> {
  if (!testIds.length) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.from("previous_year_papers").select(COLUMNS).eq("section", section).in("test_id", testIds);
  if (error) {
    if (!tableMissing(error)) console.error("Previous year papers query failed", { code: error.code, message: error.message });
    return new Map();
  }
  return new Map((data ?? []).map((row) => [row.test_id as string, paperFromRow(row)]));
}

export type OldExamPaper = PreviousYearPaper & { title: string; language: string; href: string };

/** Every labelled test that students can open, with its title and the link that starts the full test. */
export async function listOldExamPapers(): Promise<OldExamPaper[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("previous_year_papers").select(COLUMNS).limit(2000);
  if (error) {
    if (!tableMissing(error)) console.error("Old exam papers query failed", { code: error.code, message: error.message });
    return [];
  }
  const papers = (data ?? []).map(paperFromRow);
  const idsOf = (sections: PreviousYearSection[]) => papers.filter((paper) => sections.includes(paper.section)).map((paper) => paper.testId);
  const managedIds = idsOf(["typing", "stenography"]), wordIds = idsOf(["word"]), excelIds = idsOf(["excel"]);
  const [managed, word, excel] = await Promise.all([
    managedIds.length ? supabase.from("tests").select("id,slug,title,language,mode,settings").in("id", managedIds).eq("status", "published").eq("visibility", "public") : Promise.resolve({ data: [] }),
    wordIds.length ? supabase.from("word_efficiency_tests").select("id,title,language").in("id", wordIds).eq("status", "published") : Promise.resolve({ data: [] }),
    excelIds.length ? supabase.from("excel_efficiency_tests").select("id,title,language").in("id", excelIds).eq("status", "published") : Promise.resolve({ data: [] }),
  ]);
  const links = new Map<string, { title: string; language: string; href: string }>();
  for (const test of (managed.data ?? []) as { id: string; slug: string; title: string; language: string; mode: string; settings: Record<string, unknown> | null }[]) {
    const settings = test.settings ?? {};
    const category = test.mode === "stenography" ? settings.steno_category : settings.exam_category;
    const param = typeof category === "string" && category ? `?${test.mode === "stenography" ? "exam" : "viewAs"}=${encodeURIComponent(category)}` : "";
    links.set(`${test.mode === "stenography" ? "stenography" : "typing"}:${test.id}`, { title: test.title, language: test.language, href: `/tests/${test.slug}${param}` });
  }
  for (const test of (word.data ?? []) as { id: string; title: string; language: string }[])
    links.set(`word:${test.id}`, { title: test.title, language: test.language, href: `/typing/word-efficiency/${test.language.toLowerCase()}/${test.id}/instructions` });
  for (const test of (excel.data ?? []) as { id: string; title: string; language: string }[])
    links.set(`excel:${test.id}`, { title: test.title, language: test.language, href: `/typing/excel-efficiency/${test.language.toLowerCase()}/${test.id}/instructions` });
  return papers.flatMap((paper) => {
    const link = links.get(`${paper.section}:${paper.testId}`);
    return link ? [{ ...paper, ...link }] : [];
  });
}

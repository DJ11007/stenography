import "server-only";
import { createClient } from "./supabase/server";
import { inTitleSequence, missingSequenceColumn } from "./efficiency-order";
import type { ExcelLanguage, ExcelTest, ExcelVersion } from "./excel-efficiency";

export async function getExcelCatalogue(language: ExcelLanguage, { search = "", page = 1, pageSize = 10 } = {}) {
  const supabase = await createClient();
  // The admin's order (`sequence`, migration 202611081000) when it is there; the title number otherwise.
  const listTests = async (columns: string) => {
    let query = supabase.from("excel_efficiency_tests").select(columns, { count: "exact" }).eq("language", language).eq("status", "published");
  if (search.trim()) query = query.ilike("title", `%${search.trim().replace(/[%_]/g, "\\$&")}%`);
    return (await query) as unknown as {data:{id:string;slug:string;title:string;language:string;status:string;current_version_id:string;current_version_number:number;published_at:string|null;updated_at:string;is_live:boolean;sequence?:number|null}[]|null;error:{message:string}|null;count:number|null};
  };
  let { data: allTests, error, count } = await listTests("id,slug,title,language,status,current_version_id,current_version_number,published_at,updated_at,is_live,sequence");
  if (missingSequenceColumn(error)) ({ data: allTests, error, count } = await listTests("id,slug,title,language,status,current_version_id,current_version_number,published_at,updated_at,is_live")); const tests = inTitleSequence(allTests ?? []).slice((page - 1) * pageSize, page * pageSize);
  if (error) throw new Error(`Excel Efficiency catalogue unavailable: ${error.message}`);
  const ids = (tests ?? []).map((t) => t.current_version_id);
  const { data: versions, error: versionError } = ids.length ? await supabase.from("excel_efficiency_versions").select("id,test_id,version_number,title,language,description,instructions_markdown,question_count,maximum_marks,duration_options,passing_marks").in("id", ids) : { data: [], error: null };
  if (versionError) throw new Error(`Excel Efficiency versions unavailable: ${versionError.message}`);
  const { data: { user } } = await supabase.auth.getUser();
  const { data: attempts } = user && tests?.length ? await supabase.from("excel_efficiency_attempts").select("test_id,status,result,submitted_at").eq("student_id", user.id).in("test_id", tests.map((t) => t.id)) : { data: [] };
  const versionMap = new Map((versions ?? []).map((v) => [v.id, v as ExcelVersion]));
  return { tests: (tests ?? []).map((test, index) => ({ test: test as ExcelTest, version: versionMap.get(test.current_version_id)!, number: (page - 1) * pageSize + index + 1, attempts: (attempts ?? []).filter((a) => a.test_id === test.id) })).filter((item) => item.version), count: count ?? 0, page, pageSize };
}

export async function getPublishedExcelTest(language: ExcelLanguage, testId: string) {
  const supabase = await createClient();
  const { data: test, error } = await supabase.from("excel_efficiency_tests").select("id,slug,title,language,status,current_version_id,current_version_number,published_at,updated_at,is_live").eq("id", testId).eq("language", language).eq("status", "published").maybeSingle();
  if (error || !test) return null;
  const { data: version } = await supabase.from("excel_efficiency_versions").select("*").eq("id", test.current_version_id).maybeSingle();
  return version ? { test: test as ExcelTest, version: version as ExcelVersion } : null;
}

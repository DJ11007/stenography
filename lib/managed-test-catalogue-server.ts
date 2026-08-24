import type { ManagedTestMode } from "./admin-tests";
import { createClient } from "./supabase/server";

export type ManagedCatalogueTest = { id:string; title:string; slug:string; description:string|null; language:string; mode:ManagedTestMode; input_system_id:string; duration_seconds:number; required_wpm:number; required_accuracy:number };

export async function getPublishedManagedTests(mode: ManagedTestMode, filters: { language?: "English" | "Hindi"; inputSystemId?: string } = {}): Promise<ManagedCatalogueTest[]> {
  const supabase = await createClient();
  let query = supabase.from("tests").select("id,title,slug,description,language,mode,input_system_id,duration_seconds,current_version_id").eq("mode", mode).eq("status", "published").eq("visibility", "public").eq("is_live", false).not("current_version_id", "is", null);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.inputSystemId) query = query.eq("input_system_id", filters.inputSystemId);
  const { data, error } = await query.order("published_at", { ascending: false });
  if (error) {
    console.error("Managed test catalogue query failed", { mode, filters, code: error.code, message: error.message });
    throw new Error(`The ${mode} test catalogue could not be loaded (${error.code || "database error"}).`);
  }
  if (!data?.length) return [];
  const versionIds = data.flatMap((test) => test.current_version_id ? [test.current_version_id] : []);
  const { data: versions, error: versionError } = await supabase.from("test_versions").select("id,required_wpm,required_accuracy").in("id", versionIds);
  if (versionError) {
    console.error("Managed test catalogue version query failed", { mode, filters, code: versionError.code, message: versionError.message });
    throw new Error(`The ${mode} test targets could not be loaded (${versionError.code || "database error"}).`);
  }
  const targets = new Map((versions ?? []).map((version) => [version.id, version]));
  return data.flatMap((test) => { const target = targets.get(test.current_version_id!); return target ? [{ ...test, required_wpm:Number(target.required_wpm), required_accuracy:Number(target.required_accuracy) } as ManagedCatalogueTest] : []; });
}

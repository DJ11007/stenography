import { createClient } from "./supabase/server";
import { buildManagedLearningTests } from "./managed-learning";

export async function getPublishedLearningTests(language?: "English" | "Hindi") {
  const supabase = await createClient();
  let query = supabase.from("tests").select("id,slug,title,language,current_version_id,published_at").eq("mode", "learn").eq("visibility", "public").eq("status", "published").eq("is_live", false).not("current_version_id", "is", null).neq("title", "").order("published_at", { ascending: true });
  if (language) query = query.eq("language", language);
  const { data: tests, error } = await query;
  if (error) {
    console.error("Learning catalogue test query failed", { code: error.code, message: error.message });
    throw new Error(`The learning catalogue could not be loaded from the database (${error.code || "database error"}).`);
  }
  if (!tests?.length) return [];
  const versionIds = tests.flatMap((test) => test.current_version_id ? [test.current_version_id] : []);
  const { data: versions, error: versionError } = await supabase.from("test_versions").select("id,description,passage,required_accuracy,duration_seconds,configuration").in("id", versionIds).neq("passage", "");
  if (versionError) {
    console.error("Learning catalogue version query failed", { code: versionError.code, message: versionError.message });
    throw new Error(`The learning catalogue passages could not be loaded from the database (${versionError.code || "database error"}).`);
  }
  return buildManagedLearningTests(tests, versions ?? []);
}

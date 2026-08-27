import { createClient } from "./supabase/server";
import { normalizeTaskCategory, type StenographyTaskSummary } from "./stenography-task-library";

export async function getPublishedStenographyTasks(language: "English" | "Hindi"): Promise<StenographyTaskSummary[]> {
  const supabase = await createClient();
  const { data: tests, error } = await supabase
    .from("tests")
    .select("id,slug,current_version_id")
    .eq("mode", "stenography")
    .eq("language", language)
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("is_live", false);
  if (error) { console.error("Stenography task library listing failed", error); return []; }
  const versionIds = (tests ?? []).flatMap((test) => (test.current_version_id ? [test.current_version_id] : []));
  if (!versionIds.length) return [];
  const { data: versions, error: versionError } = await supabase
    .from("test_versions")
    .select("id,title,input_system_id,duration_seconds,required_wpm,required_accuracy,configuration")
    .in("id", versionIds);
  if (versionError) { console.error("Stenography task library version listing failed", versionError); return []; }
  const versionMap = new Map((versions ?? []).map((version) => [version.id, version]));
  return (tests ?? []).flatMap((test) => {
    const version = test.current_version_id ? versionMap.get(test.current_version_id) : null;
    if (!version) return [];
    const configuration = (version.configuration ?? {}) as Record<string, unknown>;
    return [{
      testId: test.id, slug: test.slug, title: version.title, category: normalizeTaskCategory(configuration.task_category),
      language, inputSystemId: version.input_system_id, durationSeconds: version.duration_seconds,
      requiredWpm: Number(version.required_wpm), requiredAccuracy: Number(version.required_accuracy),
      hasAudio: Boolean(configuration.audio_path),
    } satisfies StenographyTaskSummary];
  });
}

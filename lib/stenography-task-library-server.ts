import { createClient } from "./supabase/server";
import { normalizeTaskCategory, type StenographyTaskSummary } from "./stenography-task-library";

export async function getPublishedStenographyTasks(language: "English" | "Hindi"): Promise<StenographyTaskSummary[]> {
  const supabase = await createClient();
  const [{ data: tests, error }, { data: { user } }] = await Promise.all([
    supabase
      .from("tests")
      .select("id,slug,current_version_id,published_at")
      .eq("mode", "stenography")
      .eq("language", language)
      .eq("status", "published")
      .eq("visibility", "public")
      .eq("is_live", false),
    supabase.auth.getUser(),
  ]);
  if (error) { console.error("Stenography task library listing failed", error); return []; }
  const versionIds = (tests ?? []).flatMap((test) => (test.current_version_id ? [test.current_version_id] : []));
  if (!versionIds.length) return [];
  const testIds = (tests ?? []).map((test) => test.id);
  const [{ data: versions, error: versionError }, { data: attempts }] = await Promise.all([
    supabase
      .from("test_versions")
      .select("id,title,input_system_id,duration_seconds,required_wpm,required_accuracy,passage_words,configuration")
      .in("id", versionIds),
    // "Done" only reflects this student's own attempts -- never another
    // student's, and never shown at all when there's no signed-in user
    // (e.g. a server error upstream left `user` null; safer to just not
    // badge anything than to badge every test as done for everyone).
    user ? supabase.from("test_attempts").select("test_id").eq("student_id", user.id).in("test_id", testIds) : Promise.resolve({ data: [] as { test_id: string }[] }),
  ]);
  if (versionError) { console.error("Stenography task library version listing failed", versionError); return []; }
  const versionMap = new Map((versions ?? []).map((version) => [version.id, version]));
  const completedIds = new Set((attempts ?? []).map((attempt) => attempt.test_id));
  return (tests ?? []).flatMap((test) => {
    const version = test.current_version_id ? versionMap.get(test.current_version_id) : null;
    if (!version) return [];
    const configuration = (version.configuration ?? {}) as Record<string, unknown>;
    return [{
      testId: test.id, slug: test.slug, title: version.title, category: normalizeTaskCategory(configuration.task_category),
      language, inputSystemId: version.input_system_id, durationSeconds: version.duration_seconds,
      requiredWpm: Number(version.required_wpm), requiredAccuracy: Number(version.required_accuracy),
      passageWords: version.passage_words ?? 0, publishedAt: test.published_at,
      hasAudio: Boolean(configuration.audio_path), completed: completedIds.has(test.id),
    } satisfies StenographyTaskSummary];
  });
}

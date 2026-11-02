import type { createClient } from "@/lib/supabase/server";

// The admin test lists need each test's current version settings, not its passage: with ~200 tests a section,
// sending every passage (stored twice -- in the passage column and again in configuration.passage) made the page
// 1.2-1.7 MB and about 3 s to load, and it failed with "This page couldn't load" after creating a test, when the
// whole list is sent again. The passage of the one test being edited is loaded on Edit (loadTestVersionPassage).
const VERSION_COLUMNS = "id,test_id,version_number,title,description,language,mode,input_system_id,duration_seconds,required_wpm,required_accuracy,backspace_mode,word_method,highlight_mode,visibility,passage_characters,passage_words,configuration,created_by,created_at";

export async function loadManagedVersionSummaries(supabase: Awaited<ReturnType<typeof createClient>>, versionIds: string[]) {
  if (!versionIds.length) return [];
  const { data } = await supabase.from("test_versions").select(VERSION_COLUMNS).in("id", versionIds);
  return (data ?? []).map((version) => {
    const configuration = { ...((version.configuration ?? {}) as Record<string, unknown>) };
    delete configuration.passage;
    return { ...version, configuration, passage: null as string | null };
  });
}

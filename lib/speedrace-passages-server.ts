import { createClient } from "./supabase/server";

export type SpeedRacePassage = { id: string; title: string; passage: string };

// Real reported request: an admin wants to write real passages for
// Speed Race and let students choose among them, instead of every race
// being silently auto-built from the chosen category's word bank. This
// is a live query (no caching -- createClient() forces dynamic
// rendering), so a freshly published passage appears immediately. An
// empty result (no rows published for this language yet) means the
// caller should fall back to the existing buildSpeedRacePassage()
// behavior, unchanged.
export async function getSpeedRacePassages(language: "hindi" | "english"): Promise<SpeedRacePassage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_published_speedrace_passages", { p_language: language });
  if (error || !Array.isArray(data)) return [];
  return (data as { id: string; title: string; passage: string }[]).map((row) => ({ id: row.id, title: row.title, passage: row.passage }));
}

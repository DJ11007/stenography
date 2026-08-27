import { createClient } from "./supabase/server";
import { mapClassroomUpdateRow, mapLiveClassRow, type ClassroomUpdate, type LiveClassLink } from "./classroom";

export async function getPublishedClassroomUpdates(limit = 20): Promise<ClassroomUpdate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_published_classroom_updates", { p_limit: limit });
  if (error) { console.error("Classroom update listing failed", error); return []; }
  return (data ?? []).map(mapClassroomUpdateRow);
}

export async function getLiveClassLink(): Promise<LiveClassLink> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_live_class_link");
  if (error || !data) { if (error) console.error("Live class link lookup failed", error); return { url: null, isActive: false }; }
  return mapLiveClassRow(data);
}

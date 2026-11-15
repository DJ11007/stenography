import { createClient } from "@/lib/supabase/server";

export type SiteStats = { students: number; downloads: number };

// Homepage counters (see supabase/migrations/202611151100_site_stats.sql). Returns null on any
// failure so the homepage simply omits the strip rather than showing a misleading zero.
export async function getSiteStats(): Promise<SiteStats | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("public_site_stats");
    if (error || !data) return null;
    const stats = data as { students?: number; downloads?: number };
    return { students: Number(stats.students ?? 0), downloads: Number(stats.downloads ?? 0) };
  } catch {
    return null;
  }
}

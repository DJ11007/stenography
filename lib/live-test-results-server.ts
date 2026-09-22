import { createClient } from "./supabase/server";

// A PostgrestError extends Error, and Error instances lose their own
// properties (message/code/details/hint) when Next.js forwards a server
// console.error call to the browser's dev overlay -- they render as an
// unhelpful "{}" there even though the error itself is populated. Logging
// the specific fields as a plain object survives that forwarding intact.
function logRpcFailure(label: string, error: { message: string; code: string; details: string; hint: string }) {
  console.error(label, { message: error.message, code: error.code, details: error.details, hint: error.hint });
}

export type PublicLiveResult = { student_name: string; test_title: string; language: string; net_wpm: number; accuracy: number; submitted_at: string };
export type LiveTestTopRanker = { student_id: string; student_name: string; net_wpm: number };
export type LiveEfficiencyTest = { id: string; subject: "word" | "excel"; slug: string; title: string; language: string; is_live: boolean; live_starts_at: string | null; live_ends_at: string | null; results_publish_at: string | null; duration_options: number[] };

export async function getPublishedLiveResults(limit = 30): Promise<PublicLiveResult[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("published_live_results", { p_limit: limit });
  if (error) { logRpcFailure("Live results listing failed", error); return []; }
  return (data ?? []) as PublicLiveResult[];
}

// Per-language top-3 podium for the homepage -- the one narrow, approved
// exception where a real name (not the usual X••• anonymization) is
// shown, scoped to just the top few ranks. See published_live_results
// above for the still-anonymized general results feed.
export async function getLiveTestTopRankers(language: string, limit = 3): Promise<LiveTestTopRanker[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("published_live_test_top_rankers", { p_language: language, p_limit: limit });
  if (error) { logRpcFailure(`Top rankers listing failed (${language})`, error); return []; }
  return (data ?? []) as LiveTestTopRanker[];
}

export async function getLiveEfficiencyTests(): Promise<LiveEfficiencyTest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("published_live_efficiency_tests");
  if (error) { logRpcFailure("Live efficiency tests listing failed", error); return []; }
  return (data ?? []) as LiveEfficiencyTest[];
}

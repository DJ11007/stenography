import { createClient } from "@/lib/supabase/server";
import { LiveResultsByLanguage } from "@/app/_components/live-results-by-language";
import { BackButton } from "@/app/_components/back-button";
import { LiveTestList, type LiveTest } from "./live-test-list";
import { getPublishedLiveResults, getLiveEfficiencyTests } from "@/lib/live-test-results-server";

export default async function LiveTestCentre(){
  const supabase=await createClient();
  const[{data:tests},results,efficiencyTests]=await Promise.all([
    supabase.from("tests").select("id,title,slug,description,language,mode,duration_seconds,live_starts_at,live_ends_at,results_publish_at,results_delay_minutes,is_live").eq("status","published").eq("visibility","public").eq("is_live",true).order("live_starts_at",{ascending:false}),
    getPublishedLiveResults(30),
    getLiveEfficiencyTests(),
  ]);
  // Typing/Stenography are both rows in public.tests (a genuinely public
  // table today); Efficiency tests come from the separate, RLS-restricted
  // word/excel tables via a SECURITY DEFINER RPC (see the migration's own
  // comment for why a direct table read there would silently break for
  // anonymous visitors). Normalizing all three into one LiveTest[] shape
  // lets LiveTestList group/filter them the same way.
  const entries: LiveTest[] = [
    ...(tests ?? []).map((test) => ({
      id: test.id, title: test.title, slug: test.slug, description: test.description, language: test.language,
      duration_seconds: test.duration_seconds, live_starts_at: test.live_starts_at, live_ends_at: test.live_ends_at,
      results_publish_at: test.results_publish_at, results_delay_minutes: test.results_delay_minutes, is_live: test.is_live,
      category: (test.mode === "stenography" ? "Stenography" : "Typing") as LiveTest["category"],
      startHref: `/tests/${test.slug}`, resultsHref: "/live-test",
    })),
    ...efficiencyTests.map((test) => ({
      id: test.id, title: test.title, slug: test.slug, description: null, language: test.language,
      duration_seconds: test.duration_options.length ? Math.max(...test.duration_options) : 0,
      live_starts_at: test.live_starts_at, live_ends_at: test.live_ends_at, results_publish_at: test.results_publish_at,
      results_delay_minutes: null, is_live: test.is_live,
      category: "Efficiency" as LiveTest["category"],
      startHref: `/typing/${test.subject}-efficiency/${test.language.toLowerCase()}/${test.id}/instructions`, resultsHref: "/student/results",
    })),
  ];
  return <main className="min-h-screen bg-slate-100"><section className="bg-gradient-to-br from-blue-800 to-indigo-950 px-4 py-12 text-white"><div className="mx-auto max-w-7xl"><BackButton href="/typing" label="Typing Hub" dark/><p className="mt-6 text-sm font-black uppercase tracking-[.2em] text-blue-200">Free for registered students</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Samradhi Live Test Centre</h1><p className="mt-4 max-w-3xl text-blue-100">Join during the scheduled window (or anytime, for tests marked Anytime), submit one secure attempt, and see your own result once it unlocks.</p></div></section><section className="mx-auto max-w-7xl px-4 py-10"><h2 className="text-2xl font-black">Scheduled live tests</h2><div className="mt-5">{entries.length?<LiveTestList tests={entries}/>:<p className="rounded-2xl bg-white p-7 text-slate-600 shadow">No free live test is scheduled yet. Please check again soon.</p>}</div><div className="mt-12 flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-blue-700">Released leaderboard</p><h2 className="mt-1 text-2xl font-black">Latest student results</h2></div></div><div className="mt-5"><LiveResultsByLanguage results={results}/></div><p className="mt-4 text-xs text-slate-500">Results appear automatically only after the administrator-scheduled publication time.</p></section></main>;
}

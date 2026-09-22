import type { LiveTestTopRanker } from "@/lib/live-test-results-server";

const CROWN = ["🥇", "🥈", "🥉"];
// Same gold/silver/bronze gradient values as lib/game-rooms.ts's
// gameRoomPodiumTone (the WordTris/Speed Race live-classroom-race
// podium) -- copied rather than imported, since that's a different
// domain/table, purely for visual consistency between the two podiums
// this app now has.
const TONE = [
  "from-amber-400 to-yellow-500 text-amber-950",
  "from-slate-300 to-slate-400 text-slate-900",
  "from-orange-400 to-amber-600 text-orange-950",
];

function Podium({ language, rankers }: { language: string; rankers: LiveTestTopRanker[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{language}</h3>
      {rankers.length ? (
        <div className="mt-3 space-y-2">
          {rankers.map((r, i) => (
            <div key={r.student_id} className={`flex items-center justify-between rounded-xl bg-gradient-to-r px-3.5 py-2.5 text-sm ${TONE[i] ?? "bg-slate-50 text-slate-700"}`}>
              <span className="flex items-center gap-2 font-black">
                <span aria-hidden="true">{CROWN[i] ?? "🏅"}</span>
                {r.student_name}
              </span>
              <strong>{Number(r.net_wpm).toFixed(1)} WPM</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2.5 text-sm text-slate-500">No published results yet for {language}.</p>
      )}
    </div>
  );
}

// Real requested feature: a homepage "Top Rankers" podium, gold/silver/
// bronze, name + net WPM, scoped to just the top 3 per language (the
// general published_live_results ticker also shows full names now, so
// this is no longer the only real-name exception -- see
// lib/live-test-results-server.ts). Two separate podiums (not one
// combined ranking) per the "show results different different by
// language" request.
export function LiveTestTopRankers({ english, hindi }: { english: LiveTestTopRanker[]; hindi: LiveTestTopRanker[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Podium language="Hindi" rankers={hindi} />
      <Podium language="English" rankers={english} />
    </div>
  );
}

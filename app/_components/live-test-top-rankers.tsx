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

// Real requested feature: top 10 (was top 3) per language. Ranks 1-3 keep
// the crown/gradient podium treatment unchanged; 4-10 get a plain numbered
// badge instead of repeating the bronze crown ten times. The rows list is
// height-capped with internal scrolling (not the whole card growing
// unbounded) so the Hindi and English cards stay the same size as each
// other regardless of how many of the 10 slots either language actually
// has filled, and so this section doesn't grow taller than it needs to.
function Podium({ language, rankers }: { language: string; rankers: LiveTestTopRanker[] }) {
  return (
    <div className="flex h-full flex-col justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{language}</h3>
      {rankers.length ? (
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-0.5">
          {rankers.map((r, i) => (
            <div key={r.student_id} className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm ${i < 3 ? `bg-gradient-to-r ${TONE[i]}` : "bg-slate-50 text-slate-700"}`}>
              {/* Real bug found live: a long name (e.g. "mahesh kumar
                  bairwa") overflowed this row horizontally, triggering an
                  unwanted horizontal scrollbar on the whole card -- flex
                  children don't shrink below their content's intrinsic
                  width without min-w-0, so `truncate` on the name span
                  never actually got the chance to kick in. */}
              <span className="flex min-w-0 flex-1 items-center gap-2 font-black">
                {i < 3 ? (
                  <span aria-hidden="true">{CROWN[i]}</span>
                ) : (
                  <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] text-slate-600">{i + 1}</span>
                )}
                <span className="truncate">{r.student_name}</span>
              </span>
              <strong className="shrink-0">{Number(r.net_wpm).toFixed(1)} WPM</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2.5 text-sm text-slate-500">No published results yet for {language}.</p>
      )}
    </div>
  );
}

// Real requested feature: a homepage "Top Rankers" leaderboard, name +
// net WPM, scoped to the top 10 per language (gold/silver/bronze crowns
// for 1-3, a plain numbered badge for 4-10) -- the general
// published_live_results ticker also shows full names now, so this is no
// longer the only real-name exception -- see lib/live-test-results-server.ts.
// Two separate leaderboards (not one combined ranking) per the "show
// results different different by language" request.
export function LiveTestTopRankers({ english, hindi }: { english: LiveTestTopRanker[]; hindi: LiveTestTopRanker[] }) {
  return (
    <div className="grid h-full gap-4 sm:grid-cols-2">
      <Podium language="Hindi" rankers={hindi} />
      <Podium language="English" rankers={english} />
    </div>
  );
}

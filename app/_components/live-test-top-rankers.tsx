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

// Real requested follow-up: showing 10 entries in a height-capped,
// scrollable list meant only ~6 were visible at a glance, and centering
// the content (justify-center) inside a box that stretched to match
// whichever success-story slide happened to be showing made the rows
// visibly jump/re-center every time the carousel auto-rotated (every
// student's testimonial is a different length). Both fixed here: no more
// scroll cap -- all up to 10 rows render in full, top to bottom -- and
// this card no longer stretches to or centers within an externally
// determined height; app/page.tsx now gives the whole row (both podiums
// + the success-story card) one shared, STATIC height instead, with this
// card's own natural 10-row content as the height that static value is
// based on (see the comment there).
function Podium({ language, heading, rankers }: { language: string; heading: string; rankers: LiveTestTopRanker[] }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{heading}</h3>
      {rankers.length ? (
        <div className="mt-3 space-y-2">
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
//
// Real requested follow-up: a shared "TOP RANKERS" / "Live-test
// leaderboard" header used to sit above both columns (app/page.tsx) --
// removed entirely. "Top Rankers" now reads as the Hindi card's own
// heading instead (it visually sat above Hindi anyway), and "Live-test
// leaderboard" text no longer appears anywhere; English keeps its plain
// "English" heading.
export function LiveTestTopRankers({ english, hindi }: { english: LiveTestTopRanker[]; hindi: LiveTestTopRanker[] }) {
  return (
    <div className="grid h-full gap-4 sm:grid-cols-2">
      <Podium language="Hindi" heading="Top Rankers — Hindi Live Test" rankers={hindi} />
      <Podium language="English" heading="English" rankers={english} />
    </div>
  );
}

import Link from "next/link";
import { TypingBrandHeader } from "../_components/typing-brand";

// A small hub, room for more games later -- WordTris today, matching the
// existing "Word Efficiency is its own top-level area linked from the
// Typing Hub" convention rather than bolting the game straight onto the
// hub grid.
const games = [
  {
    title: "WordTris",
    description: "Catch falling words or single keystrokes before they land -- speed eases off after a miss, then ramps back up. Hindi and English, Character and Word drills, seven word categories, a Top-50 leaderboard.",
    href: "/typing/games/wordtris",
    icon: "☁",
    tone: "bg-cyan-600",
  },
];

export default function GamesHubPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <TypingBrandHeader backHref="/typing" backLabel="Typing Hub" />
      <section className="mx-auto max-w-5xl px-4 py-12">
        <p className="mt-5 text-sm font-bold uppercase tracking-widest text-cyan-600">Take a break, keep typing</p>
        <h2 className="mt-2 text-3xl font-black">Games</h2>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {games.map((game) => (
            <article key={game.title} className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black text-white ${game.tone}`} aria-hidden="true">{game.icon}</div>
              <h3 className="mt-6 text-2xl font-black">{game.title}</h3>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">{game.description}</p>
              <Link href={game.href} className="mt-6 inline-flex rounded-xl bg-cyan-50 px-5 py-3 font-black text-cyan-700 group-hover:bg-cyan-600 group-hover:text-white">Play →</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

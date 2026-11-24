import type { Metadata } from "next";
import { TypingBrandHeader } from "../_components/typing-brand";
import { SpeedBoosterClient } from "./speed-booster";

export const metadata: Metadata = { title: "Speed Booster" };

export default function SpeedBoosterPage() {
  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <TypingBrandHeader backHref="/typing" backLabel="Typing Hub" />
    <section className="mx-auto max-w-7xl px-4 py-8">
      <p className="text-sm font-bold uppercase tracking-widest text-blue-600">English and Hindi typing</p>
      <h1 className="mt-1 text-3xl font-black">Speed Booster: break your speed plateau</h1>
      <p className="mt-2 max-w-3xl leading-7 text-slate-600">Stuck at 35-40 WPM? Typing more of the same way will not move you -- you need to change how you practise. Check your technique, then follow the daily plan with burst training, common words, weak keys and rhythm drills -- in English, and in Hindi (Unicode / Remington GAIL or Kruti Dev) with matra, half-letter and joined-letter drills.</p>
      <SpeedBoosterClient />
    </section>
  </main>;
}

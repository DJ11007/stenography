import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { BackButton } from "../../_components/back-button";
import { DictationAudioMaker } from "./dictation-audio-maker";

export default async function DictationAudioPage() {
  await requireAdmin();
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/admin" label="Admin panel" />
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-violet-950 p-6 text-white shadow-xl sm:p-7">
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Stenography</p>
          <h1 className="mt-2 text-3xl font-black">Dictation Audio Maker</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">Text to speech for dictation: paste the matter, choose a voice, and set the time the whole dictation must take (for example 8 minutes). The voice reads at a natural pace and the pauses between phrases are adjusted so it finishes on time. Record it to a file and attach it to a test in <Link href="/admin/stenography-tests" className="font-bold underline">Stenography Tests</Link>. Free: it uses the voices built into your browser, no account needed.</p>
        </div>
        <DictationAudioMaker />
      </div>
    </main>
  );
}

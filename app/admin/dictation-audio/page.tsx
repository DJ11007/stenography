import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { DICTATION_VOICES, speechConfigured } from "@/lib/dictation-tts";
import { BackButton } from "../../_components/back-button";
import { DictationAudioMaker } from "./dictation-audio-maker";

export default async function DictationAudioPage() {
  await requireAdmin();
  const ready = speechConfigured();
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/admin" label="Admin panel" />
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-violet-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Stenography</p>
          <h1 className="mt-2 text-3xl font-black">Dictation Audio Maker</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Paste a passage, choose a male or female voice and the dictation speed. You get a natural-sounding MP3 that lasts exactly the right time for that speed, with pauses at full stops, commas and phrases like a real dictator. Listen to it, download it, then attach it to a test with the audio upload in <Link href="/admin/stenography-tests" className="font-bold underline">Stenography Tests</Link>.</p>
        </div>
        {!ready && (
          <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-black">Voice service not connected yet</p>
            <p className="mt-1">Add <code className="rounded bg-white px-1">AZURE_SPEECH_KEY</code> and <code className="rounded bg-white px-1">AZURE_SPEECH_REGION</code> to the server&apos;s <code className="rounded bg-white px-1">.env.local</code>, then rebuild and restart the site. Until then this page can&apos;t make audio.</p>
          </div>
        )}
        <DictationAudioMaker voices={DICTATION_VOICES.map(({ id, label, language }) => ({ id, label, language }))} ready={ready} />
      </div>
    </main>
  );
}

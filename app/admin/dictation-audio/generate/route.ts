import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { DICTATION_VOICES, generateDictationMp3, type DictationVoice } from "@/lib/dictation-tts";
import { krutiDevToUnicode } from "@/lib/hindi-font-converter";

// Admin only: turns a passage into an MP3 dictation at the chosen speed (see lib/dictation-tts.ts) and sends the
// file back for the admin to listen to and download. Nothing is stored here; the admin attaches the MP3 to a
// stenography test with the test form's normal audio upload.
export async function POST(request: Request) {
  await requireAdmin();
  let body: { text?: unknown; voice?: unknown; wpm?: unknown; encoding?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  const voice = DICTATION_VOICES.find((item) => item.id === body.voice)?.id as DictationVoice | undefined;
  const wpm = Math.round(Number(body.wpm));
  const raw = typeof body.text === "string" ? body.text : "";
  if (!voice) return NextResponse.json({ error: "Choose a voice." }, { status: 400 });
  if (!Number.isFinite(wpm) || wpm < 30 || wpm > 200) return NextResponse.json({ error: "Speed must be 30 to 200 WPM." }, { status: 400 });
  // The voice reads Unicode Hindi; a Kruti Dev passage is converted first (the passage itself is not changed).
  const text = body.encoding === "krutidev" ? krutiDevToUnicode(raw) : raw;
  try {
    const result = await generateDictationMp3({ text, voice, wpm });
    return new NextResponse(new Uint8Array(result.mp3), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Dictation-Words": String(result.words),
        "X-Dictation-Seconds": result.seconds.toFixed(1),
        "X-Dictation-Target-Seconds": result.targetSeconds.toFixed(1),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Audio could not be made." }, { status: 502 });
  }
}

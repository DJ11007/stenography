import "server-only";

// Dictation audio for stenography tests, made with Microsoft Azure neural text-to-speech
// (admin: /admin/dictation-audio). Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in the server environment.
//
// Stenography dictation must run at an exact speed (e.g. 80 WPM = the whole passage in words/80 minutes). Slowing a
// voice down that far sounds unnatural, so -- like a real dictator -- the voice speaks at a normal pace and the
// time is made up with pauses: longer at full stops, shorter at commas, and short ones every few words. It is
// generated twice: once plainly to measure how long the natural speech takes, then again with the pauses that
// fill the remaining time. The MP3 is constant-bitrate, so its length in seconds follows from its size.

export type DictationVoice = "hi-IN-MadhurNeural" | "hi-IN-SwaraNeural" | "en-IN-PrabhatNeural" | "en-IN-NeerjaNeural";
export const DICTATION_VOICES: { id: DictationVoice; label: string; language: "Hindi" | "English" }[] = [
  { id: "hi-IN-MadhurNeural", label: "Hindi — Male (Madhur)", language: "Hindi" },
  { id: "hi-IN-SwaraNeural", label: "Hindi — Female (Swara)", language: "Hindi" },
  { id: "en-IN-PrabhatNeural", label: "English (India) — Male (Prabhat)", language: "English" },
  { id: "en-IN-NeerjaNeural", label: "English (India) — Female (Neerja)", language: "English" },
];

const OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3";
const BYTES_PER_SECOND = 96000 / 8;
const MAX_CHUNK_SECONDS = 8 * 60; // Azure's REST API returns at most 10 minutes of audio per request.
const MAX_BREAK_MS = 5000;
const PHRASE_WORDS = 6;

export function speechConfigured() {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

const escapeXml = (text: string) => text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));

type Gap = { after: number; weight: number };

// Where the pauses go and how heavy each one is: sentence ends 3, commas/semicolons 2, every PHRASE_WORDS words 1.
function plan(words: string[]): Gap[] {
  const gaps: Gap[] = [];
  let sincePause = 0;
  words.forEach((word, index) => {
    if (index === words.length - 1) return;
    sincePause++;
    let weight = 0;
    if (/[.!?।॥]["')\]]*$/u.test(word)) weight = 3;
    else if (/[,;:—-]["')\]]*$/u.test(word)) weight = 2;
    else if (sincePause >= PHRASE_WORDS) weight = 1;
    if (weight) { gaps.push({ after: index, weight }); sincePause = 0; }
  });
  return gaps;
}

function ssml(voice: DictationVoice, words: string[], breaks: Map<number, number>, rate: number) {
  const lang = voice.slice(0, 5);
  const body = words.map((word, index) => {
    const ms = breaks.get(index);
    return escapeXml(word) + (ms ? ` <break time="${Math.round(ms)}ms"/>` : "");
  }).join(" ");
  const prosody = rate !== 1 ? `<prosody rate="${Math.round((rate - 1) * 100)}%">${body}</prosody>` : body;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${voice}">${prosody}</voice></speak>`;
}

async function synthesize(ssmlText: string): Promise<Buffer> {
  const region = process.env.AZURE_SPEECH_REGION!;
  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
      "User-Agent": "sctyping-dictation",
    },
    body: ssmlText,
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(response.status === 401 ? "Azure rejected the speech key (check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION)." : `Azure speech error ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

const seconds = (mp3: Buffer) => mp3.length / BYTES_PER_SECOND;

// One chunk at its exact share of the target length.
async function chunkAudio(voice: DictationVoice, words: string[], targetSeconds: number): Promise<Buffer> {
  const natural = seconds(await synthesize(ssml(voice, words, new Map(), 1)));
  // Faster than the target even at normal pace -> pauses fill the rest. Slower -> speed the voice up a little.
  let rate = 1;
  if (natural > targetSeconds) rate = Math.min(1.5, natural / targetSeconds);
  const spoken = natural / rate;
  const silence = Math.max(0, targetSeconds - spoken);
  const gaps = plan(words);
  const totalWeight = gaps.reduce((sum, gap) => sum + gap.weight, 0) || 1;
  const make = (scale: number) => new Map(gaps.map((gap) => [gap.after, Math.min(MAX_BREAK_MS, (silence * 1000 * gap.weight * scale) / totalWeight)]));
  let audio = await synthesize(ssml(voice, words, make(1), rate));
  // One correction pass if the pauses came out noticeably long or short.
  const got = seconds(audio);
  if (silence > 1 && Math.abs(got - targetSeconds) > Math.max(2, targetSeconds * 0.02)) {
    const addedSilence = Math.max(0.1, got - spoken);
    audio = await synthesize(ssml(voice, words, make(silence / addedSilence), rate));
  }
  return audio;
}

export async function generateDictationMp3({ text, voice, wpm }: { text: string; voice: DictationVoice; wpm: number }) {
  if (!speechConfigured()) throw new Error("Speech is not set up on this server yet (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION).");
  const words = text.replace(/\s+/gu, " ").trim().split(" ").filter(Boolean);
  if (words.length < 5) throw new Error("The passage is too short.");
  if (words.length > 3000) throw new Error("The passage is too long (3000 words at most).");
  const targetSeconds = (words.length / wpm) * 60;
  // Split into chunks of whole sentences that each stay under Azure's per-request limit, then join the MP3s
  // (constant-bitrate MP3 frames can simply be put one after another).
  const chunkCount = Math.max(1, Math.ceil(targetSeconds / MAX_CHUNK_SECONDS));
  const perChunk = Math.ceil(words.length / chunkCount);
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const word of words) {
    current.push(word);
    const sentenceEnd = /[.!?।॥]["')\]]*$/u.test(word);
    if ((current.length >= perChunk && sentenceEnd) || current.length >= perChunk * 1.3) { chunks.push(current); current = []; }
  }
  if (current.length) chunks.push(current);
  const parts: Buffer[] = [];
  for (const chunk of chunks) parts.push(await chunkAudio(voice, chunk, (chunk.length / wpm) * 60));
  const mp3 = Buffer.concat(parts);
  return { mp3, words: words.length, targetSeconds, seconds: seconds(mp3) };
}

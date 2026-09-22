import type { Metadata } from "next";
import { getWordtrisWords } from "@/lib/wordtris-server";
import { getSpeedRacePassages } from "@/lib/speedrace-passages-server";
import { SpeedRaceGame } from "./speed-race-game";

export const metadata: Metadata = { title: "Speed Race | Samradhi Classes" };

// requireStudent()/TypingStudentProvider already applied by
// app/typing/layout.tsx -- this file only needs to fetch the word banks.
// Speed Race reuses the same admin-editable word banks WordTris uses
// (lib/wordtris-server.ts) as vocabulary for its passages -- it's shared
// content, not exclusive to one game. passagesByLanguage is the admin's
// own authored passage library (/admin/speedrace-passages) -- empty for
// a language nobody has added any to yet, in which case the game falls
// back to auto-building a passage from the word bank, unchanged.
export default async function SpeedRacePage() {
  const [words, english, hindi] = await Promise.all([
    getWordtrisWords(),
    getSpeedRacePassages("english"),
    getSpeedRacePassages("hindi"),
  ]);
  return <SpeedRaceGame words={words} passagesByLanguage={{ english, hindi }} />;
}

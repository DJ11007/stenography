import type { Metadata } from "next";
import { getWordtrisWords } from "@/lib/wordtris-server";
import { SpeedRaceGame } from "./speed-race-game";

export const metadata: Metadata = { title: "Speed Race | Samradhi Classes" };

// requireStudent()/TypingStudentProvider already applied by
// app/typing/layout.tsx -- this file only needs to fetch the word banks.
// Speed Race reuses the same admin-editable word banks WordTris uses
// (lib/wordtris-server.ts) as vocabulary for its passages -- it's shared
// content, not exclusive to one game.
export default async function SpeedRacePage() {
  const words = await getWordtrisWords();
  return <SpeedRaceGame words={words} />;
}

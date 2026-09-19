import type { Metadata } from "next";
import { getWordtrisWords } from "@/lib/wordtris-server";
import { WordDefenderGame } from "./word-defender-game";

export const metadata: Metadata = { title: "Word Defender | Samradhi Classes" };

// requireStudent()/TypingStudentProvider already applied by
// app/typing/layout.tsx -- this file only needs to fetch the word banks.
// Word Defender reuses the same admin-editable word banks WordTris and
// Speed Race use (lib/wordtris-server.ts) as vocabulary -- shared content,
// not exclusive to one game.
export default async function WordDefenderPage() {
  const words = await getWordtrisWords();
  return <WordDefenderGame words={words} />;
}

import type { Metadata } from "next";
import { getWordtrisWords } from "@/lib/wordtris-server";
import { getCharacterPool } from "@/lib/character-pool-server";
import { WordtrisGame } from "./wordtris-game";

export const metadata: Metadata = { title: "WordTris | Samradhi Classes" };

// requireStudent()/TypingStudentProvider already applied by
// app/typing/layout.tsx -- this file only needs to fetch the word banks
// and the admin-configurable Character-mode key pool.
export default async function WordtrisPage() {
  const [words, characterPool] = await Promise.all([getWordtrisWords(), getCharacterPool()]);
  return <WordtrisGame words={words} characterPool={characterPool} />;
}

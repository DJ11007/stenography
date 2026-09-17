import type { Metadata } from "next";
import { getWordtrisWords } from "@/lib/wordtris-server";
import { WordtrisGame } from "./wordtris-game";

export const metadata: Metadata = { title: "WordTris | Samradhi Classes" };

// requireStudent()/TypingStudentProvider already applied by
// app/typing/layout.tsx -- this file only needs to fetch the word banks.
export default async function WordtrisPage() {
  const words = await getWordtrisWords();
  return <WordtrisGame words={words} />;
}

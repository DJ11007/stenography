import type { Metadata } from "next";
import { getCharacterPool } from "@/lib/character-pool-server";
import { KeyHunterGame } from "./key-hunter-game";

export const metadata: Metadata = { title: "Key Hunter | Samradhi Classes" };

// requireStudent()/TypingStudentProvider already applied by
// app/typing/layout.tsx. Key Hunter needs no word bank, just the
// admin-configurable key pool (see /admin/character-pool) -- falls back
// to the full keyboard for a language nobody's configured.
export default async function KeyHunterPage() {
  const characterPool = await getCharacterPool();
  return <KeyHunterGame characterPool={characterPool} />;
}

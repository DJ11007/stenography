import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getWordtrisWords } from "@/lib/wordtris-server";
import { LiveRaceHost } from "./live-race-host";

export const metadata: Metadata = { title: "Live Classroom Race | Admin" };

// Host a live, multi-student Speed Race room -- students join by a short
// code from the game's own setup screen (see
// app/typing/games/speed-race/speed-race-game.tsx). Fetches the same
// word banks Speed Race itself uses so the host can build an identical
// passage for every joining student.
export default async function LiveRacePage() {
  await requireAdmin();
  const words = await getWordtrisWords();
  return <LiveRaceHost words={words} />;
}

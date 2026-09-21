import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHARACTER_POOL } from "@/lib/character-pool-content";
import { BackButton } from "../../_components/back-button";
import { CharacterPoolManager } from "./character-pool-manager";

export const metadata: Metadata = { title: "Character Pool | Admin" };

// Which keys WordTris's Character mode and Key Hunter drill, per
// language, and (for WordTris only) what ORDER they come in -- both
// games unconditionally drilled every key on the keyboard in random
// order until this existed. No row for a language (or one whose
// enabled_keys was cleared back to empty) means "every key, random
// order", so an admin who's never touched this page changes nothing.
// Once a language IS configured, WordTris's Character mode plays that
// exact sequence instead of shuffling (Key Hunter still always adapts
// to the student's own weakest key next, regardless of this order).
export default async function CharacterPoolPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_character_pool_config");
  const rows = (data ?? []) as { language: "hindi" | "english"; enabled_keys: string[] }[];
  const configured = {
    hindi: rows.find((r) => r.language === "hindi")?.enabled_keys.length ? rows.find((r) => r.language === "hindi")!.enabled_keys : null,
    english: rows.find((r) => r.language === "english")?.enabled_keys.length ? rows.find((r) => r.language === "english")!.enabled_keys : null,
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/admin" label="Admin panel" />
        <h1 className="mt-5 text-2xl font-black text-slate-950">Character Pool</h1>
        <p className="mt-2 text-sm text-slate-600">
          Build the list of keys WordTris&apos;s Character mode and Key Hunter drill, per language
          (<code>/typing/games/wordtris</code>, <code>/typing/games/key-hunter</code>). The order
          you put them in is the exact order WordTris introduces them -- Key Hunter always adapts
          to whichever key the student is weakest on next, regardless of this order. Every key is
          included, in random order, until you build a list here.
        </p>
        <div className="mt-6 space-y-8">
          <CharacterPoolManager language="english" allKeys={DEFAULT_CHARACTER_POOL.english} initialKeys={configured.english ?? []} />
          <CharacterPoolManager language="hindi" allKeys={DEFAULT_CHARACTER_POOL.hindi} initialKeys={configured.hindi ?? []} />
        </div>
      </div>
    </main>
  );
}

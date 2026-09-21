import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHARACTER_POOL } from "@/lib/character-pool-content";
import { BackButton } from "../../_components/back-button";
import { CharacterPoolManager } from "./character-pool-manager";

export const metadata: Metadata = { title: "Character Pool | Admin" };

// Which keys WordTris's Character mode and Key Hunter drill, per
// language -- both games unconditionally drilled every key on the
// keyboard until this existed. No row for a language (or one whose
// enabled_keys was cleared back to empty) means "every key", so an
// admin who's never touched this page changes nothing.
export default async function CharacterPoolPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_character_pool_config");
  const rows = (data ?? []) as { language: "hindi" | "english"; enabled_keys: string[] }[];
  const enabled = {
    hindi: rows.find((r) => r.language === "hindi")?.enabled_keys.length ? rows.find((r) => r.language === "hindi")!.enabled_keys : DEFAULT_CHARACTER_POOL.hindi,
    english: rows.find((r) => r.language === "english")?.enabled_keys.length ? rows.find((r) => r.language === "english")!.enabled_keys : DEFAULT_CHARACTER_POOL.english,
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/admin" label="Admin panel" />
        <h1 className="mt-5 text-2xl font-black text-slate-950">Character Pool</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose which keys WordTris&apos;s Character mode and Key Hunter drill, per language
          (<code>/typing/games/wordtris</code>, <code>/typing/games/key-hunter</code>). Every key
          is included until you narrow it down here.
        </p>
        <div className="mt-6 space-y-8">
          <CharacterPoolManager language="english" allKeys={DEFAULT_CHARACTER_POOL.english} enabledKeys={enabled.english} />
          <CharacterPoolManager language="hindi" allKeys={DEFAULT_CHARACTER_POOL.hindi} enabledKeys={enabled.hindi} />
        </div>
      </div>
    </main>
  );
}

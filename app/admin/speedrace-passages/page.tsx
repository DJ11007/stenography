import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "../../_components/back-button";
import { SpeedRacePassagesManager } from "./speedrace-passages-manager";

export const metadata: Metadata = { title: "Speed Race Passages | Admin" };

export default async function AdminSpeedRacePassagesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_speedrace_passages");
  const rows = (data ?? []) as { id: string; language: "hindi" | "english"; title: string; passage: string; is_published: boolean }[];

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/admin" label="Admin panel" />
        <h1 className="mt-5 text-2xl font-black text-slate-950">Speed Race Passages</h1>
        <p className="mt-2 text-sm text-slate-600">
          Write real passages for Speed Race (<code>/typing/games/speed-race</code>). Once at least one is
          published for a language, students see a list to choose from on the setup screen (or, if you
          publish just one, that one becomes the only option). A language with none published falls back to
          the existing auto-generated-from-word-bank passage, unchanged.
        </p>
        <div className="mt-6">
          <SpeedRacePassagesManager rows={rows} />
        </div>
      </div>
    </main>
  );
}

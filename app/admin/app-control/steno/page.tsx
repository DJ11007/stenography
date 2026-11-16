import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "../../../_components/back-button";
import { TypingAppManager, type AppTestRow, type WebsiteTestRow } from "../typing/typing-manager";

export default async function AppControlStenoPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: appTests }, { data: websiteTests }] = await Promise.all([
    supabase.rpc("admin_list_app_tests"),
    supabase.from("tests").select("id,title,language,mode,duration_seconds,settings->>steno_category").eq("test_type", "stenography").eq("status", "published").order("title").limit(1000),
  ]);
  const added = new Set((appTests ?? []).map((t: AppTestRow) => t.source_test_id).filter(Boolean));
  const available: WebsiteTestRow[] = ((websiteTests ?? []) as unknown as Array<{ id: string; title: string; language: string; duration_seconds: number | null; steno_category: string | null }>)
    .filter((t) => !added.has(t.id))
    .map((t) => ({ id: t.id, title: t.title, language: t.language, mode: "steno", minutes: Math.round((t.duration_seconds ?? 600) / 60), board: t.steno_category }));
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/admin/app-control" label="App control" />
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-300">SCTyping desktop app</p>
          <h1 className="mt-2 text-3xl font-black">Stenography</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Add the stenography tests you made on the website. Each one keeps its passage, speed, accuracy and dictation audio. Students download the audio the first time they open a test, then it works offline. Tests appear inside their exam board in the app&apos;s Stenography section.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
            <Link href="/admin/tests" className="rounded-full bg-white px-4 py-2 text-slate-900">Create / upload a new stenography test (website) →</Link>
            <Link href="/admin/app-control/steno-boards" className="rounded-full bg-white/15 px-4 py-2 hover:bg-white/25">Show / hide exam boards →</Link>
          </div>
        </div>
        <TypingAppManager kind="steno" available={available} inApp={((appTests ?? []) as AppTestRow[]).filter((t) => t.mode === "steno")} />
      </div>
    </main>
  );
}

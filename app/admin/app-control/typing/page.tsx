import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "../../../_components/back-button";
import { TypingAppManager, type AppTestRow, type WebsiteTestRow } from "./typing-manager";

export default async function AppControlTypingPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: appTests }, { data: websiteTests }] = await Promise.all([
    supabase.rpc("admin_list_app_tests"),
    supabase.from("tests").select("id,title,language,mode,duration_seconds,settings->>exam_category").eq("test_type", "typing").eq("status", "published").in("mode", ["exam", "practice"]).order("title").limit(1000),
  ]);
  const added = new Set((appTests ?? []).map((t: AppTestRow) => t.source_test_id).filter(Boolean));
  const available: WebsiteTestRow[] = ((websiteTests ?? []) as unknown as Array<{ id: string; title: string; language: string; mode: string; duration_seconds: number | null; exam_category: string | null }>)
    .filter((t) => !added.has(t.id))
    .map((t) => ({ id: t.id, title: t.title, language: t.language, mode: t.mode, minutes: Math.round((t.duration_seconds ?? 600) / 60), board: t.exam_category }));
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/admin/app-control" label="App control" />
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-300">SCTyping desktop app</p>
          <h1 className="mt-2 text-3xl font-black">Typing Test</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Choose which typing tests students get in the app. Add tests you already made on the website, or create a new one just for the app. They appear inside every exam board in the app's Exam Simulator.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
            <Link href="/admin/app-control/exam" className="rounded-full bg-white/15 px-4 py-2 hover:bg-white/25">Show / hide exam boards →</Link>
            <Link href="/admin/app-control/learn" className="rounded-full bg-white/15 px-4 py-2 hover:bg-white/25">Show / hide Learn Typing →</Link>
          </div>
        </div>
        <TypingAppManager available={available} inApp={((appTests ?? []) as AppTestRow[]).filter((t) => t.mode !== "steno")} />
      </div>
    </main>
  );
}

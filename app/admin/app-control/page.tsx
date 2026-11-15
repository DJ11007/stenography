import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EXAM_CATEGORIES } from "@/lib/exam-categories";
import { STENOGRAPHY_CATEGORIES } from "@/lib/stenography-categories";
import { APP_LEARN_ITEMS, APP_SECTION_ITEMS, normaliseRules, type AppControlGroup } from "@/lib/app-control";
import { BackButton } from "../../_components/back-button";
import { AppControlManager } from "./app-control-manager";

export default async function AppControlPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: control }, { data: wordTests }, { data: excelTests }] = await Promise.all([
    supabase.rpc("public_app_control"),
    supabase.from("word_efficiency_tests").select("slug,title,language").eq("status", "published").order("title"),
    supabase.from("excel_efficiency_tests").select("slug,title,language").eq("status", "published").order("title"),
  ]);
  const groups: AppControlGroup[] = [
    { heading: "Sections on the app home", items: APP_SECTION_ITEMS },
    { heading: "Learn Typing", items: APP_LEARN_ITEMS },
    { heading: "Exam Simulator — exam boards", items: EXAM_CATEGORIES.map((c) => ({ key: `exam:${c.slug}`, label: c.name, hint: c.fullName })) },
    { heading: "Stenography — exam boards", items: STENOGRAPHY_CATEGORIES.map((c) => ({ key: `steno:${c.slug}`, label: c.name, hint: c.fullName })) },
    { heading: "Word Efficiency tests", items: (wordTests ?? []).map((t) => ({ key: `word:${t.slug}`, label: t.title, hint: t.language })) },
    { heading: "Excel Efficiency tests", items: (excelTests ?? []).map((t) => ({ key: `excel:${t.slug}`, label: t.title, hint: t.language })) },
  ];
  const settings = (control?.settings ?? {}) as Record<string, string>;
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/admin" label="Admin panel" />
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-300">SCTyping desktop app</p>
          <h1 className="mt-2 text-3xl font-black">App control</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Choose what students see inside the installed app: hide a section or test, open it free to everyone, or lock it until the app is activated. Changes reach installed apps within a few minutes; anything you leave untouched behaves as before.</p>
        </div>
        <AppControlManager
          groups={groups}
          initialRules={normaliseRules(control?.rules)}
          initialSettings={{ notice: settings.notice ?? "", trialSeconds: settings.trialSeconds ?? "", trialWords: settings.trialWords ?? "" }}
        />
      </div>
    </main>
  );
}

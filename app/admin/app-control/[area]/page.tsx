import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EXAM_CATEGORIES } from "@/lib/exam-categories";
import { STENOGRAPHY_CATEGORIES } from "@/lib/stenography-categories";
import { APP_AREAS, APP_LEARN_ITEMS, APP_SECTION_ITEMS, normaliseRules, type AppArea, type AppControlGroup } from "@/lib/app-control";
import { BackButton } from "../../../_components/back-button";
import { AppControlManager } from "../app-control-manager";

export default async function AppControlAreaPage({ params }: { params: Promise<{ area: string }> }) {
  await requireAdmin();
  const { area: areaId } = await params;
  const area = APP_AREAS.find((a) => a.id === areaId);
  if (!area) notFound();
  const supabase = await createClient();
  const { data: control } = await supabase.rpc("public_app_control");

  let groups: AppControlGroup[] = [];
  switch (area.id as AppArea) {
    case "general": groups = [{ heading: "Sections on the app home page", items: APP_SECTION_ITEMS }]; break;
    case "learn": groups = [{ heading: "Learn Typing lessons", items: APP_LEARN_ITEMS }]; break;
    case "exam": groups = [{ heading: "Exam boards", items: EXAM_CATEGORIES.map((c) => ({ key: `exam:${c.slug}`, label: c.name, hint: c.fullName })) }]; break;
    case "steno-boards": groups = [{ heading: "Exam boards", items: STENOGRAPHY_CATEGORIES.map((c) => ({ key: `steno:${c.slug}`, label: c.name, hint: c.fullName })) }]; break;
    case "word": {
      const { data } = await supabase.from("word_efficiency_tests").select("slug,title,language").eq("status", "published").order("title");
      groups = [{ heading: "Published Word tests", items: (data ?? []).map((t) => ({ key: `word:${t.slug}`, label: t.title, hint: t.language })) }];
      break;
    }
    case "excel": {
      const { data } = await supabase.from("excel_efficiency_tests").select("slug,title,language").eq("status", "published").order("title");
      groups = [{ heading: "Published Excel tests", items: (data ?? []).map((t) => ({ key: `excel:${t.slug}`, label: t.title, hint: t.language })) }];
      break;
    }
  }
  const backHref = area.id === "word" || area.id === "excel" ? "/admin/app-control/efficiency" : area.id === "learn" || area.id === "exam" ? "/admin/app-control/typing" : area.id === "steno-boards" ? "/admin/app-control/steno" : "/admin/app-control";
  const settings = (control?.settings ?? {}) as Record<string, string>;
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href={backHref} label="Back" />
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-300">SCTyping desktop app</p>
          <h1 className="mt-2 text-3xl font-black">{area.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">{area.blurb}</p>
          {area.manageHref && <Link href={area.manageHref} className="mt-4 inline-block rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900">{area.manageLabel} →</Link>}
        </div>
        <AppControlManager
          groups={groups}
          initialRules={normaliseRules(control?.rules)}
          initialSettings={{ notice: settings.notice ?? "", trialSeconds: settings.trialSeconds ?? "", trialWords: settings.trialWords ?? "" }}
          showSettings={area.id === "general"}
        />
      </div>
    </main>
  );
}

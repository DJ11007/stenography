import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { APP_AREAS, normaliseRules } from "@/lib/app-control";
import { BackButton } from "../../_components/back-button";

export default async function AppControlHubPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: control } = await supabase.rpc("public_app_control");
  const rules = normaliseRules(control?.rules);
  const customised = (prefixes: string[]) => rules.filter((r) => prefixes.some((p) => r.key.startsWith(p)) && (!r.visible || r.access !== "default")).length;
  const prefixesOf: Record<string, string[]> = { general: ["section:"], learn: ["learn:"], exam: ["exam:"], steno: ["steno:"], word: ["word:"], excel: ["excel:"] };
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/admin" label="Admin panel" />
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-300">SCTyping desktop app</p>
          <h1 className="mt-2 text-3xl font-black">App control</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Decide what students see inside the installed app. Pick a part below. On each page, every item can be shown or hidden, made free for everyone, or locked until the student activates the app. Items you never change keep working as normal.</p>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {APP_AREAS.map((area) => {
            const count = customised(prefixesOf[area.id]);
            return (
              <Link key={area.id} href={`/admin/app-control/${area.id}`} className="rounded-2xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-lg">
                <h2 className="text-lg font-bold">{area.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{area.blurb}</p>
                <span className="mt-5 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">{count ? `${count} customised →` : "Manage →"}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "../../_components/back-button";
import { HomepageContentManager } from "./homepage-content-manager";

export default async function AdminHomepagePage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: coursePackages }, { data: vacancyNotices }, { data: feedback }, { data: officialWebsites }] = await Promise.all([
    supabase.rpc("admin_list_course_packages"),
    supabase.rpc("admin_list_vacancy_notices"),
    supabase.rpc("admin_list_feedback"),
    supabase.rpc("admin_list_official_websites"),
  ]);
  const stats = [
    { label: "Course packages", value: coursePackages?.length ?? 0, tone: "from-blue-600 to-indigo-700" },
    { label: "Vacancy notices", value: vacancyNotices?.length ?? 0, tone: "from-amber-500 to-orange-600" },
    { label: "Pending feedback", value: (feedback ?? []).filter((row: { is_approved: boolean }) => !row.is_approved).length, tone: "from-rose-500 to-pink-600" },
  ];
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/admin" label="Admin panel" />
        <div className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-300">Public homepage control centre</p>
          <h1 className="mt-2 text-3xl font-black">Homepage content</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Everything a visitor sees before logging in — course packages, vacancy notices, and student feedback — lives here.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className={`rounded-2xl bg-gradient-to-br ${stat.tone} p-4 shadow-lg`}>
                <p className="text-3xl font-black">{stat.value}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/80">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <HomepageContentManager coursePackages={coursePackages ?? []} vacancyNotices={vacancyNotices ?? []} feedback={feedback ?? []} officialWebsites={officialWebsites ?? []} />
        </div>
      </div>
    </main>
  );
}

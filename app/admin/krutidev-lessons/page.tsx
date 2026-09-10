import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "../../_components/back-button";
import { KrutiDevLessonsManager } from "./krutidev-lessons-manager";

export const metadata: Metadata = { title: "Kruti Dev Typing Tutor | Admin" };

export default async function AdminKrutiDevLessonsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_krutidev_exercises");

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/admin" label="Admin panel" />
        <h1 className="mt-5 text-2xl font-black text-slate-950">Kruti Dev Typing Tutor</h1>
        <p className="mt-2 text-sm text-slate-600">
          Edit the key drills, word sets and paragraphs students practise on the Kruti Dev learn
          simulator (<code>/typing/learn/krutidev</code>). Write in normal Unicode Hindi — it is
          converted to Kruti Dev automatically. Add as many words / lines / paragraphs as you like.
        </p>
        <div className="mt-6">
          <KrutiDevLessonsManager rows={data ?? []} />
        </div>
      </div>
    </main>
  );
}

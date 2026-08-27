import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "../../_components/back-button";
import { ClassroomManager } from "./classroom-manager";

export default async function AdminClassroomPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: updates }, { data: liveClass }] = await Promise.all([
    supabase.rpc("admin_list_classroom_updates"),
    supabase.rpc("get_live_class_link"),
  ]);
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/admin" label="Admin panel" />
        <h1 className="mt-5 text-2xl font-black text-slate-950">Classroom</h1>
        <p className="mt-2 text-sm text-slate-600">Post announcements for students and manage the live class link shown on the Classroom page.</p>
        <div className="mt-6">
          <ClassroomManager updates={updates ?? []} liveClass={liveClass ?? { url: null, is_active: false }} />
        </div>
      </div>
    </main>
  );
}

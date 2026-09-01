import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "../../_components/back-button";
import { RecoveryRequestQueue, type RecoveryRequestRow } from "./recovery-request-queue";

export const metadata: Metadata = { title: "Account Recovery Requests | Admin" };

export default async function AdminRecoveryRequestsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_recovery_requests", { p_status: null });
  if (error) throw new Error(`Could not load recovery requests: ${error.message}`);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 p-6 text-white shadow">
          <div>
            <p className="text-sm font-semibold text-blue-300">SAMRADHI CLASSES</p>
            <h1 className="text-2xl font-bold">Account Recovery Requests</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Students who lost access to both their email and phone submit a request from &quot;Recover Account&quot; on the login page. Confirm their identity yourself (phone call or WhatsApp, having them repeat what they typed here) before approving -- the details are hashed on submission and cannot be read back by anyone, including you.
            </p>
          </div>
          <BackButton href="/admin" label="Admin panel" dark />
        </header>
        <RecoveryRequestQueue requests={(data ?? []) as RecoveryRequestRow[]} />
      </div>
    </main>
  );
}

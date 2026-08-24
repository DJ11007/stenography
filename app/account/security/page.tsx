import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SecuritySettings from "./security-settings";
import { safeAuthenticatedNext } from "@/lib/auth-routing";
import { phoneRecoveryEnabled } from "@/lib/account-recovery";

export default async function AccountSecurityPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireUser();
  const next = safeAuthenticatedNext((await searchParams).next);
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-10"><h1 className="text-3xl font-bold text-blue-700">Account security</h1><p className="mt-2 mb-8 text-slate-600">Manage your primary sign-in identifiers, password and multi-factor authentication.</p><SecuritySettings admin={profile?.role === "admin"} next={next} currentEmail={user.email ?? ""} emailVerified={Boolean(user.email_confirmed_at)} phoneEnabled={phoneRecoveryEnabled()} /></main>;
}

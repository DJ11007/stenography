import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "student" | "admin";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/student");
  }

  // Same as app/auth/actions.ts's signIn(): a thrown/failed getClaims() must fall back to "not AAL2-verified"
  // (sending the admin to the MFA check page, same as a genuinely unverified session) rather than crash the
  // request -- every /admin page render calls this, so an unhandled throw here takes down the whole admin area.
  let aal: string | undefined;
  try {
    const { data: verifiedToken } = await supabase.auth.getClaims();
    aal = verifiedToken?.claims.aal;
  } catch (claimsError) {
    console.error("getClaims failed in requireAdmin; treating as not AAL2-verified", claimsError);
  }
  if (aal !== "aal2") {
    redirect("/account/security?next=/admin");
  }

  return { user, profile };
}

export async function requireStudent() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, is_active, approved")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role !== "student" || profile.is_active === false || profile.approved === false) redirect("/login");
  return { user, profile };
}

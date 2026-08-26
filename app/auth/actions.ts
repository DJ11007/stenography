"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decideSignInDestination, type LoginKind } from "@/lib/auth-routing";

export type AuthFormState = { error?: string; success?: string };

function getCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { email, password } = getCredentials(formData);
  const loginKind: LoginKind = formData.get("loginType") === "admin" ? "admin" : "student";
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/email.*not.*confirmed/i.test(error.message)) {
      return { error: "Please confirm your email first. Check your inbox (and spam folder) for the confirmation link, or ask your teacher to resend it from the admin panel." };
    }
    return { error: "Email or password is incorrect." };
  }

  const user = signInData.user;
  const { data: profile } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (profile && profile.is_active === false) {
    await supabase.auth.signOut();
    return { error: "Your account has been deactivated. Please contact Samradhi Classes for help." };
  }

  const role = profile?.is_active && (profile.role === "admin" || profile.role === "student")
    ? profile.role
    : null;
  const { data: verifiedToken } = await supabase.auth.getClaims(signInData.session?.access_token);
  const currentLevel = verifiedToken?.claims.aal === "aal2"
    ? "aal2"
    : verifiedToken?.claims.aal === "aal1" ? "aal1" : null;
  const decision = decideSignInDestination(loginKind, role, currentLevel);

  if (decision.type === "deny-admin") {
    await supabase.auth.signOut();
    return { error: "This account does not have administrator access." };
  }
  revalidatePath("/", "layout");
  redirect(decision.destination);
}

export async function signUp(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const { email, password } = getCredentials(formData);

  if (fullName.length < 2) return { error: "Enter your full name." };
  if (!email || password.length < 8) return { error: "Use a valid email and a password of at least 8 characters." };

  const supabase = await createClient();
  const origin = (await import("next/headers")).headers().then((headers) => headers.get("origin"));
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone: phone || null },
      emailRedirectTo: `${(await origin) ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  // When email confirmations are turned off in Supabase, signUp() returns an
  // active session immediately instead of requiring a confirmation click.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/typing");
  }
  return { success: "Check your email to confirm your account, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

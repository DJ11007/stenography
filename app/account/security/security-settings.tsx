"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeTotpQr } from "@/lib/mfa";

type Factor = { id: string; friendly_name?: string; status: string };

type SecuritySettingsProps = {
  admin: boolean;
  currentEmail: string;
  emailVerified: boolean;
  phoneEnabled: boolean;
  next?: "/admin";
};

export default function SecuritySettings({ admin, currentEmail, emailVerified, phoneEnabled, next }: SecuritySettingsProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [supabase] = useState(() => createClient());

  async function refreshFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }
  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setFactors((data?.totp ?? []) as Factor[]);
    });
  }, [supabase]);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); const values = new FormData(event.currentTarget);
    const current = String(values.get("current") ?? ""); const next = String(values.get("next") ?? "");
    if (next.length < 12 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/\d/.test(next) || !/[^A-Za-z0-9]/.test(next)) { setMessage("The new password does not meet the strength requirements."); return; }
    const { error: authError } = await supabase.auth.signInWithPassword({ email: currentEmail, password: current });
    if (authError) { setMessage("Reauthentication failed. Your password was not changed."); return; }
    const { error } = await supabase.auth.updateUser({ password: next });
    setMessage(error ? "Password could not be changed." : "Password changed successfully.");
  }

  async function changePrimaryEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const values = new FormData(event.currentTarget);
    const email = String(values.get("newPrimaryEmail") ?? "").trim().toLowerCase();
    const password = String(values.get("emailPassword") ?? "");
    if (!email || email === currentEmail.toLowerCase()) { setMessage("Enter a different valid email address."); return; }
    const { error: authError } = await supabase.auth.signInWithPassword({ email: currentEmail, password });
    if (authError) { setMessage("Reauthentication failed. Your primary email was not changed."); return; }
    const { error } = await supabase.auth.updateUser({ email });
    setMessage(error
      ? "Email verification is temporarily unavailable or the address cannot be used. Your current login email is unchanged."
      : "Verification was sent. Your current login email remains active until the email change is confirmed.");
  }

  async function changePrimaryPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (!phoneEnabled) { setMessage("Phone verification is not configured for this service."); return; }
    const values = new FormData(event.currentTarget);
    const phone = String(values.get("newPrimaryPhone") ?? "").replace(/[\s()-]/g, "");
    const password = String(values.get("phonePassword") ?? "");
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) { setMessage("Enter a mobile number with its country code, for example +919876543210."); return; }
    const { error: authError } = await supabase.auth.signInWithPassword({ email: currentEmail, password });
    if (authError) { setMessage("Reauthentication failed. Your primary phone was not changed."); return; }
    const { error } = await supabase.auth.updateUser({ phone });
    setMessage(error
      ? "Phone verification is temporarily unavailable. No phone-number change was made."
      : "A verification code was sent. The phone number is not trusted until verification succeeds.");
  }

  async function beginMfa() {
    const staleFactors = factors.filter((factor) => factor.status !== "verified");
    for (const factor of staleFactors) {
      const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (cleanupError) { setMessage("A previous incomplete enrollment could not be replaced safely. Cancel it and try again."); return; }
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Samradhi Classes authenticator" });
    if (error) { setMessage("Authenticator enrollment could not be started."); return; }
    const qr = normalizeTotpQr(data.totp.qr_code);
    if (!qr) {
      await supabase.auth.mfa.unenroll({ factorId: data.id });
      setMessage("Supabase returned an invalid authenticator QR code. The incomplete enrollment was cancelled safely.");
      return;
    }
    setEnrollment({ id: data.id, qr, secret: data.totp.secret });
    await refreshFactors();
  }

  async function cancelMfaEnrollment(factorId: string) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { setMessage("The incomplete authenticator enrollment could not be cancelled. Please try again."); return; }
    if (enrollment?.id === factorId) setEnrollment(null);
    setMessage("The incomplete authenticator enrollment was cancelled.");
    await refreshFactors();
  }
  async function verifyMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!enrollment) return; const code = String(new FormData(event.currentTarget).get("code") ?? "");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code });
    if (error) { setMessage("The authenticator code is invalid or expired."); return; }
    setEnrollment(null); setMessage("Authenticator MFA is enabled. Other sessions have been signed out."); await refreshFactors();
    if (next) router.push(next);
  }

  async function verifyExistingMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const factor = factors.find((candidate) => candidate.status === "verified");
    if (!factor) { setMessage("No verified authenticator is available. Enroll one below."); return; }
    const code = String(new FormData(event.currentTarget).get("existingCode") ?? "");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setMessage(error ? "The authenticator code is invalid or expired." : "MFA verified. Administrator routes are now available for this session.");
    if (!error) router.push(next ?? "/admin");
  }

  return <div className="space-y-8">
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">Authenticator-app MFA is the recommended administrator security and recovery method. Email and phone below are primary Supabase Auth sign-in identifiers, not backup contacts.</div>
    {message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
    <section className="space-y-4 rounded-xl border p-5"><h2 className="text-xl font-bold">Authenticator app MFA {admin && <span className="text-sm text-red-700">(required for administrators)</span>}</h2><p className="text-sm text-slate-600">Verified factors: {factors.filter((factor) => factor.status === "verified").length}</p>{factors.some((factor) => factor.status === "verified") && <form onSubmit={verifyExistingMfa} className="flex flex-wrap gap-2"><input className="min-w-0 flex-1 rounded-lg border p-3" name="existingCode" aria-label="Existing authenticator code" inputMode="numeric" autoComplete="one-time-code" required /><button className="rounded-lg bg-blue-700 px-5 font-semibold text-white">Verify and continue</button></form>}{factors.filter((factor) => factor.status !== "verified" && factor.id !== enrollment?.id).map((factor) => <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-sm" key={factor.id}><span>Incomplete authenticator enrollment</span><button className="font-semibold text-red-700" type="button" onClick={() => cancelMfaEnrollment(factor.id)}>Cancel incomplete enrollment</button></div>)}{!enrollment && !factors.some((factor) => factor.status === "verified") && <button onClick={beginMfa} className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white">Enroll authenticator app</button>}{enrollment && <div className="space-y-3"><Image src={enrollment.qr} width={192} height={192} alt="Authenticator enrollment QR code" unoptimized /><p className="break-all text-xs">Manual secret: {enrollment.secret}</p><div className="flex flex-wrap gap-2"><form onSubmit={verifyMfa} className="flex gap-2"><input className="rounded-lg border p-3" name="code" aria-label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" required /><button className="rounded-lg bg-blue-700 px-5 font-semibold text-white">Verify</button></form><button className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700" type="button" onClick={() => cancelMfaEnrollment(enrollment.id)}>Cancel enrollment</button></div></div>}</section>
    <section className="space-y-3 rounded-xl border p-5"><h2 className="text-xl font-bold">Current primary email</h2><div className="rounded-lg bg-slate-100 p-3"><span className="break-all font-medium">{currentEmail}</span><span className={`ml-2 text-sm font-semibold ${emailVerified ? "text-green-700" : "text-amber-700"}`}>{emailVerified ? "Verified" : "Not verified"}</span></div><p className="text-sm text-slate-600">This is your current login email. It is read-only here and remains active until any requested change is verified.</p></section>
    <form onSubmit={changePrimaryEmail} className="space-y-3 rounded-xl border p-5"><h2 className="text-xl font-bold">Change primary email</h2><p className="text-sm text-slate-600">This changes your Supabase Auth login identifier; it does not add a backup email.</p><input className="w-full rounded-lg border p-3" aria-label="New primary email" name="newPrimaryEmail" type="email" autoComplete="email" placeholder="New primary email" required /><input className="w-full rounded-lg border p-3" aria-label="Current password for email change" name="emailPassword" type="password" autoComplete="current-password" placeholder="Current password" required /><button className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white">Reauthenticate and request email change</button></form>
    {phoneEnabled && <form onSubmit={changePrimaryPhone} className="space-y-3 rounded-xl border p-5"><h2 className="text-xl font-bold">Change primary phone</h2><p className="text-sm text-slate-600">This changes the primary Supabase Auth phone identifier. SMS verification is required.</p><input className="w-full rounded-lg border p-3" aria-label="New primary phone" name="newPrimaryPhone" type="tel" autoComplete="tel" placeholder="+919876543210" required /><input className="w-full rounded-lg border p-3" aria-label="Current password for phone change" name="phonePassword" type="password" autoComplete="current-password" placeholder="Current password" required /><button className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white">Reauthenticate and request phone change</button></form>}
    <form onSubmit={changePassword} className="space-y-3 rounded-xl border p-5"><h2 className="text-xl font-bold">Change password</h2><input className="w-full rounded-lg border p-3" name="current" type="password" autoComplete="current-password" placeholder="Current password" required /><input className="w-full rounded-lg border p-3" name="next" type="password" autoComplete="new-password" placeholder="New strong password" required minLength={12} /><button className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white">Reauthenticate and change</button></form>
  </div>;
}

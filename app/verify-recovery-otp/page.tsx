"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VerifyRecoveryOtpPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") ?? "").replace(/[\s()-]/g, "");
    const token = String(form.get("token") ?? "").trim();
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    if (otpError) { setError("The code is invalid or expired. Request a new code."); return; }
    router.replace("/update-password");
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-8 shadow-lg"><h1 className="text-3xl font-bold text-blue-700">Verify SMS code</h1><input aria-label="Mobile number" className="w-full rounded-lg border p-3" name="phone" type="tel" placeholder="+919876543210" required /><input aria-label="Six-digit code" className="w-full rounded-lg border p-3" name="token" inputMode="numeric" pattern="[0-9]{6}" required /><button className="w-full rounded-lg bg-blue-700 py-3 font-semibold text-white">Verify code</button>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</form></main>;
}

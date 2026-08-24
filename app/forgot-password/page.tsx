import Link from "next/link";
import { phoneRecoveryEnabled } from "@/lib/account-recovery";
import { RecoveryForms } from "./recovery-forms";

export default function ForgotPasswordPage() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"><section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
    <h1 className="text-3xl font-bold text-blue-700">Reset your password</h1>
    <p className="mt-2 mb-7 text-slate-600">Use a verified recovery method. For privacy, the response is the same whether or not an account matches.</p>
    <RecoveryForms phoneEnabled={phoneRecoveryEnabled()} />
    <p className="mt-6 text-center text-sm"><Link className="font-semibold text-blue-700" href="/login">Return to student login</Link></p>
  </section></main>;
}

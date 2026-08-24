import Link from "next/link";
import RecoveryRequestForm from "./recovery-request-form";

export default async function RecoverAccountPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const admin = (await searchParams).type === "admin";
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"><section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
    <h1 className="text-3xl font-bold text-blue-700">{admin ? "Administrator account recovery" : "Recover your student account"}</h1>
    <p className="mt-2 text-slate-600">This creates a private support request. We never reveal an email address or mobile number from the information entered here.</p>
    <RecoveryRequestForm admin={admin} />
    <p className="mt-6 text-center text-sm"><Link className="font-semibold text-blue-700" href={admin ? "/admin/login" : "/login"}>Return to login</Link></p>
  </section></main>;
}

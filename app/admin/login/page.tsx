import Link from "next/link";
import LoginForm from "@/app/login/login-form";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-center text-3xl font-bold text-blue-700">SAMRADHI CLASSES</h1>
        <p className="mt-2 text-center text-slate-500">Administrator login</p>
        <LoginForm admin />
        <p className="mt-6 text-center text-sm text-slate-500"><Link href="/login">Student login</Link></p>
      </div>
    </main>
  );
}

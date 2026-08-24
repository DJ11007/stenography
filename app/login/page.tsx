import Link from "next/link";
import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { confirmed } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-center text-3xl font-bold text-blue-700">SAMRADHI CLASSES</h1>
        <p className="mt-2 text-center text-slate-500">Student login</p>
        {confirmed && <p className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">Your email is confirmed. Please sign in.</p>}
        <LoginForm />
        <p className="mt-6 text-center text-sm text-slate-500"><Link href="/admin/login" className="font-semibold text-slate-700">Admin login</Link></p>
      </div>
    </main>
  );
}

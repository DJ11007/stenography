import SignupForm from "./signup-form";

export default function SignupPage() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4"><div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg"><h1 className="text-center text-3xl font-bold text-blue-700">SAMRADHI CLASSES</h1><p className="mt-2 text-center text-slate-500">Create your student account</p><SignupForm /></div></main>;
}

import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { BackButton } from "../../_components/back-button";

const CARDS = [
  { href: "/admin/app-control/typing", title: "Typing Test", text: "Add website typing tests to the app, create new ones, and show or hide exam boards, lessons and Quick Practice.", cta: "Manage typing →", tone: "from-blue-600 to-indigo-700" },
  { href: "/admin/app-control/steno", title: "Stenography", text: "Show, hide or lock each stenography exam board in the app.", cta: "Manage stenography →", tone: "from-emerald-600 to-teal-700" },
  { href: "/admin/app-control/efficiency", title: "Efficiency Test", text: "Show, hide or lock the Word and Excel efficiency tests in the app.", cta: "Manage efficiency →", tone: "from-amber-500 to-orange-600" },
] as const;

export default async function AppControlHubPage() {
  await requireAdmin();
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/admin" label="Admin panel" />
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-300">SCTyping desktop app</p>
          <h1 className="mt-2 text-3xl font-black">App control</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Decide what students get inside the installed app. Choose a section. Anything you don&apos;t change keeps working as normal.</p>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {CARDS.map((card) => (
            <Link key={card.href} href={card.href} className="overflow-hidden rounded-2xl bg-white shadow transition hover:-translate-y-1 hover:shadow-lg">
              <div className={`bg-gradient-to-br ${card.tone} px-6 py-5`}><h2 className="text-xl font-black text-white">{card.title}</h2></div>
              <div className="p-6"><p className="text-sm leading-6 text-slate-600">{card.text}</p><span className="mt-5 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">{card.cta}</span></div>
            </Link>
          ))}
        </div>
        <Link href="/admin/app-control/general" className="mt-5 block rounded-2xl bg-white p-5 shadow transition hover:shadow-lg">
          <h2 className="font-bold text-slate-900">Notice banner, free-trial limits &amp; home page sections →</h2>
          <p className="mt-1 text-sm text-slate-600">Show a message at the top of the app, change the trial length, or switch a whole section off.</p>
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";
import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";
import { SCTYPING_LATEST, SCTYPING_WIN7 } from "@/lib/sctyping-release";

export const metadata = {
  title: "SCTyping – Offline Typing App for Windows – Samradhi Classes",
  description:
    "Download SCTyping, the Samradhi Classes offline typing app for Windows. Learn typing, practice every exam board's typing pattern -- SSC, Railway, AIIMS, BSF, Delhi Police, High Courts and more -- and stenography, with no internet connection needed after install.",
  alternates: { canonical: "/offline-app" },
};

const SUPPORT_PHONE = "917014371324";
// Goes through the counting route (app/offline-app/download/route.ts), not straight to the file.
const DOWNLOAD_HREF = "/offline-app/download";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.6 6.3A8.9 8.9 0 0 0 12 4a8.9 8.9 0 0 0-7.7 13.4L3 21l3.7-1.2A8.9 8.9 0 0 0 12 21a8.9 8.9 0 0 0 5.6-15.7ZM12 19.3a7.3 7.3 0 0 1-3.7-1l-.3-.2-2.2.7.7-2.1-.2-.3a7.3 7.3 0 1 1 5.7 2.9Zm4-5.4c-.2-.1-1.3-.6-1.5-.7-.2-.1-.3-.1-.5.1-.1.2-.5.7-.6.8-.1.1-.2.1-.4 0a6 6 0 0 1-1.8-1.1 6.6 6.6 0 0 1-1.2-1.5c-.1-.2 0-.3.1-.4l.3-.4.2-.3v-.3L9.8 8.3c-.1-.2-.3-.2-.5-.2h-.4c-.1 0-.4 0-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.4 3.8 3.4.5.2.9.4 1.3.5.5.1 1 .1 1.3.1.4-.1 1.3-.5 1.5-1.1.2-.5.2-.9.1-1l-.4-.2Z" />
    </svg>
  );
}

export default function OfflineAppPage() {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />

      <section className="bg-gradient-to-br from-blue-700 via-indigo-800 to-violet-900 px-6 py-14 text-center text-white sm:py-20">
        <p className="text-xs font-black uppercase tracking-widest text-blue-100">For Windows computers</p>
        <h1 className="mt-3 text-3xl font-black sm:text-5xl">SCTyping — Offline Typing App</h1>
        <p className="mx-auto mt-4 max-w-2xl text-blue-100">
          Every exam board&apos;s typing pattern, right on your computer. No internet connection, no account sign-in, no
          interruptions once it&apos;s installed and activated.
        </p>
        <a
          href={DOWNLOAD_HREF}
          download
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-black text-indigo-900 shadow-lg transition hover:-translate-y-0.5"
        >
          ⬇ Download for Windows
        </a>
        <p className="mt-3 text-xs text-blue-200">Version {SCTYPING_LATEST.version} &middot; Free trial &middot; ~4&nbsp;MB &middot; Windows 10 / 11 (64-bit)</p>
        <div className="mx-auto mt-6 max-w-xl rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
          <p className="text-sm font-black">Using Windows 7 or Windows 8?</p>
          <a href={`${DOWNLOAD_HREF}?edition=win7`} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-2.5 font-black text-amber-950 shadow transition hover:-translate-y-0.5">
            ⬇ Download for Windows 7 / 8
          </a>
          <p className="mt-2 text-xs text-blue-200">Version {SCTYPING_WIN7.version} &middot; ~{SCTYPING_WIN7.sizeMb}&nbsp;MB (includes Microsoft WebView2, which these older Windows need) &middot; 64-bit</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-black text-slate-900">What&apos;s inside</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Feature title="Learn typing from zero" body="Step-by-step Hindi (Kruti Dev) and English lessons -- keys, then words, then paragraphs -- with an on-screen keyboard showing which finger presses the next key." />
          <Feature title="Every exam board, offline" body="SSC CHSL/CGL, RRB NTPC, AIIMS CRE, BSF/CRPF/SSB HCM, Delhi Police HCM, DSSSB, Rajasthan boards, several High Courts, and more -- the exact same researched patterns as the website, bundled right into the app." />
          <Feature title="English and Hindi" body="Includes every Hindi input system: Kruti Dev 010, Mangal, and the Remington/InScript Unicode layouts." />
          <Feature title="Stenography dictation" body="Listen to a passage read aloud -- by your computer's own voice, or a clip you record yourself -- then transcribe it from memory, just like a real shorthand test." />
          <Feature title="Word &amp; Excel Efficiency" body="Build a document or spreadsheet using the same formatting tools -- bold, fonts, tables, cell formatting, formulas -- and submit for the same marking rules as the website's efficiency tests." />
          <Feature title="Practice settings that matter" body="Font size, highlight mode, auto-scroll, keyboard click sound, and full-screen mode -- free to adjust in practice, locked to the real pattern in Exam Simulator so the exam stays authentic." />
          <Feature title="Your results, saved locally" body="Every attempt is saved on your own computer so you can track your WPM and accuracy over time -- nothing is uploaded anywhere." />
          <Feature title="Works with zero internet" body="Once installed and activated, the app never needs a connection again -- practice anywhere, anytime." />
        </div>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-black">Seeing a blue &quot;Windows protected your PC&quot; screen?</p>
          <p className="mt-1">
            That&apos;s normal for a brand-new app and nothing to worry about -- click <strong>More info</strong>, then{" "}
            <strong>Run anyway</strong> to continue installing.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-7">
          <h2 className="text-xl font-black text-slate-900">How activation works</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
            <li>Install the app and try it free -- every section works, with tests limited to 1 minute in the trial.</li>
            <li>Click <strong>Trial — Activate</strong> at the top of the app and send us the Device ID it shows, on WhatsApp.</li>
            <li>We reply with your activation key -- paste it in and the full app unlocks, permanently, on that computer.</li>
          </ol>
          <a
            href={`https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent("Hi, I'd like to know more about the offline typing app.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-black text-white"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Ask us on WhatsApp
          </a>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Prefer practicing in the browser instead?{" "}
          <Link href="/typing" className="font-bold text-blue-700 underline">
            Go to Typing on the website
          </Link>
          .
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-black text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

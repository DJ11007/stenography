import Link from "next/link";
import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";

export const metadata = {
  title: "About Us | Samradhi Classes",
  description: "Samradhi Classes is a typing, efficiency and stenography coaching institute in Sanganer, Jaipur, preparing students for government exams.",
};

const FOCUS_AREAS = [
  {
    title: "Hindi & English Typing",
    text: "Kruti Dev 010, Mangal, DevLys, Unicode Hindi, Remington Gail and InScript keyboard layouts, trained for real exam speed and accuracy requirements.",
  },
  {
    title: "Computer Efficiency",
    text: "Practical MS Word document-editing tests in the exact format used for RSSB, RHC and similar efficiency exams, with instant scoring.",
  },
  {
    title: "Stenography",
    text: "Shorthand dictation and transcription training for SSC, RSSB, MP High Court, Allahabad High Court, Supreme Court and Judicial Assistant exams.",
  },
] as const;

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />

      <section className="bg-gradient-to-br from-blue-700 via-indigo-800 to-violet-900 px-6 py-14 text-center text-white sm:py-20">
        <p className="text-xs font-black uppercase tracking-widest text-blue-100">Who we are</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">About Samradhi Classes</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-blue-50 sm:text-lg">
          A typing, efficiency and stenography coaching institute based in Sanganer, Jaipur, preparing students
          for All India and Rajasthan state government exams.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <h2 className="text-2xl font-black text-slate-950">What we do</h2>
        <p className="mt-3 leading-relaxed text-slate-600">
          Samradhi Classes trains students in Hindi and English typing, computer efficiency and stenography for
          competitive government exams — from SSC CGL/CHSL and NTPC to state-level exams like RSSB LDC, RSSB IA,
          RHC LDC and RHC SA. Alongside in-person coaching, this platform gives every student free practice tests,
          timed exams, and a live-test centre so progress can be tracked from anywhere.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {FOCUS_AREAS.map((area) => (
            <div key={area.title} className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
              <h3 className="font-black text-slate-950">{area.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{area.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Visit or reach us</h2>
          <p className="mt-2 text-sm text-slate-600">
            26, Bairwa Colony, near Shri Ram Marriage Garden, near Sanganer Airport, behind Choudhary Petrol Pump,
            Sanganer, Jaipur – 302029
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="tel:+917014371324"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-800"
            >
              Call 7014371324
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-blue-700 px-5 py-2.5 text-sm font-black text-blue-700 transition-colors hover:bg-blue-50"
            >
              Contact page
            </Link>
            <Link
              href="/typing"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-blue-100 px-5 py-2.5 text-sm font-black text-slate-700 transition-colors hover:bg-blue-50"
            >
              Try a free typing test
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

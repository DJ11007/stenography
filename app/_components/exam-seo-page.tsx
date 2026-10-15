import Link from "next/link";
import { JsonLd } from "./json-ld";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { breadcrumbJsonLd, faqJsonLd, type Faq } from "@/lib/seo";
import type { ExamSummary } from "@/lib/seo-exams";

export type ExamSeoPageProps = {
  kindLabel: "Typing Test" | "Stenography Skill Test";
  name: string;
  fullName: string;
  badge: string;
  level: "Central" | "State";
  path: string;
  intro: string;
  pattern: { label: string; value: string }[];
  patternSourced: boolean;
  notes: string[];
  notesHindi?: string[];
  faqs: Faq[];
  practiceHref: string;
  related: ExamSummary[];
};

/** Public, indexable page describing one exam's typing/stenography test. */
export function ExamSeoPage(props: ExamSeoPageProps) {
  const title = `${props.name} ${props.kindLabel}`;
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />
      <JsonLd data={faqJsonLd(props.faqs)} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "All Exams", path: "/exams" }, { name: title, path: props.path }])} />

      <section className="bg-gradient-to-br from-blue-700 via-indigo-800 to-violet-900 px-4 py-10 text-white sm:py-14">
        <div className="mx-auto max-w-5xl">
          <nav aria-label="Breadcrumb" className="text-xs font-bold text-blue-100">
            <Link href="/" className="hover:text-white">Home</Link> <span aria-hidden>›</span>{" "}
            <Link href="/exams" className="hover:text-white">All Exams</Link> <span aria-hidden>›</span> <span>{props.name}</span>
          </nav>
          <p className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-widest">{props.badge} · {props.level} level</p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">{title}: Speed, Pattern &amp; Online Practice</h1>
          <p className="mt-3 max-w-3xl text-base text-blue-50 sm:text-lg">{props.intro}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={props.practiceHref} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-blue-800 shadow-lg transition hover:-translate-y-0.5">
              Practice {props.name} test free <span aria-hidden>→</span>
            </Link>
            <Link href="/courses" className="inline-flex items-center gap-2 rounded-xl border-2 border-white/80 px-5 py-3 font-black text-white transition hover:bg-white hover:text-blue-800">
              View courses
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <section aria-labelledby="pattern-heading">
          <h2 id="pattern-heading" className="text-2xl font-black text-slate-950">{props.name} {props.kindLabel.toLowerCase()} pattern</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-blue-100">
            <table className="w-full text-left text-sm">
              <tbody>
                {props.pattern.map((row) => (
                  <tr key={row.label} className="border-b border-blue-50 last:border-0">
                    <th scope="row" className="w-2/5 bg-blue-50/70 px-4 py-3 font-black text-slate-800">{row.label}</th>
                    <td className="px-4 py-3 text-slate-700">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {props.patternSourced
              ? "Based on published exam-pattern research for this post. Patterns can change between recruitments, so always check the current official notification."
              : "Approximate pattern from the closest comparable exam; no confirmed official figure was found for this exact post. Check the official notification."}
          </p>
        </section>

        {props.notes.length > 0 && (
          <section aria-labelledby="notes-heading">
            <h2 id="notes-heading" className="text-2xl font-black text-slate-950">Important points about the {props.name} test</h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
              {props.notes.map((note) => <li key={note} className="flex gap-2"><span aria-hidden className="text-blue-600">✓</span><span>{note}</span></li>)}
            </ul>
          </section>
        )}

        {props.notesHindi && props.notesHindi.length > 0 && (
          <section aria-labelledby="notes-hindi-heading" lang="hi">
            <h2 id="notes-hindi-heading" className="text-2xl font-black text-slate-950">{props.name} {props.kindLabel === "Typing Test" ? "टाइपिंग टेस्ट" : "स्टेनो स्किल टेस्ट"}: मुख्य बातें</h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
              {props.notesHindi.map((note) => <li key={note} className="flex gap-2"><span aria-hidden className="text-blue-600">✓</span><span>{note}</span></li>)}
            </ul>
          </section>
        )}

        <section aria-labelledby="exam-faq-heading">
          <h2 id="exam-faq-heading" className="text-2xl font-black text-slate-950">{props.name} {props.kindLabel.toLowerCase()}: FAQs</h2>
          <div className="mt-4 space-y-3">
            {props.faqs.map((faq) => (
              <details key={faq.question} className="group rounded-2xl border border-blue-100 bg-white p-5 shadow-sm open:shadow-md">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-black text-slate-950">
                  <h3 className="text-base">{faq.question}</h3>
                  <span aria-hidden className="mt-0.5 shrink-0 text-blue-700 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {props.related.length > 0 && (
          <section aria-labelledby="related-heading">
            <h2 id="related-heading" className="text-2xl font-black text-slate-950">Related exams</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {props.related.map((exam) => (
                <li key={exam.path}>
                  <Link href={exam.path} className="block rounded-xl border border-blue-100 p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                    <span className="font-black text-slate-950">{exam.name} {exam.kind === "typing" ? "Typing Test" : "Steno Test"}</span>
                    <span className="mt-1 block text-xs text-slate-500">{exam.speedLabel}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/exams" className="mt-4 inline-block text-sm font-black text-blue-700 hover:underline">See all government exam typing &amp; stenography tests →</Link>
          </section>
        )}

        <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
          SC Typing (Samradhi Classes) offers independent practice for the {props.fullName} {props.kindLabel.toLowerCase()}. It is not affiliated with or endorsed by the recruiting authority.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}

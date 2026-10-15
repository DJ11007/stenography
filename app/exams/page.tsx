import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../_components/json-ld";
import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";
import { BASE_OPEN_GRAPH, absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";
import { ALL_EXAMS, examsByGroup } from "@/lib/seo-exams";

const TITLE = "Government Exam Typing & Stenography Tests – SSC, Railway, High Court, State Exams";
const DESCRIPTION = `Typing test and stenography skill test pattern for ${ALL_EXAMS.length} central and state government exams: SSC CHSL/CGL, SSC Steno, RRB NTPC, Supreme Court, High Courts, Rajasthan LDC, DSSSB, UP, Bihar, MP and more, with online practice on SC Typing.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/exams" },
  openGraph: { ...BASE_OPEN_GRAPH, title: TITLE, description: DESCRIPTION, url: "/exams" },
};

export default function ExamsHubPage() {
  const sections = [
    { kind: "typing" as const, heading: "Typing tests", sub: "English & Hindi typing speed tests (Kruti Dev, Mangal, Remington, InScript)", groups: examsByGroup("typing") },
    { kind: "stenography" as const, heading: "Stenography skill tests", sub: "Shorthand dictation and transcription in English & Hindi", groups: examsByGroup("stenography") },
  ];
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "All Exams", path: "/exams" }])} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: TITLE, itemListElement: ALL_EXAMS.map((exam, index) => ({ "@type": "ListItem", position: index + 1, name: `${exam.name} ${exam.kind === "typing" ? "Typing Test" : "Stenography Skill Test"}`, url: absoluteUrl(exam.path) })) }} />

      <section className="bg-gradient-to-br from-blue-700 via-indigo-800 to-violet-900 px-4 py-12 text-center text-white sm:py-16">
        <p className="text-xs font-black uppercase tracking-widest text-blue-100">Central &amp; state level</p>
        <h1 className="mx-auto mt-2 max-w-4xl text-3xl font-black sm:text-5xl">Typing &amp; Stenography Tests for Every Government Exam</h1>
        <p className="mx-auto mt-4 max-w-3xl text-base text-blue-50 sm:text-lg">
          Speed, time, accuracy and backspace rules for {ALL_EXAMS.length} exams, including SSC, Railway, Supreme Court and High Courts, police and central forces, and state exams, each with an exam-pattern practice test on SC Typing.
        </p>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
        {sections.map((section) => (
          <section key={section.kind} aria-labelledby={`${section.kind}-heading`}>
            <h2 id={`${section.kind}-heading`} className="text-3xl font-black text-slate-950">{section.heading}</h2>
            <p className="mt-1 text-sm text-slate-600">{section.sub}</p>
            <div className="mt-6 space-y-8">
              {section.groups.map(({ group, exams }) => (
                <div key={group}>
                  <h3 className="text-lg font-black text-blue-800">{group}</h3>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {exams.map((exam) => (
                      <li key={exam.path}>
                        <Link href={exam.path} className="flex h-full flex-col rounded-xl border border-blue-100 p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                          <span className="font-black text-slate-950">{exam.name} {exam.kind === "typing" ? "Typing Test" : "Steno Test"}</span>
                          <span className="mt-0.5 text-xs text-slate-500">{exam.fullName}</span>
                          <span className="mt-2 text-xs font-bold text-blue-700">{exam.speedLabel} · {exam.level}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          Don&apos;t see your exam? Call or WhatsApp 7014371324. We add new exam patterns as recruitments are notified.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}

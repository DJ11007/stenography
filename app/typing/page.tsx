import Link from "next/link";
import { TypingBrandHeader } from "./_components/typing-brand";

const sections = [
  {
    title: "Learn Typing",
    description: "Admin-published lessons, finger guidance, an on-screen keyboard and accuracy-based progression.",
    href: "/typing/learn",
    action: "Explore lessons",
    icon: "⌨",
    tone: "bg-blue-600",
  },
  {
    title: "Practice Tests",
    description: "Flexible practice with editable backspace, highlighting, calculation and scrolling settings.",
    href: "/typing/practice",
    action: "Choose practice",
    icon: "◎",
    tone: "bg-green-600",
  },
  {
    title: "Exam Simulators",
    description: "Independent practice simulations with transparent preset rules and locked exam settings.",
    href: "/typing/exams",
    action: "View simulators",
    icon: "▣",
    tone: "bg-indigo-600",
  },
  {
    title: "Word/Excel Efficiency",
    description: "Document and spreadsheet efficiency practice will arrive in a later phase.",
    href: "",
    action: "Coming Soon",
    icon: "▦",
    tone: "bg-slate-500",
  },
];

export default function TypingHubPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <TypingBrandHeader />
      <section className="mx-auto max-w-7xl px-4 py-12">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-600">Choose your path</p>
        <h2 className="mt-2 text-3xl font-black">Four focused typing areas</h2>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <article
              key={section.title}
              className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black text-white ${section.tone}`}
                aria-hidden="true"
              >
                {section.icon}
              </div>
              <h3 className="mt-6 text-2xl font-black">{section.title}</h3>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">{section.description}</p>
              {section.href ? (
                <Link
                  href={section.href}
                  className="mt-6 inline-flex rounded-xl bg-blue-50 px-5 py-3 font-black text-blue-700 group-hover:bg-blue-600 group-hover:text-white"
                >
                  {section.action} →
                </Link>
              ) : (
                <span className="mt-6 inline-flex rounded-xl bg-slate-100 px-5 py-3 font-black text-slate-500">
                  {section.action}
                </span>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

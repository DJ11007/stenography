import Link from "next/link";
import Image from "next/image";
import { LiveResultsTicker, type PublicLiveResult } from "./_components/live-results-ticker";
import { Reveal } from "./_components/reveal";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";
import { StudentSuccessCarousel } from "./_components/student-success-carousel";
import { VacancyCarousel } from "./_components/vacancy-carousel";
import { VacancySections } from "./_components/vacancy-sections";
import { FeedbackSection } from "./_components/feedback-section";
import { WhatsAppButton } from "./_components/whatsapp-button";
import { BuyNowButton } from "./_components/buy-now-button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedFeedback, getPublishedOfficialWebsites, getPublishedVacancies } from "@/lib/homepage-content-server";

const EXAM_CATEGORIES = [
  {
    icon: "keyboard",
    iconColor: "text-cyan-300",
    label: "Hindi & English Typing",
    text: "Kruti Dev 010, Mangal, DevLys, Remington Gail and InScript layouts.",
  },
  {
    icon: "flag",
    iconColor: "text-amber-300",
    label: "All India Exams",
    text: "SSC CGL/CHSL, NTPC, DSSSB, BSF, Army, KVS/NVS and Assam Rifles.",
  },
  {
    icon: "map",
    iconColor: "text-emerald-300",
    label: "State Exams",
    text: "RSSB LDC, RSSB IA, RHC LDC, RHC SA, RVVUNL, MP-CPCT, UPPSC, UPPCL, UP Police and BELTRON.",
  },
  {
    icon: "mic",
    iconColor: "text-violet-300",
    label: "Stenography Test",
    text: "SSC Steno, RSSB Steno, MP High Court, Allahabad High Court, Supreme Court, Session Courts and Judicial Assistant Exam.",
  },
  {
    icon: "gauge",
    iconColor: "text-rose-300",
    label: "Efficiency Test",
    text: "RSSB LDC, RHC LDC, RHC SA and all other vacancies.",
  },
] as const;

const COURSES = [
  {
    title: "Hindi & English Typing",
    icon: "keyboard",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
    description: "Learn English typing, Kruti Dev and Unicode Hindi with speed and accuracy.",
    points: ["Kruti Dev, Mangal & DevLys fonts", "Remington Gail & InScript layouts", "Timed speed & accuracy drills"],
    href: "/typing/learn",
    cta: "Start learning",
  },
  {
    title: "Efficiency",
    icon: "gauge",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    description: "Build practical computer efficiency skills for competitive examinations.",
    points: ["MS Word document editing tests", "Exam-format working matter", "Instant accuracy scoring"],
    href: "/typing/word-efficiency",
    cta: "Practice efficiency",
  },
  {
    title: "Stenography",
    icon: "mic",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-700",
    description: "Complete shorthand and transcription training.",
    points: ["Dictation at exam speeds", "Hindi & English transcription", "SSC, RSSB & High Court patterns"],
    href: "/typing/stenography",
    cta: "Practice stenography",
  },
] as const;

type IconName = (typeof COURSES)[number]["icon"] | (typeof EXAM_CATEGORIES)[number]["icon"];

function Icon({ name, className }: { name: IconName; className: string }) {
  const common = {
    "aria-hidden": true,
    focusable: false,
    viewBox: "0 0 24 24",
    className: `h-6 w-6 ${className}`,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "keyboard") return <svg {...common}><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 14h12"/></svg>;
  if (name === "gauge") return <svg {...common}><path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4-5"/><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none"/></svg>;
  if (name === "mic") return <svg {...common}><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></svg>;
  if (name === "flag") return <svg {...common}><path d="M5 21V4"/><path d="M5 4h13l-2.5 4L18 12H5"/></svg>;
  return <svg {...common}><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
}

export default async function Home() {
  const supabase = await createClient();
  const [{ data: liveResults }, vacancies, feedback, officialWebsites, user] = await Promise.all([
    supabase.rpc("published_live_results", { p_limit: 20 }),
    getPublishedVacancies(),
    getApprovedFeedback(6),
    getPublishedOfficialWebsites(),
    getCurrentUser(),
  ]);
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-800 to-violet-900 py-14 text-white sm:py-20">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          aria-hidden
          className="animate-blob-float absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/30 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-blob-float absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl"
          style={{ animationDelay: "-5s" }}
        />

        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <span className="animate-fade-in-up inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-50 ring-1 ring-white/25 backdrop-blur-sm">
            Typing · Efficiency · Stenography Coaching
          </span>

          <Image
            src="/samradhi-classes-logo.png"
            alt="Samradhi Classes"
            width={72}
            height={72}
            priority
            className="animate-fade-in-up mx-auto mt-5 h-[72px] w-[72px] rounded-full bg-white object-contain shadow-xl ring-2 ring-white/80"
            style={{ animationDelay: "40ms" }}
          />
          <h1
            className="animate-fade-in-up mt-4 text-4xl font-black tracking-tight sm:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            SAMRADHI CLASSES
          </h1>

          <p
            className="animate-fade-in-up mt-3 text-lg font-bold text-blue-50 sm:text-xl"
            style={{ animationDelay: "120ms" }}
          >
            Typing, Efficiency and Stenography Test
          </p>

          <div
            className="animate-fade-in-up mx-auto mt-8 grid max-w-5xl gap-3 text-left sm:grid-cols-2"
            style={{ animationDelay: "160ms" }}
          >
            {EXAM_CATEGORIES.map((category) => (
              <div
                key={category.label}
                className="flex gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm transition-colors hover:bg-white/15 sm:first:col-span-2"
              >
                <Icon name={category.icon} className={`${category.iconColor} mt-0.5 shrink-0`} />
                <div>
                  <p className="text-sm font-black text-white">{category.label}</p>
                  <p className="mt-0.5 text-sm text-blue-50/90">{category.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            className="animate-fade-in-up mt-8 flex flex-wrap justify-center gap-4"
            style={{ animationDelay: "200ms" }}
          >
            <Link
              href="/live-test"
              className="inline-flex items-center gap-2.5 rounded-xl bg-white px-6 py-3 font-black text-blue-700 shadow-lg shadow-blue-950/30 transition-transform hover:-translate-y-0.5 hover:bg-blue-50"
            >
              <span className="relative flex h-2.5 w-2.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
              </span>
              Join Live Test
            </Link>

            <Link
              href="/typing"
              className="group inline-flex items-center gap-2 rounded-xl border-2 border-white/80 px-6 py-3 font-black text-white transition-all hover:-translate-y-0.5 hover:bg-white hover:text-blue-700"
            >
              Free Typing Test
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-blue-100 bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <Reveal className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm lg:p-9">
            <aside aria-label="Vacancy updates">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-widest text-blue-700">Samradhi updates</p><h2 className="mt-1 text-2xl font-black text-slate-950">Latest vacancies</h2></div>
                <BuyNowButton />
              </div>
              <VacancyCarousel vacancies={vacancies.filter((vacancy) => vacancy.category === "jobs")} />
            </aside>
          </Reveal>
          <Reveal className="mt-8">
            <FeedbackSection feedback={feedback} canSubmit={Boolean(user)} />
          </Reveal>
          <Reveal className="mt-8">
            <VacancySections vacancies={vacancies} officialWebsites={officialWebsites} compact />
          </Reveal>
          <Reveal className="mt-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-blue-700">Published automatically</p><h2 className="mt-1 text-2xl font-black">Latest live-test results</h2></div><Link href="/live-test" className="text-sm font-black text-blue-700">Open live-test centre →</Link></div><LiveResultsTicker results={(liveResults??[]) as PublicLiveResult[]}/>
          </Reveal>
          <Reveal className="mt-8">
            <StudentSuccessCarousel />
          </Reveal>
        </div>
      </section>

      {/* Courses */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-black uppercase tracking-widest text-blue-700">What we teach</p>
            <h2 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">Our Courses</h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Everything you need to clear typing, efficiency and stenography exams.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {COURSES.map((course, index) => (
              <Reveal key={course.title} delay={index * 120} className="h-full">
              <article
                className="group flex h-full flex-col rounded-2xl border border-blue-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/10"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${course.iconBg}`}>
                  <Icon name={course.icon} className={course.iconColor} />
                </div>
                <h3 className="mt-4 text-xl font-black text-slate-950">{course.title}</h3>
                <p className="mt-2 flex-1 text-sm text-slate-600">{course.description}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                  {course.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden className="text-blue-600">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={course.href}
                  className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white transition-colors group-hover:bg-blue-800"
                >
                  {course.cta}
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
              </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <SiteFooter />
      <WhatsAppButton />
    </main>
  );
}

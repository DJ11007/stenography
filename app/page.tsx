import Link from "next/link";
import Image from "next/image";
import { LiveResultsByLanguage } from "./_components/live-results-by-language";
import { LiveTestTopRankers } from "./_components/live-test-top-rankers";
import { Reveal } from "./_components/reveal";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";
import { StudentSuccessCarousel } from "./_components/student-success-carousel";
import { VacancyCarousel } from "./_components/vacancy-carousel";
import { VacancySections } from "./_components/vacancy-sections";
import { FeedbackSection } from "./_components/feedback-section";
import { WhatsAppButton } from "./_components/whatsapp-button";
import { HomepageTypingDemo } from "./_components/homepage-typing-demo";
import { BuyNowButton } from "./_components/buy-now-button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedFeedback, getPublishedOfficialWebsites, getPublishedVacancies } from "@/lib/homepage-content-server";
import { getPublishedLiveResults, getLiveTestTopRankers } from "@/lib/live-test-results-server";

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
    label: "All India & State Exams",
    text: "SSC CGL/CHSL, NTPC, DSSSB, BSF, Army, KVS/NVS, Assam Rifles, RSSB LDC, RSSB IA, RHC LDC, RHC SA, RVVUNL, MP-CPCT, UPPSC, UPPCL, UP Police and BELTRON.",
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

const RESULT_CARD_TONES = { blue: "border-blue-200 bg-blue-50 text-blue-900", violet: "border-violet-200 bg-violet-50 text-violet-900", emerald: "border-emerald-200 bg-emerald-50 text-emerald-900" } as const;
function MyResultCard({ label, tone, href, title, metrics }: { label: string; tone: keyof typeof RESULT_CARD_TONES; href: string; title: string; metrics: [string, string][] }) {
  return (
    <Link href={href} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${RESULT_CARD_TONES[tone]}`}>
      <div>
        <p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
        <p className="mt-0.5 font-black text-slate-950">{title}</p>
      </div>
      <div className="flex flex-wrap gap-4">
        {metrics.map(([metricLabel, value]) => (
          <div key={metricLabel} className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{metricLabel}</p>
            <p className="font-black text-slate-950">{value}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}
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
  const [liveResults, topRankersEnglish, topRankersHindi, vacancies, feedback, officialWebsites, user] = await Promise.all([
    getPublishedLiveResults(20),
    getLiveTestTopRankers("English"),
    getLiveTestTopRankers("Hindi"),
    getPublishedVacancies(),
    getApprovedFeedback(6),
    getPublishedOfficialWebsites(),
    getCurrentUser(),
  ]);

  // Personalized "my latest result" cards, in the requested Typing ->
  // Stenography -> Efficiency order -- distinct from the anonymized
  // LiveResultsTicker below (everyone's recent live-test results); these
  // show only the CURRENT visitor's own most recent attempt in each
  // category, each linking to that attempt's full passage-vs-typed result
  // (typing/stenography: the new /typing/attempts/[id] page; efficiency:
  // the existing /typing/word-efficiency or excel-efficiency results
  // page, which already withholds marks until the teacher publishes
  // grading). Nothing renders here for a logged-out visitor.
  let typingResult: { href: string; title: string; netWpm: number; grossWpm: number } | null = null;
  let stenographyResult: { href: string; title: string; netWpm: number; passed: boolean } | null = null;
  let efficiencyResult: { href: string; title: string; subject: "Word" | "Excel"; marks: number; maximumMarks: number; passed: boolean | null } | null = null;
  if (user) {
    const [{ data: attempts }, { data: wordAttempt }, { data: excelAttempt }] = await Promise.all([
      supabase.from("test_attempts").select("id,test_id,test_version_id,result,submitted_at").eq("student_id", user.id).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(30),
      supabase.from("word_efficiency_attempts").select("id,result,submitted_at").eq("student_id", user.id).eq("evaluation_status", "published").order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("excel_efficiency_attempts").select("id,result,submitted_at").eq("student_id", user.id).eq("evaluation_status", "published").order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const testIds = [...new Set((attempts ?? []).map((attempt) => attempt.test_id))];
    const { data: tests } = testIds.length ? await supabase.from("tests").select("id,mode,title").in("id", testIds) : { data: [] };
    const testMap = new Map((tests ?? []).map((test) => [test.id, test]));
    const typingAttempt = (attempts ?? []).find((attempt) => testMap.get(attempt.test_id)?.mode !== "stenography");
    const stenographyAttempt = (attempts ?? []).find((attempt) => testMap.get(attempt.test_id)?.mode === "stenography");
    if (typingAttempt) {
      const r = (typingAttempt.result ?? {}) as Record<string, unknown>;
      typingResult = { href: `/typing/attempts/${typingAttempt.id}`, title: testMap.get(typingAttempt.test_id)?.title ?? "Typing test", netWpm: Number(r.marksNetWpm ?? r.netWpm ?? 0), grossWpm: Number(r.grossWpm ?? 0) };
    }
    if (stenographyAttempt) {
      const r = (stenographyAttempt.result ?? {}) as Record<string, unknown>;
      const { data: version } = stenographyAttempt.test_version_id ? await supabase.from("test_versions").select("required_wpm,required_accuracy").eq("id", stenographyAttempt.test_version_id).maybeSingle() : { data: null };
      const netWpm = Number(r.marksNetWpm ?? r.netWpm ?? 0);
      const passed = r.marksQualified != null ? Boolean(r.marksQualified) : version ? netWpm >= Number(version.required_wpm) && Number(r.accuracy ?? 0) >= Number(version.required_accuracy) : false;
      stenographyResult = { href: `/typing/attempts/${stenographyAttempt.id}`, title: testMap.get(stenographyAttempt.test_id)?.title ?? "Stenography test", netWpm, passed };
    }
    const latestEfficiency = [wordAttempt ? { ...wordAttempt, subject: "Word" as const } : null, excelAttempt ? { ...excelAttempt, subject: "Excel" as const } : null].filter((attempt): attempt is NonNullable<typeof attempt> => attempt !== null).sort((a, b) => new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime())[0];
    if (latestEfficiency) {
      const r = (latestEfficiency.result ?? {}) as Record<string, unknown>;
      efficiencyResult = { href: `/typing/${latestEfficiency.subject === "Word" ? "word-efficiency" : "excel-efficiency"}/results/${latestEfficiency.id}`, title: latestEfficiency.subject === "Word" ? "Word Efficiency" : "Excel Efficiency", subject: latestEfficiency.subject, marks: Number(r.marks ?? 0), maximumMarks: Number(r.maximum_marks ?? 0), passed: r.passed == null ? null : Boolean(r.passed) };
    }
  }
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-700 via-indigo-900 to-slate-950 py-10 text-white sm:py-14">
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
            className="animate-fade-in-up mx-auto mt-3 h-[72px] w-[72px] rounded-full bg-white object-contain shadow-xl ring-2 ring-white/80"
            style={{ animationDelay: "40ms" }}
          />
          <h1
            className="animate-fade-in-up mt-4 text-4xl font-black tracking-tight sm:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            SAMRADHI CLASSES
          </h1>

          <div
            className="animate-fade-in-up mx-auto mt-6 grid max-w-6xl gap-3 text-left sm:grid-cols-2 lg:grid-cols-4"
            style={{ animationDelay: "160ms" }}
          >
            {EXAM_CATEGORIES.map((category) => (
              <div
                key={category.label}
                className="flex gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm transition-colors hover:bg-white/15"
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
              href="/typing"
              className="group inline-flex items-center gap-2 rounded-xl border-2 border-white/80 px-6 py-3 font-black text-white transition-all hover:-translate-y-0.5 hover:bg-white hover:text-blue-700"
            >
              Free Typing Test
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
      </section>

      <HomepageTypingDemo />

      <section className="border-b border-blue-100 bg-white px-4 py-12">
        <div className="mx-auto max-w-7xl">
          {(typingResult || stenographyResult || efficiencyResult) && (
            <Reveal>
              <p className="text-xs font-black uppercase tracking-widest text-blue-700">Your latest results</p>
              {/* Real reported problem: each result card was a full-width
                  stacked row with lots of unused space to the right, and
                  the Student Success Story carousel (with its "Visit
                  Samradhi Classes" info box) sat much further down the
                  page, disconnected from this section. Splitting into two
                  columns fills that wasted space with the success story
                  instead -- both only appear together, tied to whether
                  this visitor actually has a result to show. */}
              <div className="mt-3 grid gap-6 lg:grid-cols-2 lg:items-start">
                <div className="grid gap-4">
                  {typingResult && <MyResultCard label="Typing" tone="blue" href={typingResult.href} title={typingResult.title} metrics={[["Net WPM", String(typingResult.netWpm)], ["Gross WPM", String(typingResult.grossWpm)]]} />}
                  {stenographyResult && <MyResultCard label="Stenography" tone="violet" href={stenographyResult.href} title={stenographyResult.title} metrics={[["Net WPM", String(stenographyResult.netWpm)], ["Result", stenographyResult.passed ? "Pass" : "Fail"]]} />}
                  {efficiencyResult && <MyResultCard label={`Efficiency · ${efficiencyResult.subject}`} tone="emerald" href={efficiencyResult.href} title={efficiencyResult.title} metrics={[["Marks", `${efficiencyResult.marks} / ${efficiencyResult.maximumMarks}`], ["Result", efficiencyResult.passed == null ? "Not graded" : efficiencyResult.passed ? "Pass" : "Fail"]]} />}
                </div>
                <StudentSuccessCarousel />
              </div>
            </Reveal>
          )}
          <Reveal className={(typingResult || stenographyResult || efficiencyResult) ? "mt-8" : ""}>
            <p className="text-xs font-black uppercase tracking-widest text-blue-700">Top Rankers</p>
            <h2 className="mt-1 text-2xl font-black">Live-test leaderboard</h2>
            <div className="mt-4">
              <LiveTestTopRankers english={topRankersEnglish} hindi={topRankersHindi} />
            </div>
          </Reveal>
          <Reveal className="mt-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-blue-700">Published automatically</p><h2 className="mt-1 text-2xl font-black">Latest live-test results</h2></div><Link href="/live-test" className="text-sm font-black text-blue-700">Open live-test centre →</Link></div><LiveResultsByLanguage results={liveResults}/>
          </Reveal>
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

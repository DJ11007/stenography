import Link from "next/link";
import Image from "next/image";
import { AccessNavigation } from "./_components/access-navigation";
import { LiveResultsTicker, type PublicLiveResult } from "./_components/live-results-ticker";
import { StudentSuccessCarousel } from "./_components/student-success-carousel";
import { VacancyCarousel } from "./_components/vacancy-carousel";
import { VacancySections } from "./_components/vacancy-sections";
import { createClient } from "@/lib/supabase/server";
import { VACANCIES } from "@/lib/vacancies";

const OFFICIAL_LINKS = [
  { label: "YouTube", href: "https://youtube.com/@samradhiclasses", ariaLabel: "Visit Samradhi Classes on YouTube", icon: "youtube", iconColor: "text-red-600" },
  { label: "Instagram", href: "https://www.instagram.com/samradhiclasses", ariaLabel: "Visit Samradhi Classes on Instagram", icon: "instagram", iconColor: "text-fuchsia-600" },
  { label: "Mobile App", href: "https://inxcft.on-app.in/app/home/app/home?orgCode=inxcft", ariaLabel: "Open the official Samradhi Classes mobile app", icon: "mobile", iconColor: "text-blue-500" },
  { label: "Existing Website", href: "https://classplusapp.com/w/samradhiclasses", ariaLabel: "Visit the existing Samradhi Classes website", icon: "website", iconColor: "text-indigo-500" },
  { label: "Telegram", href: "https://t.me/Samradhiclasses", ariaLabel: "Join Samradhi Classes on Telegram", icon: "telegram", iconColor: "text-sky-500" },
] as const;

const COURSE_PLANS = [
  { duration: "30 Days", price: "₹299" },
  { duration: "3 Months", price: "₹499" },
  { duration: "6 Months", price: "₹599" },
  { duration: "1 Year", price: "₹799" },
] as const;

type OfficialIcon = (typeof OFFICIAL_LINKS)[number]["icon"];

function OfficialLinkIcon({ name, className }: { name: OfficialIcon; className: string }) {
  const common = { "aria-hidden": true, focusable: false, viewBox: "0 0 24 24", className: `h-5 w-5 shrink-0 ${className}` } as const;
  if (name === "youtube") return <svg {...common} fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>;
  if (name === "instagram") return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>;
  if (name === "telegram") return <svg {...common} fill="currentColor"><path d="M22.6 2.3a1.2 1.2 0 0 0-1.2-.2L2.2 9.5c-1.3.5-1.3 1.3-.2 1.7l4.9 1.5 1.9 5.8c.2.7.1 1 .8 1 .5 0 .7-.2 1-.5l2.4-2.3 5 3.7c.9.5 1.6.3 1.8-.9l3.2-15.7c.3-.9 0-1.3-.4-1.5ZM8.2 12.4l10.7-6.8c.5-.3 1-.1.6.2l-8.8 8-.3 3.3-2.2-4.7Z"/></svg>;
  if (name === "mobile") return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 5h4M11 18h2"/></svg>;
  return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>;
}

export default async function Home() {
  const supabase = await createClient();
  const { data: liveResults } = await supabase.rpc("published_live_results", { p_limit: 20 });
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white shadow-sm"><div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6"><Link href="/" className="flex min-w-0 items-center gap-3 text-sm font-black tracking-wide text-blue-800 sm:text-base"><Image src="/samradhi-classes-logo.png" alt="Samradhi Classes logo" width={40} height={40} priority className="h-10 w-10 shrink-0 rounded-full object-contain"/><span className="hidden sm:block">SAMRADHI CLASSES</span></Link><div className="flex items-center gap-2"><Link href="/typing" className="hidden rounded-lg px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 md:block">Typing Hub</Link><details className="group relative"><summary className="cursor-pointer list-none whitespace-nowrap rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:px-4 sm:text-sm">Connect <span aria-hidden="true" className="ml-1 inline-block transition-transform group-open:rotate-180">▾</span></summary><nav aria-label="Samradhi Classes social and official links" className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-blue-100 bg-white p-2 shadow-xl">{OFFICIAL_LINKS.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.ariaLabel} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-bold text-blue-800 transition-colors hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"><OfficialLinkIcon name={link.icon} className={link.iconColor}/><span>{link.label}</span></a>)}</nav></details><AccessNavigation/></div></div></header>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-700 to-indigo-900 py-8 text-white sm:py-10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <Image src="/samradhi-classes-logo.png" alt="Samradhi Classes" width={72} height={72} priority className="mx-auto h-[72px] w-[72px] rounded-full bg-white object-contain shadow-xl ring-2 ring-white/80"/>
          <h1 className="mt-1 text-3xl font-bold sm:text-5xl">
            SAMRADHI CLASSES
          </h1>

          <p className="mt-3 text-lg font-bold sm:text-xl">
            Typing, Efficiency and Stenography Test
          </p>

          <div className="mx-auto mt-5 max-w-5xl divide-y divide-white/20 rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-blue-50 backdrop-blur-sm sm:text-base">
            <p className="py-2.5"><strong>Hindi &amp; English Typing:</strong> Kruti Dev 010, Mangal, DevLys, Remington Gail and InScript layouts.</p>
            <p className="py-2.5"><strong>All India Exams:</strong> SSC CGL/CHSL, NTPC, DSSSB, BSF, Army, KVS/NVS and Assam Rifles.</p>
            <p className="py-2.5"><strong>State Exams:</strong> RSSB LDC, RSSB IA, RHC LDC, RHC SA, RVVUNL, MP-CPCT, UPPSC, UPPCL, UP Police and BELTRON.</p>
            <p className="py-2.5"><strong>Stenography Test:</strong> SSC Steno, RSSB Steno, MP High Court, Allahabad High Court, Supreme Court, Session Courts and Judicial Assistant Exam.</p>
            <p className="py-2.5"><strong>Efficiency Test:</strong> RSSB LDC, RHC LDC, RHC SA and all other vacancies.</p>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link href="/live-test" className="bg-white text-blue-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200">
              Join Live Test
            </Link>

            <Link href="/typing" className="border border-white px-6 py-3 rounded-xl hover:bg-white hover:text-blue-700">
              Free Typing Test
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-blue-100 bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm lg:grid-cols-[1.05fr_.95fr] lg:p-9">
            <aside aria-label="Vacancy updates"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-blue-700">Samradhi updates</p><h2 className="mt-1 text-2xl font-black text-slate-950">Latest vacancies</h2></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">Sample data</span></div><VacancyCarousel vacancies={VACANCIES.filter((vacancy) => vacancy.category === "jobs")}/></aside>
            <section aria-labelledby="course-plans-title"><div className="mb-4"><p className="text-xs font-black uppercase tracking-widest text-blue-700">Choose your duration</p><h2 id="course-plans-title" className="mt-1 text-2xl font-black text-slate-950">Buy our complete course</h2><p className="mt-1 text-sm text-slate-600">Typing, efficiency and stenography preparation in one plan.</p></div><div className="grid gap-3 sm:grid-cols-2">{COURSE_PLANS.map((plan)=><article key={plan.duration} className="flex flex-col rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm"><h3 className="font-black text-slate-950">Samradhi Complete Course</h3><ul className="mt-3 flex-1 space-y-2 text-sm text-slate-600"><li className="flex gap-2"><span aria-hidden>✓</span><span>Duration: <strong>{plan.duration}</strong></span></li><li className="flex gap-2"><span aria-hidden>✓</span><span>Price: <strong>{plan.price}</strong></span></li><li className="flex gap-2"><span aria-hidden>✓</span><span>Typing, efficiency and stenography</span></li><li className="flex gap-2"><span aria-hidden>✓</span><span>Online payment available</span></li></ul><a href="tel:7014371324" className="mt-4 rounded-xl bg-blue-700 px-4 py-2.5 text-center text-sm font-black text-white hover:bg-blue-800">Buy plan</a></article>)}</div></section>
          </div>
          <VacancySections compact />
          <div className="mt-8"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-blue-700">Published automatically</p><h2 className="mt-1 text-2xl font-black">Latest live-test results</h2></div><Link href="/live-test" className="text-sm font-black text-blue-700">Open live-test centre →</Link></div><LiveResultsTicker results={(liveResults??[]) as PublicLiveResult[]}/></div>
          <StudentSuccessCarousel />
        </div>
      </section>

      {/* Courses */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center">
            Our Courses
          </h2>

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="shadow-lg rounded-2xl p-6">
              <h3 className="text-2xl font-bold">
                Hindi & English Typing
              </h3>

              <p className="mt-3">
                Learn English typing, Kruti Dev and Unicode Hindi with speed and accuracy.
              </p>
            </div>

            <div className="shadow-lg rounded-2xl p-6">
              <h3 className="text-2xl font-bold">
                Efficiency
              </h3>

              <p className="mt-3">
                Build practical computer efficiency skills for competitive examinations.
              </p>
            </div>

            <div className="shadow-lg rounded-2xl p-6">
              <h3 className="text-2xl font-bold">
                Stenography
              </h3>

              <p className="mt-3">
                Complete shorthand and transcription training.
              </p>
            </div>
          </div>
        </div>
      </section>
      <footer className="border-t border-blue-100 bg-blue-950 px-6 py-8 text-white">
        <div className="mx-auto grid max-w-7xl gap-6 text-center md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-center md:text-left">
          <div><p className="font-black tracking-wide">SAMRADHI CLASSES</p><p className="mt-1 text-sm text-blue-200">Typing, stenography and competitive-exam preparation.</p></div>
          <nav aria-label="Official links"><p className="text-xs font-bold uppercase tracking-widest text-blue-300">Official links</p><div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-end">{OFFICIAL_LINKS.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.ariaLabel} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-400 bg-white px-3 py-2 text-sm font-bold text-blue-950 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><OfficialLinkIcon name={link.icon} className={link.iconColor}/><span>{link.label}</span></a>)}</div></nav>
        </div>
      </footer>
    </main>
  );
}

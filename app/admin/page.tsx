import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { requireAdmin } from "@/lib/auth";

const groups = [
  {
    heading: "People & results",
    description: "Everything about who is testing and how they're doing.",
    items: [
      ["/admin/students", "Students", "See every student's profile, contact details, test results, and access controls; unblock sign-in issues.", "People →"],
      ["/admin/track", "Track", "Live daily activity tracker: who tested today, scores, validity, and access status at a glance.", "Activity →"],
      ["/admin/recovery-requests", "Account Recovery Requests", "Review students locked out of both email and phone; confirm identity yourself, then approve or reject.", "Review →"],
    ],
  },
  {
    heading: "Homepage",
    description: "Everything a visitor sees on the homepage before logging in.",
    items: [
      ["/admin/homepage", "Homepage Content", "Course packages and pricing, latest jobs/admit-card/result notices, official websites, and student feedback moderation.", "Manage →"],
    ],
  },
  {
    heading: "Classroom",
    description: "Announcements and the live class link students see once logged in.",
    items: [
      ["/admin/classroom", "Classroom", "Post updates for students and turn the live class link on or off.", "Manage →"],
    ],
  },
  {
    heading: "Live tests",
    description: "Scheduled, free live tests -- each of these creates a test with a fixed start/end/results window that shows up on the public Live Test hub, so there's no generic mode selector or checkbox to hunt for.",
    items: [
      ["/admin/live-typing-tests", "Live Typing Test", "Create a scheduled live typing test -- optionally pick one of the 25 exam-category presets to auto-fill speed, duration and backspace, or set everything by hand.", "Manage →"],
      ["/admin/live-stenography-tests", "Live Stenography Test", "Create a scheduled live stenography test -- optionally pick one of the researched stenography-category presets, or set dictation speed and accuracy by hand.", "Manage →"],
      ["/admin/live-efficiency-tests", "Live Efficiency Test", "Create a scheduled live Word or Excel Efficiency test.", "Manage →"],
    ],
  },
  {
    heading: "Typing & exams",
    description: "Learning content, practice tests, exam-mode simulations, and live scheduled tests all use the same test engine.",
    items: [
      ["/admin/learning-tests", "Learning Tests", "Create public learning lessons.", "Manage →"],
      ["/admin/krutidev-lessons", "Kruti Dev Typing Tutor", "Edit the key drills, word sets and paragraphs in the Kruti Dev learn simulator.", "Manage →"],
      ["/admin/english-lessons", "English Typing Tutor", "Edit the key drills, word sets and paragraphs in the English learn simulator.", "Manage →"],
      ["/admin/practice-tests", "Practice Tests", "Create practice-mode tests.", "Manage →"],
      ["/admin/exam-tests", "Exam Tests", "Create exam-mode simulations, including the Exam Simulator category presets.", "Manage →"],
      ["/admin/tests", "General Test Management & Live Tests", "Manage any test with an explicit mode selector, including scheduling free live tests.", "Manage →"],
    ],
  },
  {
    heading: "Games",
    description: "Word banks for the WordTris falling-word typing game.",
    items: [
      ["/admin/wordtris-words", "WordTris Word Banks", "Add or edit the words students catch, per category and language.", "Manage →"],
    ],
  },
  {
    heading: "Stenography",
    description: "Dictation and transcription tests, including the Stenography Exam Simulator categories.",
    items: [
      ["/admin/stenography-tests", "Stenography Tests", "Create stenography-mode tests.", "Manage →"],
    ],
  },
  {
    heading: "Efficiency",
    description: "Document and spreadsheet productivity tests with automatic and manual grading.",
    items: [
      ["/admin/word-efficiency-tests", "Word Efficiency Tests", "Manage document-efficiency questions, instructions, private PDFs, and grading.", "Manage →"],
      ["/admin/excel-efficiency-tests", "Excel Efficiency Tests", "Upload the starting spreadsheet, author questions and grading rules, and grade attempts.", "Manage →"],
    ],
  },
  {
    heading: "Tools",
    description: "Utilities that support test authoring.",
    items: [
      ["/admin/font-converter", "Font & Text Converter", "Convert locally between Unicode Hindi and Kruti Dev 010.", "Open →"],
      ["/admin/preview/english-tutor", "Preview: English Typing Tutor", "See exactly what a student sees -- an admin session normally gets redirected away from every /typing page.", "Preview →"],
      ["/admin/preview/krutidev-tutor", "Preview: Kruti Dev Typing Tutor", "See exactly what a student sees -- an admin session normally gets redirected away from every /typing page.", "Preview →"],
      ["/admin/preview/wordtris", "Preview: WordTris", "See exactly what a student sees -- an admin session normally gets redirected away from every /typing page.", "Preview →"],
    ],
  },
] as const;

export default async function AdminPage() {
  const { user, profile } = await requireAdmin();
  return <main className="min-h-screen bg-slate-100 p-6"><div className="mx-auto max-w-6xl"><header className="flex items-center justify-between rounded-2xl bg-slate-900 p-6 text-white shadow"><div><p className="text-sm font-semibold text-blue-300">SAMRADHI CLASSES</p><h1 className="text-2xl font-bold">Admin panel</h1><p className="mt-1 text-slate-300">{profile?.full_name || user.email}</p></div><form action={signOut}><button className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-800">Sign out</button></form></header>
    {groups.map((group) => (
      <section key={group.heading} className="mt-8">
        <h2 className="text-lg font-black uppercase tracking-wide text-slate-500">{group.heading}</h2>
        <p className="mt-1 text-sm text-slate-500">{group.description}</p>
        <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {group.items.map(([href, title, text, cta]) => (
            <Link key={href} href={href} className="rounded-2xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-lg">
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              <span className="mt-5 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">{cta}</span>
            </Link>
          ))}
        </div>
      </section>
    ))}
  </div></main>;
}

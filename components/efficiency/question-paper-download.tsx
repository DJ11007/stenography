// On a test's Instructions page when the admin has turned its question paper on: opens the printable paper.
export function QuestionPaperDownload({ href, hindi }: { href: string; hindi: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <div>
        <h2 className="font-black text-violet-950">Question paper</h2>
        <p className="mt-0.5 text-sm text-violet-900">{hindi ? "प्रश्न पत्र डाउनलोड करें और अभ्यास के लिए प्रिंट करें। " : ""}Download or print all the questions of this test. It does not start the timer.</p>
      </div>
      <a href={href} target="_blank" rel="noopener" className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white hover:bg-violet-600">Download question paper</a>
    </div>
  );
}

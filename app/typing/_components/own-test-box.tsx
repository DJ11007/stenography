import Link from "next/link";
import { UploadMatterButton } from "./upload-matter-modal";

// "Practise your own test": a student uploads their own passage (and, for stenography, their own dictation audio)
// and practises it with the same exam screen and result analysis. Uses the existing "My Matters" feature
// (upload-matter-modal.tsx, /typing/my-matters); saved on the student's own device.
export function OwnTestBox({ mode }: { mode: "exam" | "stenography" }) {
  const steno = mode === "stenography";
  return (
    <section className="mt-10 overflow-hidden rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50/70 p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-5">
        <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white">⇪</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Your own test</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">{steno ? "Practise your own dictation" : "Practise your own passage"}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {steno
              ? "Have a passage and its dictation audio from your class or a book? Upload them and practise transcription with the same exam screen and full result analysis."
              : "Have a passage from your class, a book or a previous paper? Paste or upload it and practise it with the real exam screen, timer and full result analysis."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <UploadMatterButton defaultMode={mode} label={steno ? "⇪ Upload my dictation" : "⇪ Upload my test"} />
          <Link href="/typing/my-matters" className="rounded-xl border-2 border-emerald-600 px-5 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-100">My uploaded tests →</Link>
        </div>
      </div>
    </section>
  );
}

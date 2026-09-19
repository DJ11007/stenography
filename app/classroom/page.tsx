import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth";
import { getPublishedClassroomUpdates, getLiveClassLink } from "@/lib/classroom-server";
import { TypingBrandHeader } from "../typing/_components/typing-brand";
import { formatIST } from "@/lib/format-datetime";

export const metadata: Metadata = { title: "Classroom | Samradhi Classes" };

export default async function ClassroomPage() {
  await requireStudent();
  const [updates, liveClass] = await Promise.all([getPublishedClassroomUpdates(20), getLiveClassLink()]);
  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader backHref="/typing" backLabel="Typing Hub" />
      <section className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mt-5 text-3xl font-black">Classroom</h1>
        <p className="mt-2 text-slate-600">Guidance, updates, and live class from Samradhi Classes.</p>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 p-5">
          <div>
            <h2 className="font-black text-green-900">Live Class</h2>
            <p className="mt-1 text-sm text-green-800">{liveClass.isActive ? "A live class link is available now." : "No live class is scheduled right now."}</p>
          </div>
          {liveClass.isActive && liveClass.url ? (
            <a href={liveClass.url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-green-600 px-5 py-3 font-black text-white hover:bg-green-700">Join Live Class</a>
          ) : (
            <span aria-disabled="true" className="cursor-not-allowed rounded-xl bg-slate-200 px-5 py-3 font-black text-slate-500">Join Live Class</span>
          )}
        </div>

        <h2 className="mt-8 text-xl font-black text-slate-950">Updates</h2>
        <div className="mt-4 grid gap-3">
          {updates.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No updates found.</p>}
          {updates.map((update) => (
            <article key={update.id} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <h3 className="font-black text-blue-900">{update.title}</h3>
              {update.body && <p className="mt-2 text-sm leading-6 text-slate-700">{update.body}</p>}
              <p className="mt-2 text-xs text-slate-400">{formatIST(update.createdAt)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

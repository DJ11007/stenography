import type { Metadata } from "next";
import { TypingBrandHeader } from "../../../../_components/typing-brand";
import { BackButton } from "../../../../../_components/back-button";
import { getPublishedStenographyTasks } from "@/lib/stenography-task-library-server";
import { StenographyTaskLibraryView } from "../_components/task-library-view";

export const metadata: Metadata = { title: "Hindi Stenography Task Library | Samradhi Classes" };

export default async function HindiStenographyLibraryPage() {
  const tasks = await getPublishedStenographyTasks("Hindi");
  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader />
      <section className="mx-auto max-w-5xl px-4 py-10">
        <BackButton href="/typing/practice/stenography/library" label="Choose Language" />
        <h1 className="mt-5 text-3xl font-black">हिंदी Stenography — Task Library</h1>
        <StenographyTaskLibraryView tasks={tasks} />
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import { TypingBrandHeader } from "../../../../_components/typing-brand";
import { getPublishedStenographyTasks } from "@/lib/stenography-task-library-server";
import { StenographyTaskLibraryView } from "../_components/task-library-view";

export const metadata: Metadata = { title: "English Stenography Task Library | Samradhi Classes" };

export default async function EnglishStenographyLibraryPage() {
  const tasks = await getPublishedStenographyTasks("English");
  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader backHref="/typing/practice/stenography/library" backLabel="Choose Language" />
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mt-5 text-3xl font-black">English Stenography — Task Library</h1>
        <StenographyTaskLibraryView tasks={tasks} />
      </section>
    </main>
  );
}

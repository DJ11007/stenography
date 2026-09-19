import { getPublishedManagedTests } from "@/lib/managed-test-catalogue-server";
import { ManagedTestCards } from "../_components/managed-test-cards";
import { TypingBrandHeader } from "../_components/typing-brand";

export default async function StenographyCataloguePage() {
  const tests = await getPublishedManagedTests("stenography");
  return <main className="min-h-screen bg-slate-100"><TypingBrandHeader backHref="/typing" backLabel="Typing Hub"/><section className="mx-auto max-w-7xl px-4 py-10"><h1 className="mt-5 text-4xl font-black">Stenography Tests</h1><p className="mt-2 text-slate-600">Only published stenography-mode tests appear here.</p><div className="mt-8"><ManagedTestCards tests={tests} empty/></div></section></main>;
}

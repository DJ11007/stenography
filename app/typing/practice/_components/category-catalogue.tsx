import type { Metadata } from "next";
import Link from "next/link";
import type { ManagedTestMode } from "@/lib/admin-tests";
import { hindiInputSystemsFor } from "@/lib/typing-curriculum";
import { getPublishedManagedTests } from "@/lib/managed-test-catalogue-server";
import { ManagedTestCards } from "../../_components/managed-test-cards";
import { TypingBrandHeader } from "../../_components/typing-brand";

export const practiceMetadata = (title:string, description:string):Metadata => ({ title:`${title} | Samradhi Classes`, description });

// Every distinct Hindi input system this mode could possibly show: the
// configured set (lib/typing-curriculum.ts) plus any input_system_id a
// published test already uses, in case one was set up outside that
// config. Shared between HindiCatalogue (which renders the picker from
// exactly this list) and each Hindi practice/stenography page (which uses
// its length to decide whether a picker is even worth showing) so the two
// can never drift apart.
export async function hindiInputSystemIds(mode: ManagedTestMode): Promise<string[]> {
  const availableTests = await getPublishedManagedTests(mode, { language: "Hindi" });
  const hindiInputSystems = hindiInputSystemsFor(mode);
  return [...new Set([...hindiInputSystems.map((system) => system.id), ...availableTests.map((test) => test.input_system_id)])];
}

export async function ExactCatalogue({ title, description, mode, language, inputSystemId }: { title:string; description:string; mode:ManagedTestMode; language:"English"|"Hindi"; inputSystemId?:string }) {
  const tests = await getPublishedManagedTests(mode, { language, inputSystemId });
  return <CatalogueShell title={title} description={description}><ManagedTestCards tests={tests} empty/></CatalogueShell>;
}

export async function HindiCatalogue({ title, description, mode, selectedInput }: { title:string; description:string; mode:ManagedTestMode; selectedInput?:string }) {
  const hindiInputSystems = hindiInputSystemsFor(mode);
  const known = new Map(hindiInputSystems.map((system)=>[system.id,system]));
  const ids = await hindiInputSystemIds(mode);
  const selected = selectedInput && ids.includes(selectedInput) ? selectedInput : undefined;
  const tests = selected ? await getPublishedManagedTests(mode, { language:"Hindi", inputSystemId:selected }) : [];
  // Not /typing/practice -- that page offers both English and Hindi, which
  // would undo the language choice already made just by being on this page
  // (same class of bug fixed for the practice picker's own Back button).
  return <CatalogueShell title={title} description={description} backHref="/typing" backLabel="Typing Hub"><section className="rounded-3xl bg-white p-6 shadow"><h2 className="text-xl font-black">Choose keyboard and font</h2><p className="mt-2 text-sm text-slate-600">Only tests configured for your selection will be shown.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ids.map((id)=>{const system=known.get(id);return <Link key={id} href={`?input=${encodeURIComponent(id)}`} className={`rounded-2xl border p-4 transition ${selected===id?"border-orange-500 bg-orange-50 shadow":"border-slate-200 hover:border-orange-300"}`}><strong className="block">{system?.label ?? humanize(id)}</strong><span className="mt-1 block text-xs text-slate-500">{system?.keyboardLayout ?? "Administrator-configured Hindi input system"}</span></Link>})}</div>{selected?.includes("krutidev")&&<p role="alert" className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">Kruti Dev 010 is a legacy font. Install the licensed Kruti Dev 010 font on this device before starting; otherwise the passage may not display correctly.</p>}</section><section className="mt-8"><h2 className="mb-5 text-2xl font-black">{selected ? `Compatible ${title} tests` : "Select an input system to view tests"}</h2>{selected&&<ManagedTestCards tests={tests} empty/>}</section></CatalogueShell>;
}

export function ComingSoon({ title, description, accent }: { title:string; description:string; accent:string }) { return <CatalogueShell title={title} description={description}><section className={`overflow-hidden rounded-3xl bg-gradient-to-br ${accent} p-8 text-white shadow-xl sm:p-12`}><span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-widest">Coming Soon</span><h2 className="mt-6 text-3xl font-black">A focused training workspace is being prepared.</h2><p className="mt-4 max-w-2xl leading-7 text-white/85">The catalogue route is ready for future administrator-created exercises. Until the interactive module launches, this page will remain a clear, working destination.</p><Link href="/typing/practice" className="mt-8 inline-flex rounded-xl bg-white px-5 py-3 font-black text-slate-900">Back to Practice Categories</Link></section></CatalogueShell>; }

function CatalogueShell({title,description,children,backHref="/typing/practice",backLabel="Practice Categories"}:{title:string;description:string;children:React.ReactNode;backHref?:string;backLabel?:string}) { return <main className="min-h-screen bg-slate-100"><TypingBrandHeader backHref={backHref} backLabel={backLabel}/><section className="mx-auto max-w-7xl px-4 py-10"><h1 className="mt-6 text-4xl font-black">{title}</h1><p className="mt-3 max-w-3xl text-slate-600">{description}</p><div className="mt-8">{children}</div></section></main>; }
function humanize(id:string) { return id.split("-").filter(Boolean).map((part)=>part[0]?.toUpperCase()+part.slice(1)).join(" "); }

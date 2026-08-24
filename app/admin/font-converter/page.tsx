import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { FontConverter } from "./font-converter";

export const metadata = { title: "Font & Text Converter | Admin" };
export default async function FontConverterPage(){await requireAdmin();return <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6"><div className="mx-auto max-w-[1500px]"><Link href="/admin" className="text-sm font-black text-violet-700">← Admin dashboard</Link><header className="mt-4 rounded-3xl bg-gradient-to-r from-slate-950 to-violet-900 p-7 text-white shadow"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Local administrator tool</p><h1 className="mt-2 text-3xl font-black">Font & Text Converter</h1><p className="mt-2 max-w-3xl text-slate-300">Convert locally between normalized Unicode Hindi (displayed with Mangal/Nirmala UI) and legacy Kruti Dev 010 text. Nothing is transmitted to a third party.</p></header><div className="mt-6"><FontConverter/></div></div></main>}

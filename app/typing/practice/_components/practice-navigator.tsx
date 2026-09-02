import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { managedVersionToPreset, type ManagedTestVersion } from "@/lib/admin-tests";
import { getPracticeSelector } from "@/lib/practice-navigator-server";
import { resolvePracticeSelection } from "@/lib/practice-navigator";
import { ConfigurableTypingExam, type PracticeNavigation } from "../../_components/configurable-typing-exam";
import { TypingBrandHeader } from "../../_components/typing-brand";
import { FreePracticeLimitPaywall } from "./free-limit-paywall";

type Params = { input?: string; test?: string; sort?: string };

export async function PracticeNavigator({ mode = "practice", language, params, requireInput = false }: { mode?: "practice" | "stenography"; language: "English" | "Hindi"; params: Params; requireInput?: boolean }) {
  const inputSystemId = params.input || undefined;
  if (requireInput && !inputSystemId) return null;

  const supabase = await createClient();
  // "Take Tests" (plain typing practice, this mode) has a free-attempt
  // cap -- stenography practice (the other mode this component serves)
  // is untouched. Checked before anything else so a blocked student never
  // even sees which tests exist, and doesn't burn a query resolving one.
  if (mode === "practice") {
    const { data: freeStatus } = await supabase.rpc("practice_test_free_status").single() as { data: { used_count: number; free_limit: number | null; remaining: number | null; blocked: boolean } | null };
    if (freeStatus?.blocked) return <FreePracticeLimitPaywall used={freeStatus.used_count} limit={freeStatus.free_limit ?? 0} />;
  }

  const sort = params.sort === "oldest" ? "oldest" : "newest";
  const items = await getPracticeSelector({ mode, language, inputSystemId, sort });
  const { selectedIndex, selected } = resolvePracticeSelection(items, params.test);

  if (!selected) return <main className="min-h-screen bg-slate-100"><TypingBrandHeader/><section className="mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center"><div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xl sm:p-12"><span className="text-5xl" aria-hidden>⌨</span><h1 className="mt-5 text-3xl font-black text-slate-900">No compatible tests yet</h1><p className="mx-auto mt-3 max-w-xl text-slate-600">No compatible published {language.toLowerCase()} {mode} tests are currently available.</p><Link href="/typing/practice" className="mt-7 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-black text-white">Back to Practice Categories</Link></div></section></main>;

  const queryFor = (slug: string, forSort: "newest" | "oldest" = sort) => {
    const query = new URLSearchParams();
    if (inputSystemId) query.set("input", inputSystemId);
    query.set("test", slug);
    if (forSort === "oldest") query.set("sort", "oldest");
    return `?${query}`;
  };

  if (params.test !== selected.slug) redirect(queryFor(selected.slug));

  // items is already ordered by the active sort, so its own first/last
  // entries tell us where "Newest"/"Oldest" should jump to without a
  // second query -- whichever end holds the newest test depends on which
  // direction is currently active.
  const newestSlug = sort === "newest" ? items[0].slug : items[items.length - 1].slug;
  const oldestSlug = sort === "newest" ? items[items.length - 1].slug : items[0].slug;

  const navigation: PracticeNavigation = {
    currentIndex: selectedIndex,
    total: items.length,
    items: items.map((item, index) => ({ title: item.title, href: queryFor(item.slug), label: `Test ${index + 1} of ${items.length}` })),
    previousHref: selectedIndex > 0 ? queryFor(items[selectedIndex - 1].slug) : null,
    nextHref: selectedIndex < items.length - 1 ? queryFor(items[selectedIndex + 1].slug) : null,
    sort,
    newestHref: queryFor(newestSlug, "newest"),
    oldestHref: queryFor(oldestSlug, "oldest"),
  };

  let selectedTestQuery = supabase.from("tests").select("id,slug,current_version_id").eq("id", selected.id).eq("mode", mode).eq("language", language).eq("status", "published").eq("visibility", "public").eq("is_live", false);
  if (inputSystemId) selectedTestQuery = selectedTestQuery.eq("input_system_id", inputSystemId);
  const { data: test } = await selectedTestQuery.maybeSingle();
  const { data: versionRow } = test?.current_version_id ? await supabase.from("test_versions").select("*").eq("id", test.current_version_id).eq("test_id", test.id).maybeSingle() : { data: null };
  if (!test || !versionRow) return null;

  const configuration = versionRow.configuration as Record<string,unknown>|null;
  const version: ManagedTestVersion = { id:versionRow.id, testId:versionRow.test_id, versionNumber:versionRow.version_number, title:versionRow.title, description:versionRow.description ?? "", slug:test.slug, language:versionRow.language, inputSystemId:versionRow.input_system_id, mode:versionRow.mode, durationSeconds:versionRow.duration_seconds, passage:versionRow.passage, requiredWpm:Number(versionRow.required_wpm), requiredAccuracy:Number(versionRow.required_accuracy), backspaceMode:versionRow.backspace_mode, wordMethod:versionRow.word_method, highlightMode:versionRow.highlight_mode, visibility:versionRow.visibility, audioPath:configuration?.audio_path as string|null ?? null, pdfPath:configuration?.pdf_path as string|null ?? null, pdfFileName:configuration?.pdf_file_name as string|null ?? null, dictationCategories:configuration?.dictation_categories as ManagedTestVersion["dictationCategories"] ?? null };
  const preset = managedVersionToPreset(version);
  if (version.audioPath) { const { data: signed } = await supabase.storage.from("stenography-audio").createSignedUrl(version.audioPath, 3600); preset.audioUrl = signed?.signedUrl ?? null; }
  if (version.pdfPath) { const { data: signed } = await supabase.storage.from("managed-test-pdfs").createSignedUrl(version.pdfPath, 3600); preset.pdfUrl = signed?.signedUrl ?? null; }
  return <ConfigurableTypingExam preset={preset} mode="practice" customPreset directWorkspace managedTest={{ testId:test.id, versionId:versionRow.id, mode:version.mode }} practiceNavigation={navigation}/>;
}

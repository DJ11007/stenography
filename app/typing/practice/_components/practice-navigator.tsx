import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { managedVersionToPreset, type ManagedTestVersion } from "@/lib/admin-tests";
import { getPracticeSelector } from "@/lib/practice-navigator-server";
import { resolvePracticeSelection } from "@/lib/practice-navigator";
import { ConfigurableTypingExam, type PracticeNavigation } from "../../_components/configurable-typing-exam";
import { TypingBrandHeader } from "../../_components/typing-brand";
import { BackButton } from "../../../_components/back-button";
import { FreePracticeLimitPaywall } from "./free-limit-paywall";

type Params = { input?: string; test?: string; sort?: string };

// The picker's badge should identify the test itself (e.g. "TEST - 4" -> 4),
// not just its position in the current sort order -- otherwise switching
// Newest/Oldest re-numbers every card and a title's own number stops
// matching the badge next to it. Falls back to position only when a title
// carries no number at all.
function serialFor(title: string, fallbackPosition: number): number {
  const match = title.match(/(\d+)(?!.*\d)/);
  return match ? Number(match[1]) : fallbackPosition;
}

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

  // Oldest-first by default, across every "Take Tests" section (English,
  // Hindi, both plain practice and stenography) -- students expect test
  // catalogues to run in the order they were actually published, not
  // newest-first.
  const sort = params.sort === "newest" ? "newest" : "oldest";
  const items = await getPracticeSelector({ mode, language, inputSystemId, sort });

  if (!items.length) return <main className="min-h-screen bg-slate-100"><TypingBrandHeader/><section className="mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center"><div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xl sm:p-12"><span className="text-5xl" aria-hidden>⌨</span><h1 className="mt-5 text-3xl font-black text-slate-900">No compatible tests yet</h1><p className="mx-auto mt-3 max-w-xl text-slate-600">No compatible published {language.toLowerCase()} {mode} tests are currently available.</p><Link href="/typing/practice" className="mt-7 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-black text-white">Back to Practice Categories</Link></div></section></main>;

  const queryFor = (slug: string, forSort: "newest" | "oldest" = sort) => {
    const query = new URLSearchParams();
    if (inputSystemId) query.set("input", inputSystemId);
    query.set("test", slug);
    if (forSort === "newest") query.set("sort", "newest");
    return `?${query}`;
  };

  // No specific test requested (this is the actual landing page for "Take
  // Tests", and where the in-workspace Back button now points) -- show a
  // real, language-scoped list to choose from instead of silently jumping
  // straight into one test. Jumping straight in used to make Back look
  // broken: it always landed on the newest test, which is usually the
  // exact test the student was already looking at, so nothing appeared to
  // change.
  if (!params.test) {
    const sortHref = (targetSort: "newest" | "oldest") => {
      const query = new URLSearchParams();
      if (inputSystemId) query.set("input", inputSystemId);
      if (targetSort === "newest") query.set("sort", "newest");
      const qs = query.toString();
      return qs ? `?${qs}` : "?";
    };
    return (
      <main className="min-h-screen bg-slate-100">
        <TypingBrandHeader />
        <section className="mx-auto max-w-5xl px-4 py-10">
          {/* Not /typing/practice -- that page offers both English and Hindi,
              which would undo the language choice this picker already made
              (the same class of bug as the in-workspace Back button fix
              above). The Typing Hub names no language at all. */}
          <BackButton href="/typing" label="Typing Hub" />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-blue-700">{language} · {mode === "stenography" ? "Stenography" : "Take Tests"}</p>
              <h1 className="mt-1 text-3xl font-black text-slate-900">Choose a test</h1>
            </div>
            <div className="flex overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-bold" role="group" aria-label="Sort tests">
              <Link href={sortHref("newest")} aria-pressed={sort === "newest"} className={`px-4 py-1.5 ${sort === "newest" ? "bg-blue-700 text-white" : "text-slate-600"}`}>Newest</Link>
              <Link href={sortHref("oldest")} aria-pressed={sort === "oldest"} className={`px-4 py-1.5 ${sort === "oldest" ? "bg-blue-700 text-white" : "text-slate-600"}`}>Oldest</Link>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <Link key={item.id} href={queryFor(item.slug)} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-sm font-black text-white">{serialFor(item.title, item.index)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-slate-800">{item.title}</span>
                  <span className="block text-xs text-slate-600">{Math.max(1, Math.round(item.durationSeconds / 60))} min</span>
                </span>
                <span aria-hidden="true" className="text-xl font-black text-slate-300">→</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    );
  }

  const { selectedIndex, selected } = resolvePracticeSelection(items, params.test);
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
  // Scoped to the language (and stenography-ness) the student actually
  // came from -- not the unscoped /typing/practice picker, which would ask
  // them to choose English or Hindi all over again (the same bug already
  // fixed for the "Take Tests" hub card itself; this is the in-workspace
  // Back button, and it serves both plain practice and stenography).
  const backHref = `/typing/practice/${language === "Hindi" ? "hindi" : "english"}${mode === "stenography" ? "-stenography" : ""}`;
  return <ConfigurableTypingExam preset={preset} mode="practice" customPreset directWorkspace managedTest={{ testId:test.id, versionId:versionRow.id, mode:version.mode }} practiceNavigation={navigation} backHref={backHref}/>;
}

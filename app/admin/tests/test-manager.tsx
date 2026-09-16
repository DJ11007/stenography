"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { MANAGED_INPUT_SYSTEMS, countPassageWords, type ManagedTestMode, type ManagedTestStatus } from "@/lib/admin-tests";
import { hindiInputSystemsFor } from "@/lib/typing-curriculum";
import { EXAM_CATEGORIES } from "@/lib/exam-categories";
import { STENOGRAPHY_CATEGORIES } from "@/lib/stenography-categories";
import { STENOGRAPHY_TASK_CATEGORIES } from "@/lib/stenography-task-library";
import { sortExamCategoryNavigatorItems } from "@/lib/exam-category-navigator";
import { ALL_HALF_ERROR_CATEGORIES, HALF_ERROR_CATEGORY_LABELS, type HalfErrorCategory } from "@/lib/typing-test";
import { encodingValidationMessage, type HindiTextFormat } from "@/lib/hindi-font-converter";
import { FontConverter } from "@/app/admin/font-converter/font-converter";
import { deleteManagedTest, duplicateManagedTest, saveExamManagedTest, saveLearningManagedTest, saveLiveExamManagedTest, saveLiveStenographyManagedTest, saveManagedTest, savePracticeManagedTest, saveStenographyManagedTest, setManagedTestStatus, type TestFormState } from "./actions";
import { PermanentDeleteDangerZone } from "./permanent-delete-danger-zone";

type Version = { id:string; description:string|null; language:"English"|"Hindi"; mode:ManagedTestMode; input_system_id:string; duration_seconds:number; passage:string; required_wpm:number; required_accuracy:number; backspace_mode:string; word_method:string; highlight_mode:string; visibility:"public"|"private"; passage_characters:number; passage_words:number; configuration?:Record<string,unknown>|null };
export type ManagedTestRow = { id:string; title:string; slug:string; description:string|null; language:string|null; status:ManagedTestStatus; mode:ManagedTestMode; input_system_id:string; visibility:"public"|"private"; duration_seconds:number|null; current_version_id:string|null; current_version_number:number; updated_at:string; is_live:boolean; live_starts_at:string|null; live_ends_at:string|null; results_publish_at:string|null; results_delay_minutes:number|null; currentVersion:Version|null; attempts:number; created_by?:string|null; created_at?:string|null; creatorName?:string|null };
const initialState: TestFormState = {};
const localDateTime = (value:string|null|undefined) => value ? new Date(value).toISOString().slice(0,16) : "";
// Real reported bug: a datetime-local input's own native picker renders as
// a 24-hour clock with no AM/PM indicator at all on some browsers/OS
// locales (Windows Chrome, at least) -- there is nothing in the field
// itself telling the admin that a PM time needs 12 added to the hour, so
// "1:11 PM" typed as "01:11" silently becomes 1:11 AM with no warning,
// exactly what happened live. This can't be fixed by styling the native
// input (its internal rendering isn't ours to control), so instead every
// datetime-local field pairs with this always-visible, unambiguous
// readout -- both the 12-hour AM/PM time and the full date -- computed
// from the exact same value the admin just typed, so a wrong AM/PM (or a
// wrong day) is obvious before saving rather than only after students
// start hitting it.
const scheduleReadout = (value:string) => { if(!value) return ""; const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-IN",{weekday:"short",year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:true}); };
// Admin's own Duration field, as a stepped 10-70 (10-minute steps) picker
// instead of a free-form number -- matches validateManagedTest's 1-70
// minute range (lib/admin-tests.ts) at the upper end, and keeps saved
// durations to the same handful of round numbers PRACTICE_DURATION_MINUTES
// offers students elsewhere, rather than an admin being able to type an
// arbitrary value like 37.
const ADMIN_DURATION_MINUTES = [10,20,30,40,50,60,70];
// Picks a sane starting input system for a language + mode -- used when a
// section locks the language (e.g. Stenography's English/Hindi split) but
// leaves the input system itself free, so a fresh Hindi form doesn't start
// on "english-qwerty" (invalid for that language) before the admin touches
// the Input system field.
function defaultInputSystemFor(language:"English"|"Hindi", mode:ManagedTestMode) {
  const hindiIds = new Set(hindiInputSystemsFor(mode).map((system)=>system.id));
  const candidate = MANAGED_INPUT_SYSTEMS.find((system)=>system.language===language && (language!=="Hindi"||hindiIds.has(system.id)));
  return candidate?.id ?? "english-qwerty";
}

export default function TestManager({ tests, lockedMode, lockedLive=false, lockedLanguage, lockedInputSystemId, learningOnly:legacyLearningOnly=false, currentAdminId }: { tests:ManagedTestRow[]; lockedMode?:ManagedTestMode; lockedLive?:boolean; lockedLanguage?:"English"|"Hindi"; lockedInputSystemId?:string; learningOnly?:boolean; currentAdminId?:string }) {
  const effectiveMode = lockedMode ?? (legacyLearningOnly ? "learn" : undefined);
  const learningOnly = effectiveMode === "learn";
  const saveAction = lockedLive && effectiveMode === "exam" ? saveLiveExamManagedTest : lockedLive && effectiveMode === "stenography" ? saveLiveStenographyManagedTest
    : effectiveMode === "learn" ? saveLearningManagedTest : effectiveMode === "practice" ? savePracticeManagedTest : effectiveMode === "exam" ? saveExamManagedTest : effectiveMode === "stenography" ? saveStenographyManagedTest : saveManagedTest;
  const [editing,setEditing] = useState<ManagedTestRow|null>(null);
  const [preview,setPreview] = useState(false);
  const [query,setQuery] = useState("");
  const [status,setStatus] = useState("all");
  // Two separate filters, not one combined dropdown -- "Hindi" (a language)
  // and "Hindi Unicode"/"Kruti Dev" (encodings) sitting in the same flat
  // list as "learn"/"practice"/"exam" (modes) made it unclear which kind of
  // thing you were even filtering by. filterLanguage/filterMode are
  // deliberately NOT named language/setLanguage -- that pair already exists
  // above for the create/edit form's own Language field.
  const [filterLanguage,setFilterLanguage] = useState("all");
  const [filterMode,setFilterMode] = useState(effectiveMode ?? "all");
  // "Public"/"Personal": every test is visible to every admin either way
  // (there's no private test bank) -- this just narrows the list to tests
  // this admin account created, for whoever manages a lot of content and
  // wants to find their own uploads quickly. Only shown at all once we
  // actually know who "mine" is.
  const [ownership,setOwnership] = useState<"all"|"mine">("all");
  // Real reported request: the admin list defaulted to "Recently updated",
  // so a title like "TEST - 8" published before "TEST - 6" showed out of
  // series. "serial" is the default now -- same numbered-title sort already
  // used for the student-facing exam category navigator -- so the list
  // reads 1, 2, 3... regardless of save order; the other sorts remain
  // available for when that's what's actually wanted.
  const [sort,setSort] = useState("serial");
  // How many rows show per page, and which page -- the admin asked for
  // this explicitly (previously every matching test rendered in one long
  // list with no count or paging at all). 20/30 are the two sizes
  // requested; page resets to 1 whenever the filtered set could change
  // shape under it, so you never land on a page that's gone empty.
  const [pageSize,setPageSize] = useState(20);
  const [page,setPage] = useState(1);
  const [passage,setPassage] = useState("");
  const [language,setLanguage] = useState<"English"|"Hindi">(lockedLanguage ?? "English");
  const [inputSystem,setInputSystem] = useState(lockedInputSystemId ?? defaultInputSystemFor(lockedLanguage ?? "English", effectiveMode ?? "practice"));
  const [formMode,setFormMode] = useState<ManagedTestMode>(effectiveMode ?? "practice");
  const [isLive,setIsLive] = useState(lockedLive);
  // Which of the 25 hardcoded exam categories (lib/exam-categories.ts) this
  // exam-mode test belongs to -- required for a non-live exam test, unused
  // otherwise. Once chosen, its own researched speed/duration/backspace
  // pattern is what actually gets saved (see actions.ts's parseDraft).
  const [examCategorySlug,setExamCategorySlug] = useState("");
  // Which of the 20 researched stenography categories (lib/stenography-
  // categories.ts) this stenography-mode test belongs to -- required for a
  // non-live stenography test, unused otherwise. Mirrors examCategorySlug
  // above, but the force is partial: see stenographyCategoryTypingRules.
  const [stenoCategorySlug,setStenoCategorySlug] = useState("");
  const [converterOpen,setConverterOpen] = useState(false);
  const [showRawPassage,setShowRawPassage] = useState(false);
  const [krutiFontReady,setKrutiFontReady] = useState(true);
  // Which dictation-phase mistake categories the student's pre-typing
  // checklist offers for this test, and which start pre-checked -- an
  // admin choice per test, not a hardcoded one. Defaults to "offer
  // everything, all on" (today's behavior) for a new test or one that's
  // never had this configured.
  const [dictationAvailable,setDictationAvailable] = useState<Set<HalfErrorCategory>>(new Set(ALL_HALF_ERROR_CATEGORIES));
  const [dictationDefaults,setDictationDefaults] = useState<Set<HalfErrorCategory>>(new Set(ALL_HALF_ERROR_CATEGORIES));
  // Purely for the live "target word count" hint below the stenography
  // passage box (researched convention: word count = dictation WPM x
  // minutes, e.g. 100 WPM for 10 minutes -> ~1000 words) -- these mirror
  // the Required WPM / Duration fields' own defaultValue, updated via
  // onChange, without turning those inputs from uncontrolled to
  // controlled (form submission still reads them via FormData as before).
  const [wpmHint,setWpmHint] = useState(30);
  const [durationHint,setDurationHint] = useState(10);
  // Every one of these mirrors a form field that used to be uncontrolled
  // (defaultValue only). React resets every uncontrolled field back to its
  // defaultValue once a form's `action` call resolves -- including a
  // resolved-but-rejected validation attempt, since that's still a normal
  // resolution, not a thrown error. That wiped out whatever the admin had
  // typed on every failed save (a real reported bug: "everything
  // disappears"). Making these fully controlled, like passage/language/
  // inputSystem/stenoCategorySlug already were, is what stops that reset
  // from touching them.
  const [title,setTitle] = useState("");
  const [description,setDescription] = useState("");
  const [taskCategory,setTaskCategory] = useState("Task");
  const [accuracyValue,setAccuracyValue] = useState(90);
  const [backspaceMode,setBackspaceMode] = useState("full");
  const [wordMethod,setWordMethod] = useState("characters");
  const [highlightMode,setHighlightMode] = useState("character");
  const [visibility,setVisibility] = useState<"private"|"public">("private");
  const [startsAt,setStartsAt] = useState("");
  const [endsAt,setEndsAt] = useState("");
  const [resultsPublishAt,setResultsPublishAt] = useState("");
  // "anytime" mode: no fixed start/end window -- attemptable any day, any
  // time, one attempt per student like the scheduled shape, but each
  // student's OWN result unlocks resultsDelayMinutes after THEIR OWN
  // submission instead of one shared resultsPublishAt for everyone.
  const [liveMode,setLiveMode] = useState<"scheduled"|"anytime">("scheduled");
  const [resultsDelayMinutes,setResultsDelayMinutes] = useState(10);
  const [state,action,pending] = useActionState(saveAction,initialState);
  // Puts a red box on the exact field a validation error is about (see
  // validateManagedTest's fieldErrors) and scrolls/focuses it, instead of
  // leaving the admin to hunt for which of a dozen fields the one message
  // at the bottom of the form is actually about.
  const fieldError = (name: string) => state.fieldErrors?.[name];
  const errorRing = (name: string) => fieldError(name) ? " !border-red-500 focus:!border-red-500 ring-2 ring-red-200" : "";
  useEffect(() => {
    const firstField = state.fieldErrors && Object.keys(state.fieldErrors)[0];
    if (!firstField) return;
    const element = document.querySelector(`[name="${firstField}"]`) as HTMLElement | null;
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus();
  }, [state.fieldErrors]);
  // React resets a <form>'s native DOM state once its `action` call
  // resolves -- success or failure alike. For text/number inputs React
  // re-applies the controlled `value` on the next render regardless, so
  // they're unaffected; but a controlled <select> only gets its value
  // re-applied when that value actually differs from the PREVIOUS render's
  // value, so if an admin's choice already equals the option React last
  // rendered (nothing changed on the React side), React sees no reason to
  // touch a DOM it doesn't know a native reset just silently reverted to
  // its first <option> -- exactly what happened to the Stenography
  // category select after any failed submit. Force every controlled select
  // in this form back to its real value after every submit attempt, so
  // this can't happen to any of them.
  useEffect(() => {
    const resync = (name: string, value: string) => { const element = document.querySelector(`select[name="${name}"]`) as HTMLSelectElement | null; if (element && element.value !== value) element.value = value; };
    resync("language", language);
    resync("inputSystemId", inputSystem);
    resync("examCategory", examCategorySlug);
    resync("stenoCategory", stenoCategorySlug);
    resync("taskCategory", taskCategory);
    resync("backspaceMode", backspaceMode);
    resync("wordMethod", wordMethod);
    resync("highlightMode", highlightMode);
    resync("visibility", visibility);
  }, [state, language, inputSystem, examCategorySlug, stenoCategorySlug, taskCategory, backspaceMode, wordMethod, highlightMode, visibility]);
  const filtered = useMemo(() => {
    const matches = tests.filter((item) => { const q=query.toLowerCase(); const languageMatch=filterLanguage==="all"||item.language===filterLanguage||item.input_system_id.includes(filterLanguage); const modeMatch=filterMode==="all"||item.mode===filterMode||(filterMode==="typing"&&item.mode!=="stenography"); const ownershipMatch=ownership==="all"||!currentAdminId||item.created_by===currentAdminId; return (!q||`${item.title} ${item.slug}`.toLowerCase().includes(q))&&(status==="all"||item.status===status)&&languageMatch&&modeMatch&&ownershipMatch; });
    if (sort==="serial") return sortExamCategoryNavigatorItems(matches,"ascending");
    return [...matches].sort((a,b)=>sort==="title"?a.title.localeCompare(b.title):sort==="attempts"?b.attempts-a.attempts:new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime());
  }, [tests,query,status,filterLanguage,filterMode,ownership,currentAdminId,sort]);
  useEffect(()=>{setPage(1);},[query,status,filterLanguage,filterMode,ownership,sort,pageSize]);
  const pageCount = Math.max(1,Math.ceil(filtered.length/pageSize));
  const safePage = Math.min(page,pageCount);
  const pageStart = (safePage-1)*pageSize;
  const pageItems = filtered.slice(pageStart,pageStart+pageSize);
  const rangeStart = filtered.length ? pageStart+1 : 0;
  const rangeEnd = Math.min(filtered.length,pageStart+pageSize);
  const choose = (test:ManagedTestRow|null) => {
    const chosenLanguage = test?.currentVersion?.language??lockedLanguage??"English"; const chosenMode = effectiveMode??test?.currentVersion?.mode??"practice";
    setEditing(test); setPassage(test?.currentVersion?.passage??""); setLanguage(chosenLanguage); setInputSystem(test?.currentVersion?.input_system_id??lockedInputSystemId??defaultInputSystemFor(chosenLanguage,chosenMode)); setFormMode(chosenMode); setIsLive(lockedLive || Boolean(test?.is_live)); setPreview(false); setShowRawPassage(false);
    setExamCategorySlug((test?.currentVersion?.configuration?.exam_category as string|undefined) ?? "");
    setStenoCategorySlug((test?.currentVersion?.configuration?.steno_category as string|undefined) ?? "");
    const stored = test?.currentVersion?.configuration?.dictation_categories as {available?:unknown;defaults?:unknown}|undefined;
    const validated = (value:unknown) => Array.isArray(value) ? value.filter((item):item is HalfErrorCategory => (ALL_HALF_ERROR_CATEGORIES as string[]).includes(item as string)) : null;
    setDictationAvailable(new Set(validated(stored?.available) ?? ALL_HALF_ERROR_CATEGORIES));
    setDictationDefaults(new Set(validated(stored?.defaults) ?? ALL_HALF_ERROR_CATEGORIES));
    setWpmHint(test?.currentVersion?.required_wpm ?? 30);
    setDurationHint((test?.currentVersion?.duration_seconds ?? 600) / 60);
    setTitle(test?.title ?? "");
    setDescription(test?.currentVersion?.description ?? "");
    setTaskCategory((test?.currentVersion?.configuration?.task_category as string|undefined) ?? "Task");
    setAccuracyValue(test?.currentVersion?.required_accuracy ?? 90);
    setBackspaceMode(test?.currentVersion?.backspace_mode ?? "full");
    setWordMethod(test?.currentVersion?.word_method ?? "characters");
    setHighlightMode(test?.currentVersion?.highlight_mode ?? "character");
    setVisibility((test?.currentVersion?.visibility as "private"|"public"|undefined) ?? "private");
    setStartsAt(localDateTime(test?.live_starts_at));
    setEndsAt(localDateTime(test?.live_ends_at));
    setResultsPublishAt(localDateTime(test?.results_publish_at));
    setLiveMode(test?.results_delay_minutes != null ? "anytime" : "scheduled");
    setResultsDelayMinutes(test?.results_delay_minutes ?? 10);
  };
  // Hindi typing (Learn/Practice) offers Kruti Dev 010 only -- Exam/Stenography
  // keep every input system, unaffected by this restriction.
  const hindiSystemIds = new Set(hindiInputSystemsFor(formMode).map((system) => system.id));
  const systems = MANAGED_INPUT_SYSTEMS.filter((system) => system.language === language && (language !== "Hindi" || hindiSystemIds.has(system.id)));
  // Researched convention (SSC-style stenography skill tests): the
  // dictated matter's word count is simply speed x duration -- 100 WPM
  // for 10 minutes is dictated as ~1000 words, 80 WPM for 10 minutes as
  // ~800. Undersized matter runs out before the dictation time is up;
  // oversized matter cuts a real dictation off mid-passage. Only shown
  // for stenography, the one mode where the passage is actually dictated
  // at a fixed reading speed rather than typed freely.
  const targetWords = Math.round(wpmHint * durationHint);
  const actualWords = countPassageWords(passage);
  const wordCountOffPercent = targetWords ? Math.abs(actualWords - targetWords) / targetWords : 0;
  // Description stays visible for every mode except plain Practice --
  // unaffected by the change below, it's just informational admin text,
  // not a typing-behaviour setting.
  const descriptionVisible = formMode !== "practice" || isLive;
  const selectedExamCategory = EXAM_CATEGORIES.find((category) => category.slug === examCategorySlug);
  // Exam tests with a category chosen (the normal case; required unless
  // isLive) no longer ask the admin to configure duration, required speed/
  // accuracy, backspace, word calculation, or highlighting -- these already
  // only ever reproduced that category's own official pattern. A live exam
  // test may leave the category unset (it's optional there, see the picker
  // below) and falls back to full manual entry, same as before category
  // presets became available for live tests at all. Plain Practice never
  // has a category concept -- its own admin rules only ever show when
  // isLive (a live "practice"-mode test still needs everything set by
  // hand). Stenography always shows this block (its own category, when
  // chosen, only ever forces duration/speed/accuracy below, never
  // backspace/wordMethod/highlight). See actions.ts's practiceFixedDefaults/
  // categoryRules for the matching server-side enforcement.
  const showAdminRules = formMode === "learn" || formMode === "stenography" || (formMode === "practice" && isLive) || (formMode === "exam" && !selectedExamCategory);
  const selectedStenoCategory = formMode === "stenography" ? STENOGRAPHY_CATEGORIES.find((category) => category.slug === stenoCategorySlug) : undefined;
  const stenoSpeed = selectedStenoCategory ? (language === "Hindi" ? selectedStenoCategory.dictationSpeedHindi : selectedStenoCategory.dictationSpeedEnglish) : undefined;
  const stenoWritingMinutes = selectedStenoCategory ? (language === "Hindi" ? selectedStenoCategory.writingMinutesHindi : selectedStenoCategory.writingMinutesEnglish) : undefined;
  const stenoLocked = Boolean(selectedStenoCategory);
  const stenoDurationLocked = stenoLocked && stenoWritingMinutes != null;
  // Once a stenography category is chosen, the word-count-target hint above
  // the passage box (targetWords below) must always reflect that category's
  // real DICTATION speed/duration (typically 100 WPM x 10 min), even though
  // the Duration field being saved to the database (durationSeconds) is a
  // completely different number when stenoDurationLocked -- the real
  // TRANSCRIPTION time (e.g. 60/70 min for RSMSSB). wpmHint/durationHint
  // exist purely for that on-screen hint and were never wired to the same
  // form value as requiredWpm/durationMinutes in the first place, so
  // overriding them here doesn't touch what actually gets submitted.
  useEffect(() => { if (!selectedStenoCategory) return; setWpmHint(stenoSpeed ?? 30); setDurationHint(selectedStenoCategory.durationMinutes); }, [selectedStenoCategory, stenoSpeed]);
  const passageFormat:HindiTextFormat=inputSystem.includes("krutidev")?"krutidev":"unicode";
  const encodingWarning=language==="Hindi"?encodingValidationMessage(passage,passageFormat):null;
  useEffect(()=>{if(language!=="Hindi"||passageFormat!=="krutidev")return;let active=true;document.fonts.load('20px "Kruti Dev 010"').then(()=>{if(active)setKrutiFontReady(document.fonts.check('20px "Kruti Dev 010"'));}).catch(()=>{if(active)setKrutiFontReady(false);});return()=>{active=false};},[language,passageFormat]);

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
    <section className="rounded-2xl bg-white p-5 shadow">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-sm font-black text-white">{tests.length.toLocaleString("en-IN")} test{tests.length===1?"":"s"} total</span>{filtered.length!==tests.length && <span className="text-xs font-bold text-slate-500">{filtered.length.toLocaleString("en-IN")} match the filters below</span>}</div>
      {currentAdminId && <div role="radiogroup" aria-label="Show tests created by" className="mb-3 flex gap-4 text-sm font-bold text-slate-700"><label className="flex items-center gap-1.5"><input type="radio" name="ownership" checked={ownership==="all"} onChange={()=>setOwnership("all")}/>Public (everyone&apos;s)</label><label className="flex items-center gap-1.5"><input type="radio" name="ownership" checked={ownership==="mine"} onChange={()=>setOwnership("mine")}/>Personal (mine only)</label></div>}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5"><input aria-label="Search tests" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search title or slug" className="input"/><select aria-label="Filter status" value={status} onChange={(event)=>setStatus(event.target.value)} className="input"><option value="all">All statuses</option>{["draft","published","unpublished","archived"].map((value)=><option key={value}>{value}</option>)}</select>{!lockedLanguage && <select aria-label="Filter language" value={filterLanguage} onChange={(event)=>setFilterLanguage(event.target.value)} className="input"><option value="all">All languages</option><option>English</option><option>Hindi</option><option value="unicode">Hindi Unicode</option><option value="krutidev">Kruti Dev</option></select>}{!effectiveMode && <select aria-label="Filter mode" value={filterMode} onChange={(event)=>setFilterMode(event.target.value)} className="input"><option value="all">All modes</option><option value="typing">Typing</option>{["learn","practice","exam","stenography"].map((value)=><option key={value}>{value}</option>)}</select>}<select aria-label="Sort tests" value={sort} onChange={(event)=>setSort(event.target.value)} className="input"><option value="serial">Serial (1, 2, 3…)</option><option value="updated">Recently updated</option><option value="title">Title</option><option value="attempts">Attempts</option></select></div>
      <Pagination page={safePage} pageCount={pageCount} pageSize={pageSize} rangeStart={rangeStart} rangeEnd={rangeEnd} total={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} position="top"/>
      <div className="mt-3 space-y-1.5">{pageItems.length ? pageItems.map((test)=><TestRow key={test.id} test={test} learningOnly={learningOnly} onEdit={()=>choose(test)}/>) : <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">No tests match these filters.</p>}</div>
      <Pagination page={safePage} pageCount={pageCount} pageSize={pageSize} rangeStart={rangeStart} rangeEnd={rangeEnd} total={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} position="bottom"/>
    </section>
    <aside className="rounded-2xl bg-white p-5 shadow xl:sticky xl:top-5 xl:self-start">
      <div className="flex justify-between"><h2 className="text-xl font-black">{editing ? "Edit and create version" : "Create test"}</h2>{editing&&<button type="button" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800" onClick={()=>choose(null)}>+ Create a new test instead</button>}</div>
      {editing && <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">You are editing <span className="underline">{editing.title}</span> (v{editing.current_version_number}, last saved {new Date(editing.updated_at).toLocaleDateString("en-IN")}). Saving replaces its content with a new version -- it does not create a separate test. Click &quot;+ Create a new test instead&quot; above if you meant to make something new.</p>}
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="testId" value={editing?.id??""}/>
        {effectiveMode&&<input type="hidden" name="mode" value={effectiveMode}/>} {learningOnly&&<input type="hidden" name="visibility" value="public"/>}
        <Field label="Title"><input className={`input${errorRing("title")}`} name="title" value={title} onChange={(event)=>setTitle(event.target.value)} style={{fontFamily:language==="Hindi"?'"Nirmala UI", Mangal, "Noto Sans Devanagari", sans-serif':undefined}} required/>{fieldError("title") && <p className="mt-1 text-xs font-bold text-red-600">{fieldError("title")}</p>}<span className="mt-1 block text-xs font-normal text-slate-500">Titles always use Unicode; only Passage / matter may use legacy Kruti Dev encoding. {editing ? "This test's web address was set from its title when first created and won't change if you rename it now -- if a new test's title collides with it, rename this one." : "This title also sets the test's web address -- renaming later won't change the address, so if a future test's title collides with this one, come back and rename this test."}</span></Field>
        <Field label="URL slug"><input className="input" name="slug" defaultValue={editing?.slug}/></Field>
        {descriptionVisible && <Field label="Description"><textarea className="input min-h-20" name="description" value={description} onChange={(event)=>setDescription(event.target.value)}/></Field>}
        {lockedLanguage && lockedInputSystemId ? <>
          <input type="hidden" name="language" value={language}/>
          <input type="hidden" name="inputSystemId" value={inputSystem}/>
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-black text-slate-700">{language} · {systems.find((system)=>system.id===inputSystem)?.label??inputSystem} <span className="font-normal text-slate-500">(set by the language you chose to get here)</span></p>
        </> : lockedLanguage ? <>
          <input type="hidden" name="language" value={language}/>
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-black text-slate-700">{language} <span className="font-normal text-slate-500">(set by the language you chose to get here)</span></p>
          <Field label="Input system"><select className="input" name="inputSystemId" value={inputSystem} onChange={(event)=>setInputSystem(event.target.value)}>{systems.map((system)=><option key={system.id} value={system.id}>{system.label}</option>)}</select></Field>
        </> : <div className="grid grid-cols-2 gap-3"><Field label="Language"><select className="input" name="language" value={language} onChange={(event)=>{const value=event.target.value as "English"|"Hindi";setLanguage(value);setInputSystem(defaultInputSystemFor(value,formMode));}}><option>English</option><option>Hindi</option></select></Field><Field label="Input system"><select className="input" name="inputSystemId" value={inputSystem} onChange={(event)=>setInputSystem(event.target.value)}>{systems.map((system)=><option key={system.id} value={system.id}>{system.label}</option>)}</select></Field></div>}
        {formMode==="exam" && <Field label="Exam category"><select className={`input${errorRing("examCategory")}`} name="examCategory" value={examCategorySlug} onChange={(event)=>setExamCategorySlug(event.target.value)} required={!isLive}><option value="">{isLive?"No category -- set speed/duration manually below":"Select an exam category…"}</option>{EXAM_CATEGORIES.map((category)=><option key={category.slug} value={category.slug}>{category.name} — {category.fullName}</option>)}</select>{fieldError("examCategory") && <p className="mt-1 text-xs font-bold text-red-600">{fieldError("examCategory")}</p>}<span className="mt-1 block text-xs font-normal text-slate-500">This category's own official speed, duration, accuracy and backspace rules apply automatically to this test -- you only supply the passage below. Students find this test on that category's exercise list.{isLive&&" Optional for a live test -- leave it unset to configure everything below by hand instead."}</span></Field>}
        {formMode==="stenography" && <Field label="Stenography category"><select className={`input${errorRing("stenoCategory")}`} name="stenoCategory" value={stenoCategorySlug} onChange={(event)=>setStenoCategorySlug(event.target.value)} required={!isLive}><option value="">{isLive?"No category -- set speed/duration manually below":"Select a stenography category…"}</option>{STENOGRAPHY_CATEGORIES.map((category)=><option key={category.slug} value={category.slug}>{category.name} — {category.fullName}</option>)}</select>{fieldError("stenoCategory") && <p className="mt-1 text-xs font-bold text-red-600">{fieldError("stenoCategory")}</p>}<span className="mt-1 block text-xs font-normal text-slate-500">{!selectedStenoCategory ? `This category's own researched dictation speed and minimum accuracy apply automatically once chosen; its transcription duration too, when a confirmed figure exists for this post.${isLive?" Optional for a live test -- leave it unset to configure speed/duration manually instead.":""}` : stenoDurationLocked ? "This category's official dictation speed, minimum accuracy, and transcription duration apply automatically below -- you only supply the passage and dictation audio." : "This category's official dictation speed and minimum accuracy apply automatically below. No confirmed transcription-duration figure exists for this post yet, so Duration below stays yours to set -- verify against the current notification."}</span></Field>}
        {(!effectiveMode || (showAdminRules && !stenoDurationLocked)) && <div className="grid grid-cols-2 gap-3">{!effectiveMode&&<Field label="Mode"><select className="input" name="mode" value={formMode} onChange={(event)=>setFormMode(event.target.value as ManagedTestMode)}>{["learn","practice","exam","stenography"].map((value)=><option key={value}>{value}</option>)}</select></Field>}{(showAdminRules && !stenoDurationLocked)&&<Field label="Duration (minutes)"><select className={`input${errorRing("durationMinutes")}`} name="durationMinutes" value={durationHint} onChange={(event)=>setDurationHint(Number(event.target.value)||0)}>{ADMIN_DURATION_MINUTES.map((minutes)=><option key={minutes} value={minutes}>{minutes} min</option>)}</select>{fieldError("durationMinutes") && <p className="mt-1 text-xs font-bold text-red-600">{fieldError("durationMinutes")}</p>}</Field>}</div>}
        {stenoDurationLocked && <><input type="hidden" name="durationMinutes" value={stenoWritingMinutes}/><p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-black text-blue-900">Official transcription time for {selectedStenoCategory!.name} ({language}): {stenoWritingMinutes} minutes -- can't be changed here.</p>{fieldError("durationMinutes") && <p className="mt-1 text-xs font-bold text-red-600">{fieldError("durationMinutes")} This is a bug in the category's own data, not something you can fix here -- please report it.</p>}</>}
        {stenoLocked && !stenoDurationLocked && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">No confirmed official transcription duration was found for {selectedStenoCategory!.name} -- set a reasonable Duration above yourself, and verify against the current recruitment notification.</p>}
        {!showAdminRules && <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-black text-blue-900">{formMode==="exam"?(selectedExamCategory?`Duration follows ${selectedExamCategory.name}'s official pattern (${selectedExamCategory.durationMinutes} minutes) and can't be changed here.`:"Choose an exam category above -- its official duration can't be changed here."):"Duration is picked by the student (1–25 min, then 5-min steps to 70) when they start the test -- no need to set one here."}</p>}
        <Field label="Passage / matter"><div className="mb-2 flex flex-wrap items-center justify-between gap-2">{language==="Hindi"&&<span className={`rounded-full px-3 py-1 text-xs font-black ${passageFormat==="krutidev"?"bg-amber-100 text-amber-900":"bg-emerald-100 text-emerald-900"}`}>{passageFormat==="krutidev"?"Kruti Dev 010 · Legacy encoded text":"Unicode Hindi · Mangal display"}</span>}<div className="flex gap-2">{passageFormat==="krutidev"&&<button type="button" aria-pressed={showRawPassage} onClick={()=>setShowRawPassage(value=>!value)} className="rounded-lg border px-3 py-2 text-xs font-black">{showRawPassage?"View Hindi preview":"View raw encoding"}</button>}{language==="Hindi"&&<button type="button" onClick={()=>setConverterOpen(true)} className="rounded-lg border border-violet-300 px-3 py-2 text-xs font-black text-violet-800">Open Font Converter</button>}</div></div><textarea className={`input min-h-48 text-lg leading-8${errorRing("passage")}`} name="passage" value={passage} onChange={(event)=>setPassage(event.target.value)} data-encoding={passageFormat} style={{fontFamily:language==="Hindi"?(passageFormat==="krutidev"&&!showRawPassage?'"Kruti Dev 010", sans-serif':passageFormat==="krutidev"?'ui-monospace, Consolas, monospace':'Mangal, "Nirmala UI", sans-serif'):undefined}} required/>{fieldError("passage") && <p className="mt-1 text-xs font-bold text-red-600">{fieldError("passage")}</p>}<p className="mt-1 text-xs text-slate-500">{[...passage].length.toLocaleString("en-IN")} characters · {actualWords.toLocaleString("en-IN")} words</p>{formMode==="stenography"&&targetWords>0&&<p className={`mt-1 text-xs font-bold ${wordCountOffPercent<=0.1?"text-emerald-700":wordCountOffPercent<=0.25?"text-amber-700":"text-red-700"}`}>Target for a {wpmHint} WPM &times; {durationHint} min dictation: ~{targetWords.toLocaleString("en-IN")} words (speed &times; duration) -- {actualWords<targetWords?`${(targetWords-actualWords).toLocaleString("en-IN")} short`:actualWords>targetWords?`${(actualWords-targetWords).toLocaleString("en-IN")} over`:"on target"}</p>}{encodingWarning&&<p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">{encodingWarning}</p>}{passageFormat==="krutidev"&&krutiFontReady===false&&<p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">Kruti Dev 010 could not be loaded from /fonts/KrutiDev010.ttf. Legacy text cannot be previewed reliably.</p>}</Field>
        {showAdminRules && !stenoLocked && <div className="grid grid-cols-2 gap-3"><Field label="Required WPM"><input className={`input${errorRing("requiredWpm")}`} name="requiredWpm" type="number" min={0} max={300} step="0.01" value={wpmHint} onChange={(event)=>setWpmHint(Number(event.target.value)||0)}/>{fieldError("requiredWpm") && <p className="mt-1 text-xs font-bold text-red-600">{fieldError("requiredWpm")}</p>}</Field><Field label="Required accuracy"><input className={`input${errorRing("requiredAccuracy")}`} name="requiredAccuracy" type="number" min={0} max={100} step="0.01" value={accuracyValue} onChange={(event)=>setAccuracyValue(Number(event.target.value)||0)}/>{fieldError("requiredAccuracy") && <p className="mt-1 text-xs font-bold text-red-600">{fieldError("requiredAccuracy")}</p>}</Field></div>}
        {stenoLocked && <><input type="hidden" name="requiredWpm" value={stenoSpeed}/><input type="hidden" name="requiredAccuracy" value={selectedStenoCategory!.accuracy}/><p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-black text-blue-900">This test uses {selectedStenoCategory!.name}'s official target of {stenoSpeed} WPM dictation / {selectedStenoCategory!.accuracy}% minimum accuracy and can't be changed here.</p>{(fieldError("requiredWpm")||fieldError("requiredAccuracy")) && <p className="mt-1 text-xs font-bold text-red-600">{fieldError("requiredWpm")||fieldError("requiredAccuracy")} This is a bug in the category's own data, not something you can fix here -- please report it.</p>}</>}
        {!showAdminRules && <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-black text-blue-900">{formMode==="exam"?(selectedExamCategory?`This test uses ${selectedExamCategory.name}'s official target of ${language==="Hindi"?selectedExamCategory.speedHindi:selectedExamCategory.speedEnglish} WPM / ${selectedExamCategory.accuracy}% accuracy and can't be changed here.`:"Choose an exam category above to set the required speed and accuracy automatically."):"Practice tests aren't graded against a target -- required speed/accuracy default to 30 WPM / 90% (shown for reference on results, not a pass/fail gate)."}</p>}
        {formMode==="stenography" && <Field label="Task category"><select className="input" name="taskCategory" value={taskCategory} onChange={(event)=>setTaskCategory(event.target.value)}>{STENOGRAPHY_TASK_CATEGORIES.map((category)=><option key={category} value={category}>{category}</option>)}</select></Field>}
        {formMode==="stenography" && <Field label="Dictation audio (optional)"><input type="hidden" name="existingAudioPath" value={(editing?.currentVersion?.configuration?.audio_path as string|undefined)??""}/>{(editing?.currentVersion?.configuration?.audio_path as string|undefined) && <p className="mb-2 text-xs font-bold text-emerald-700">Audio attached ✓ <label className="ml-2 font-normal text-slate-600"><input type="checkbox" name="removeAudio"/> Remove on save</label></p>}<input className="input" name="audioFile" type="file" accept="audio/*"/><p className="mt-1 text-xs text-slate-500">Students hear this recording (speed adjustable) instead of reading the passage; the passage is still used to score their typed text.</p></Field>}
        <Field label="Question paper PDF (optional)"><input type="hidden" name="existingPdfPath" value={(editing?.currentVersion?.configuration?.pdf_path as string|undefined)??""}/><input type="hidden" name="existingPdfFileName" value={(editing?.currentVersion?.configuration?.pdf_file_name as string|undefined)??""}/>{(editing?.currentVersion?.configuration?.pdf_path as string|undefined) && <p className="mb-2 text-xs font-bold text-emerald-700">PDF attached ✓ {editing?.currentVersion?.configuration?.pdf_file_name as string|undefined} <label className="ml-2 font-normal text-slate-600"><input type="checkbox" name="removePdf"/> Remove on save</label></p>}<input className="input" name="pdfFile" type="file" accept="application/pdf"/><p className="mt-1 text-xs text-slate-500">Students get a Download PDF button for this exact file -- separate from the auto-generated Print/PDF button, which prints the typed passage text itself.</p></Field>
        {formMode==="stenography" && <Field label="Dictation grading checklist (shown to the student before typing)">
          <input type="hidden" name="dictationAvailable" value={[...dictationAvailable].join(",")}/>
          <input type="hidden" name="dictationDefaults" value={[...dictationDefaults].join(",")}/>
          <div className="grid gap-1 rounded-xl border border-slate-200 p-3 text-sm">
            {ALL_HALF_ERROR_CATEGORIES.filter((category)=>language==="English"?category!=="halant":category!=="capitalization").map((category)=>{
              const offered = dictationAvailable.has(category);
              return <div key={category} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
                <span className="font-bold text-slate-800">{category==="punctuation"&&language!=="English"?"Comma Count":HALF_ERROR_CATEGORY_LABELS[category]}</span>
                <span className="flex gap-3 text-xs">
                  <label className="flex items-center gap-1 font-bold text-slate-600"><input type="checkbox" checked={offered} onChange={(event)=>{const next=new Set(dictationAvailable);if(event.target.checked)next.add(category);else{next.delete(category);const defaults=new Set(dictationDefaults);defaults.delete(category);setDictationDefaults(defaults);}setDictationAvailable(next);}}/>Offer to student</label>
                  <label className={`flex items-center gap-1 font-bold ${offered?"text-slate-600":"text-slate-300"}`}><input type="checkbox" disabled={!offered} checked={dictationDefaults.has(category)} onChange={(event)=>{const next=new Set(dictationDefaults);if(event.target.checked)next.add(category);else next.delete(category);setDictationDefaults(next);}}/>On by default</label>
                </span>
              </div>;
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500">Unchecked "Offer to student" categories never appear on the checklist at all -- they're never graded for this test. The student can still adjust anything left checked before typing.</p>
        </Field>}
        {showAdminRules ? <><Field label="Backspace"><select className="input" name="backspaceMode" value={backspaceMode} onChange={(event)=>setBackspaceMode(event.target.value)}><option value="full">Full</option><option value="word">Current word</option><option value="disabled">Disabled</option></select></Field><Field label="Word calculation"><select className="input" name="wordMethod" value={wordMethod} onChange={(event)=>setWordMethod(event.target.value)}><option value="characters">5 characters</option><option value="spaces">Space-separated words</option></select></Field><Field label="Highlight default"><select className="input" name="highlightMode" value={highlightMode} onChange={(event)=>setHighlightMode(event.target.value)}><option value="character">Character</option><option value="word">Current word</option><option value="none">None</option></select></Field></> : <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-black text-blue-900">{formMode==="exam"?(selectedExamCategory?`Backspace follows ${selectedExamCategory.name}'s official policy (${selectedExamCategory.backspaceMode==="disabled"?"not allowed":selectedExamCategory.backspaceMode==="word"?"current word only":"full"}); word calculation is ${selectedExamCategory.wordMethod==="spaces"?"space-separated words":"5 characters"} and highlighting is ${selectedExamCategory.highlightMode==="none"?"off":selectedExamCategory.highlightMode==="word"?"current word":"character"} -- also that category's own setting, not this platform's generic default -- and none of this can be changed here.`:"Choose an exam category above to set the backspace, word calculation, and highlight policy automatically."):"Practice settings are controlled by the student."}</p>}
        <Field label="Visibility"><select className="input" name="visibility" value={visibility} onChange={(event)=>setVisibility(event.target.value as "private"|"public")}><option value="private">Private</option><option value="public">Public</option></select></Field>
        {(!effectiveMode||lockedLive)&&<fieldset className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          {lockedLive?<input type="hidden" name="isLive" value="on"/>:<label className="flex items-center gap-2 font-black text-blue-950"><input type="checkbox" name="isLive" checked={isLive} onChange={(event)=>setIsLive(event.target.checked)}/>Free live test</label>}
          <p className="mt-1 text-xs text-blue-800">Live tests must be public. Each registered student receives one attempt.</p>
          {isLive&&<>
            <div className="mt-3 flex flex-wrap gap-4 text-sm font-black text-blue-950">
              <label className="flex items-center gap-1.5"><input type="radio" name="liveMode" value="scheduled" checked={liveMode==="scheduled"} onChange={()=>setLiveMode("scheduled")}/>Scheduled window</label>
              <label className="flex items-center gap-1.5"><input type="radio" name="liveMode" value="anytime" checked={liveMode==="anytime"} onChange={()=>setLiveMode("anytime")}/>Anytime</label>
            </div>
            {liveMode==="scheduled"
              ? <div className="mt-3 grid gap-2">
                  <p className="text-xs text-blue-800">Everyone attempts within this one window; results unlock for everyone at the publication time.</p>
                  <Field label="Starts"><input className="input" name="startsAt" type="datetime-local" value={startsAt} onChange={(event)=>setStartsAt(event.target.value)}/>{startsAt&&<p className="mt-1 text-xs font-black text-blue-900">= {scheduleReadout(startsAt)}</p>}</Field>
                  <Field label="Ends"><input className="input" name="endsAt" type="datetime-local" value={endsAt} onChange={(event)=>setEndsAt(event.target.value)}/>{endsAt&&<p className="mt-1 text-xs font-black text-blue-900">= {scheduleReadout(endsAt)}</p>}</Field>
                  <Field label="Publish results"><input className="input" name="resultsPublishAt" type="datetime-local" value={resultsPublishAt} onChange={(event)=>setResultsPublishAt(event.target.value)}/>{resultsPublishAt&&<p className="mt-1 text-xs font-black text-blue-900">= {scheduleReadout(resultsPublishAt)}</p>}</Field>
                </div>
              : <div className="mt-3 grid gap-2">
                  <p className="text-xs text-blue-800">Attemptable any day, any time -- no start/end window. Each student's own result unlocks only for them, this many minutes after THEY submit.</p>
                  <Field label="Results delay (minutes after the student submits)"><input className="input" name="resultsDelayMinutes" type="number" min={1} max={1440} value={resultsDelayMinutes} onChange={(event)=>setResultsDelayMinutes(Math.max(1,Math.min(1440,Number(event.target.value)||1)))}/></Field>
                </div>}
          </>}
        </fieldset>}
        <button type="button" onClick={()=>setPreview((value)=>!value)} className="w-full rounded-lg border py-2 font-bold">{preview?"Hide preview":"Preview"}</button>
        {preview&&<div className="max-h-56 overflow-auto rounded-xl bg-slate-50 p-4"><h3 className="font-bold">Passage preview</h3>{passageFormat==="krutidev"&&<span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">Kruti Dev 010 · Legacy encoded text</span>}<p className="mt-2 whitespace-pre-wrap text-lg leading-8" style={{fontFamily:inputSystem.includes("krutidev")?'"Kruti Dev 010", sans-serif':language==="Hindi"?'"Nirmala UI", Mangal, sans-serif':"Arial, sans-serif"}}>{passage||"No passage entered."}</p></div>}
        {state.error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}{state.success&&<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{state.success}</p>}
        {learningOnly?<button disabled={pending} className="w-full rounded-lg bg-blue-700 py-3 font-bold text-white">{editing?"Save and Publish Changes":"Create and Publish Test"}</button>:<div className="grid grid-cols-2 gap-2"><button disabled={pending} name="intent" value="draft" className="rounded-lg border border-blue-700 py-3 font-bold text-blue-700">Save draft</button><button disabled={pending} name="intent" value="publish" className="rounded-lg bg-blue-700 py-3 font-bold text-white">Publish</button></div>}
      </form>{converterOpen&&<div role="dialog" aria-modal="true" aria-label="Font and text converter" className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 p-3 sm:p-6"><div className="mx-auto max-w-[1500px] rounded-3xl bg-slate-100 p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">Font & Text Converter</h2><button type="button" aria-label="Close converter" onClick={()=>setConverterOpen(false)} className="rounded-lg bg-white px-4 py-2 text-xl font-black">×</button></div><FontConverter initialText={passage} initialSource={passageFormat} expectedOutput={passageFormat} onUse={(result)=>{if(result.encoding!==passageFormat){alert(`Select ${passageFormat==="krutidev"?"Kruti Dev 010":"Unicode Hindi — Mangal"} output before inserting.`);return;}if(confirm("Replace the Passage / matter field with this converted text? The current passage will remain unchanged until you confirm.")){setPassage(result.text);setConverterOpen(false);}}}/></div></div>}
    </aside>
  </div>;
}

// Dense single-line row with icon-only actions (same treatment as the
// admin Students page's Manage column) -- everything this used to spell
// out (language, input system, mode, duration, character/word counts,
// attempts, visibility, creator, created date) is still available, just
// not repeated on every row: the student sees it on the test itself, and
// the admin sees it the moment they open Edit (choose() already loads all
// of it into the form). Keeping every row to one line is what actually
// lets an admin scan dozens of tests at a glance instead of a handful.
const ICON_BUTTON = "flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm hover:bg-slate-200";
function TestRow({test,onEdit,learningOnly}:{test:ManagedTestRow;onEdit:()=>void;learningOnly:boolean}) {
  const version = test.currentVersion;
  const hasAudio = Boolean(version?.configuration?.audio_path);
  const liveSchedule = test.is_live
    ? (test.results_delay_minutes != null
      ? `Anytime · results ${test.results_delay_minutes} min after each student submits`
      : `${new Date(test.live_starts_at??"").toLocaleString("en-IN")} → ${new Date(test.live_ends_at??"").toLocaleString("en-IN")} · results ${new Date(test.results_publish_at??"").toLocaleString("en-IN")}`)
    : undefined;
  // Everything this row used to spell out on its own lines, still available
  // in one hover instead of gone entirely.
  const details = `${test.language} · ${test.input_system_id} · ${test.mode} · ${Math.round((test.duration_seconds??0)/60)} min\n${version?.passage_characters??0} characters · ${version?.passage_words??0} words · ${test.attempts} attempts · ${test.visibility}\nCreator: ${test.creatorName??"—"} · Created ${test.created_at?new Date(test.created_at).toLocaleDateString("en-IN"):"—"}`;
  return <article className="rounded-xl border p-2.5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <h3 title={details} className="cursor-help truncate font-black">{test.title}</h3>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase">{test.status}</span>
        {test.is_live && <span title={liveSchedule} className="shrink-0 cursor-help rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">LIVE</span>}
        {test.mode==="stenography" && (hasAudio ? <span title="Dictation audio attached" aria-label="Dictation audio attached" className="shrink-0">🎧</span> : <span title="No dictation audio attached yet" aria-label="No dictation audio attached yet" className="shrink-0">⚠️</span>)}
        <span className="shrink-0 text-[10px] text-slate-400">v{test.current_version_number}</span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <Link href={`/tests/${test.slug}`} title="View" aria-label="View" className={ICON_BUTTON}>👁</Link>
        <Link href={`/admin/tests/${test.id}/results`} title={`Results (${test.attempts})`} aria-label={`Results (${test.attempts})`} className={`relative ${ICON_BUTTON}`}>📊{test.attempts>0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-700 px-1 text-[9px] font-black text-white">{test.attempts}</span>}</Link>
        <button type="button" title="Edit" aria-label="Edit" onClick={onEdit} className={ICON_BUTTON}>✏️</button>
        <Status test={test} status={test.status==="published"?"unpublished":"published"} icon={test.status==="published"?"⏸":"▶"} title={test.status==="published"?"Unpublish":"Publish"} tone={test.status==="published"?"neutral":"primary"}/>
        {test.status!=="archived" && <Status test={test} status="archived" icon="🗄" title="Archive"/>}
        {!learningOnly && <form action={duplicateManagedTest}><input type="hidden" name="testId" value={test.id}/><button title="Duplicate" aria-label="Duplicate" className={ICON_BUTTON}>⧉</button></form>}
        <form action={deleteManagedTest} onSubmit={(event)=>{if(!confirm(test.attempts?"This test has attempts and cannot be deleted. Archive it instead.":`Permanently delete ${test.title}?`))event.preventDefault();}}><input type="hidden" name="testId" value={test.id}/><button disabled={test.attempts>0} title={test.attempts>0?"Has attempts -- use Permanently delete below instead":"Delete"} aria-label="Delete" className={`${ICON_BUTTON} disabled:opacity-40 ${test.attempts>0?"":"bg-red-50 text-red-700 hover:bg-red-100"}`}>🗑</button></form>
      </div>
    </div>
    {test.attempts>0 && <PermanentDeleteDangerZone testId={test.id} title={test.title} attemptCount={test.attempts}/>}
  </article>;
}
function Status({test,status,icon,title,tone="neutral"}:{test:ManagedTestRow;status:ManagedTestStatus;icon:string;title:string;tone?:"primary"|"neutral"}) { return <form action={setManagedTestStatus}><input type="hidden" name="testId" value={test.id}/><input type="hidden" name="status" value={status}/><button title={title} aria-label={title} className={`${ICON_BUTTON} ${tone==="primary"?"bg-blue-700 text-white hover:bg-blue-800":""}`}>{icon}</button></form>; }
// Shared page-size + page-number bar, rendered once above the list and
// once below it (the admin asked for navigation in both places, plus a
// running "showing X-Y of Z" count) -- both renders share the exact same
// state, so paging from either one keeps the other in sync.
function Pagination({page,pageCount,pageSize,rangeStart,rangeEnd,total,onPageChange,onPageSizeChange,position}:{page:number;pageCount:number;pageSize:number;rangeStart:number;rangeEnd:number;total:number;onPageChange:(page:number)=>void;onPageSizeChange:(size:number)=>void;position:"top"|"bottom"}) {
  const btn = "rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
  return <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm ${position==="top"?"mt-3":"mt-4"}`}>
    <span className="font-bold text-slate-700">{total ? `Showing ${rangeStart.toLocaleString("en-IN")}–${rangeEnd.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")}` : "No tests match these filters"}</span>
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 font-bold text-slate-600">Per page<select aria-label="Tests per page" className="input !w-auto !py-1.5" value={pageSize} onChange={(event)=>onPageSizeChange(Number(event.target.value))}><option value={20}>20</option><option value={30}>30</option></select></label>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page<=1} onClick={()=>onPageChange(1)} className={btn}>« First</button>
        <button type="button" disabled={page<=1} onClick={()=>onPageChange(page-1)} className={btn}>‹ Prev</button>
        <span className="px-2 font-black text-slate-800">Page {page} of {pageCount}</span>
        <button type="button" disabled={page>=pageCount} onClick={()=>onPageChange(page+1)} className={btn}>Next ›</button>
        <button type="button" disabled={page>=pageCount} onClick={()=>onPageChange(pageCount)} className={btn}>Last »</button>
      </div>
    </div>
  </div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}) { if(label==="URL slug")return <span hidden>{children}</span>; return <label className="block text-sm font-bold text-slate-700"><span className="mb-1 block">{label}</span>{children}</label>; }

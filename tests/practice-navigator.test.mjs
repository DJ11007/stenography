import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolvePracticeSelection } from "../lib/practice-navigator.ts";
const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

// Real reported bug: publish order doesn't always match a title's own
// number (e.g. "TEST - 3" published before "TEST - 2"), so the "Choose a
// test" landing page listed 1, 3, 2, 4, 5, 6, 7 instead of serial order.
// Reuses the same numbered-title sort already built for the exam category
// navigator and the admin test list, and widens the grid to 4 columns
// (from 2) now that space isn't wasted on wide single-per-row cards.
test("the Choose a test landing page lists tests in serial (numbered-title) order across four columns, not raw publish order in two", async () => {
  const navigator = await read("app/typing/practice/_components/practice-navigator.tsx");
  assert.match(navigator, /import \{ sortExamCategoryNavigatorItems \} from "@\/lib\/exam-category-navigator";/);
  assert.match(navigator, /const items = sortExamCategoryNavigatorItems\(await getPracticeSelector\(\{ mode, language, inputSystemId, sort \}\), sort === "oldest" \? "ascending" : "descending"\);/);
  assert.match(navigator, /className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"/);
});
test("direct selector uses real compatible test metadata and stable ordering",async()=>{const server=await read("lib/practice-navigator-server.ts"),page=await read("app/typing/practice/_components/practice-navigator.tsx");for(const expected of [/getPracticeSelector/,/\.eq\("mode",filters\.mode\)/,/\.eq\("status","published"\)/,/\.eq\("visibility","public"\)/,/\.eq\("is_live",false\)/,/\.eq\("language",filters\.language\)/,/\.eq\("input_system_id",filters\.inputSystemId\)/,/\.order\("published_at",\{ascending:oldest\}\)\.order\("id",\{ascending:true\}\)/])assert.match(server,expected);assert.match(page,/items\.length/);assert.match(page,/Test \$\{index \+ 1\} of \$\{items\.length\}/);assert.doesNotMatch(page,/500/);});

test("students can explicitly sort the practice test picker by newest or oldest from the Choose a test landing page, not just whatever order the admin happened to publish tests in", async () => {
  const server = await read("lib/practice-navigator-server.ts");
  const navigator = await read("app/typing/practice/_components/practice-navigator.tsx");
  assert.match(server, /sort\?:"newest"\|"oldest"/);
  assert.match(server, /const oldest=filters\.sort==="oldest";/);
  assert.match(navigator, /const sort = params\.sort === "newest" \? "newest" : "oldest";/);
  assert.match(navigator, /if \(forSort === "newest"\) query\.set\("sort", "newest"\);/);
  assert.match(navigator, /role="group" aria-label="Sort tests"/);
});

// Real reported request: the in-workspace toolbar's Newest/Oldest toggle
// (next to the "Test N of M" dropdown) was redundant with the landing
// page's own Newest/Oldest sort and just added clutter/wrapping risk to an
// already-packed toolbar -- removed here, leaving the landing-page toggle
// (checked above) as the only place that sort choice lives. newestHref/
// oldestHref/sort were only ever computed to feed this removed toggle, so
// they're gone from PracticeNavigation and its construction too, not just
// hidden.
test("the in-workspace toolbar no longer shows a Newest/Oldest toggle next to the practice test navigator", async () => {
  const navigator = await read("app/typing/practice/_components/practice-navigator.tsx");
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.doesNotMatch(workspace, /Sort tests by/);
  assert.doesNotMatch(workspace, /practiceNavigation\.sort/);
  assert.doesNotMatch(workspace, /practiceNavigation\.newestHref/);
  assert.doesNotMatch(workspace, /practiceNavigation\.oldestHref/);
  assert.match(workspace, /export type PracticeNavigation=\{currentIndex:number;total:number;items:\{title:string;href:string;label:string\}\[\];previousHref:string\|null;nextHref:string\|null\};/);
  assert.doesNotMatch(navigator, /newestSlug/);
  assert.doesNotMatch(navigator, /oldestSlug/);
});
test("valid URL selections are retained and invalid selections fall back to the first stable item",()=>{const items=[{slug:"first"},{slug:"second"}];assert.deepEqual(resolvePracticeSelection(items,"second"),{selectedIndex:1,selected:items[1],fellBack:false});assert.deepEqual(resolvePracticeSelection(items,"missing"),{selectedIndex:0,selected:items[0],fellBack:true});assert.deepEqual(resolvePracticeSelection(items),{selectedIndex:0,selected:items[0],fellBack:true});assert.deepEqual(resolvePracticeSelection([],"missing"),{selectedIndex:0,selected:undefined,fellBack:true});});
test("English typing opens a canonical selected workspace without the pre-start page",async()=>{const route=await read("app/typing/practice/english/page.tsx"),navigator=await read("app/typing/practice/_components/practice-navigator.tsx"),workspace=await read("app/typing/_components/configurable-typing-exam.tsx");assert.match(route,/<PracticeNavigator language="English"/);assert.match(navigator,/if \(params\.test !== selected\.slug\) redirect\(queryFor\(selected\.slug\)\)/);assert.match(navigator,/customPreset directWorkspace/);assert.match(workspace,/useState\(directWorkspace\)/);assert.match(workspace,/if \(!started\) return <ExamStart/);});
test("Hindi requires input selection (unless there's only one to choose from) while both stenography routes use direct workspaces after selection",async()=>{const hindi=await read("app/typing/practice/hindi/page.tsx"),englishSteno=await read("app/typing/practice/english-stenography/page.tsx"),hindiSteno=await read("app/typing/practice/hindi-stenography/page.tsx");assert.match(hindi,/if\(params\.input\)return <PracticeNavigator language="Hindi" params=\{params\} requireInput\/>;/);assert.match(hindi,/if\(ids\.length===1\)return <PracticeNavigator language="Hindi" params=\{\{\.\.\.params,input:ids\[0\]\}\} requireInput\/>;/);assert.match(hindi,/return <HindiCatalogue/);assert.match(englishSteno,/<PracticeNavigator mode="stenography" language="English"/);assert.match(hindiSteno,/if\(params\.input\)return <PracticeNavigator mode="stenography" language="Hindi" params=\{params\} requireInput\/>;/);assert.match(hindiSteno,/if\(ids\.length===1\)return <PracticeNavigator mode="stenography" language="Hindi" params=\{\{\.\.\.params,input:ids\[0\]\}\} requireInput\/>;/);assert.match(hindiSteno,/return <HindiCatalogue/);});

test("only one Hindi input system exists for Practice today (Kruti Dev 010), so /typing/practice/hindi auto-skips the keyboard picker; the check re-derives ids from hindiInputSystemIds so it self-corrects the moment a second one is added",async()=>{const curriculum=await read("lib/typing-curriculum.ts");assert.match(curriculum,/return mode === "learn" \|\| mode === "practice" \? \[HINDI_KRUTI_DEV\] : HINDI_INPUT_SYSTEMS;/);const categories=await read("app/typing/practice/_components/category-catalogue.tsx");assert.match(categories,/export async function hindiInputSystemIds\(mode: ManagedTestMode\): Promise<string\[\]> \{/);});
test("empty catalogues render a polished route back to practice categories",async()=>{const navigator=await read("app/typing/practice/_components/practice-navigator.tsx");assert.match(navigator,/No compatible tests yet/);assert.match(navigator,/Back to Practice Categories/);assert.match(navigator,/href="\/typing\/practice"/);});
test("workspace selector is compact, number-only, and has accessible boundaries",async()=>{const workspace=await read("app/typing/_components/configurable-typing-exam.tsx");assert.match(workspace,/aria-label=\{`Select practice test\. Current:/);assert.match(workspace,/aria-label="Previous test"/);assert.match(workspace,/aria-label="Next test"/);assert.match(workspace,/>‹<\/button>/);assert.match(workspace,/>›<\/button>/);assert.match(workspace,/disabled=\{!practiceNavigation\.previousHref\}/);assert.match(workspace,/disabled=\{!practiceNavigation\.nextHref\}/);assert.match(workspace,/onChange=\{\(event\)=>onNavigateTest\(event\.target\.value\)\}/);assert.match(workspace,/title=\{item\.title\}>\{item\.label\}/);assert.doesNotMatch(workspace,/basis-full items-center justify-center/);assert.doesNotMatch(workspace,/>Previous<\/button>/);assert.doesNotMatch(workspace,/>Next<\/button>/);assert.match(workspace,/Changing tests will discard the active attempt/);assert.match(workspace,/practiceNavigation\?\.previousHref/);assert.match(workspace,/practiceNavigation\?\.nextHref/);});
test("practice header hides workspace branding and the toolbar has no repeated title or duration badge",async()=>{const workspace=await read("app/typing/_components/configurable-typing-exam.tsx");assert.match(workspace,/\{!practiceNavigation&&<div[^>]*>[\s\S]*?SAMRADHI CLASSES/);assert.match(workspace,/aria-label="Practice test navigation"/);assert.doesNotMatch(workspace,/>Duration <strong>/);assert.doesNotMatch(workspace,/title=\{preset\.title\}>\{preset\.title\}/);});
test("full viewport workspace keeps popup settings and both equal-height editors visible",async()=>{const workspace=await read("app/typing/_components/configurable-typing-exam.tsx");assert.match(workspace,/h-\[100dvh\]/);assert.match(workspace,/grid-rows-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);assert.match(workspace,/>Original Passage</);assert.match(workspace,/>Type Here</);assert.match(workspace,/TypingSettingsPopup/);assert.match(workspace,/pointerdown/);assert.match(workspace,/event\.key === "Escape"/);assert.doesNotMatch(workspace,/Settings drawer/);});
test("URL selection and saved attempt protections remain wired",async()=>{const page=await read("app/typing/practice/_components/practice-navigator.tsx"),workspace=await read("app/typing/_components/configurable-typing-exam.tsx");assert.match(page,/query\.set\("test", slug\)/);assert.match(workspace,/practice-attempt-active/);assert.match(workspace,/recordManagedAttempt/);assert.match(workspace,/useTypingPlatformSettings/);});
test("direct workspace waits for the first keystroke before timing or active-attempt warnings",async()=>{const workspace=await read("app/typing/_components/configurable-typing-exam.tsx");assert.match(workspace,/const \[endTimestamp, setEndTimestamp\] = useState<number \| null>\(null\)/);assert.match(workspace,/const \[timerStarted, setTimerStarted\] = useState\(false\)/);assert.match(workspace,/const beginTiming = \(\) => \{ if \(timerStarted\) return;/);assert.match(workspace,/onFirstTypingInput=\{beginTiming\}/);assert.match(workspace,/if \(value !== typedText\) onFirstTypingInput\(\)/);assert.match(workspace,/if\(timerStarted&&!finished&&!window\.confirm/);});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { detectHindiTextFormat } from "../lib/hindi-font-converter.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported bug: an admin, typing in Kruti Dev keystrokes out of habit
// (not the actual Hindi word), typed the raw legacy keys for "घोड़ा" straight
// into the WordTris admin's Word field -- and even mistyped the keystrokes
// (missing one key), so the "Student preview" showed a completely different,
// wrong word ("घेड़ा" instead of "घोड़ा"). detectHindiTextFormat is what the
// manager now checks before allowing Save; this pins down that the exact
// reported bad input is caught (detected as neither real Unicode nor a
// recognized Kruti Dev signal -- "unknown" -- which is exactly why it isn't
// covered by the existing krutidev/mixed-only encodingValidationMessage
// check the main passage editor uses, and needs its own, stricter gate for
// a field that only ever means "a real Hindi word").
test("detectHindiTextFormat flags the exact reported bad WordTris entry (raw, even incomplete, Kruti Dev keystrokes) as not real Hindi Unicode text", () => {
  assert.equal(detectHindiTextFormat("?ksM+k"), "unknown");
  assert.equal(detectHindiTextFormat("घोड़ा"), "unicode");
});

test("the WordTris admin page is gated by requireAdmin and falls back to bundled word lists when the DB isn't ready", async () => {
  const page = await read("app/admin/wordtris-words/page.tsx");
  assert.match(page, /await requireAdmin\(\);/);
  assert.match(page, /admin_list_wordtris_words/);
  assert.match(page, /BUNDLED_WORDS, CATEGORIES/);
  assert.match(page, /dbReady \? data : BUNDLED/);
});

test("the WordTris admin actions require an admin and route through the security-definer RPCs", async () => {
  const actions = await read("app/admin/wordtris-words/actions.ts");
  assert.match(actions, /await requireAdmin\(\);/g);
  assert.match(actions, /admin_save_wordtris_word/);
  assert.match(actions, /admin_delete_wordtris_word/);
});

test("the WordTris game requires a student session (inherited from app/typing/layout.tsx) and never trusts a client-reported score", async () => {
  const page = await read("app/typing/games/wordtris/page.tsx");
  assert.match(page, /getWordtrisWords/);
  const actions = await read("app/typing/games/wordtris/actions.ts");
  assert.match(actions, /await requireStudent\(\);/g);
  // the RPC (not the client) computes the final score row; this action's
  // job is only to sanity-check and forward it, matching
  // recordManagedAttempt's "never trust the client's own number" precedent.
  assert.match(actions, /submit_wordtris_score/);
  assert.match(actions, /Math\.max\(0, Math\.round\(score\)\)/);
});

// Real requested removal: the admin no longer wants the read-only
// "Preview: X" pages cluttering the admin dashboard (they test with a
// real student account instead), so every /admin/preview/* route was
// deleted, and previewMode (which only ever existed to keep those pages
// from being redirected out by the student-gated score/leaderboard
// calls) was removed from WordtrisGame entirely.
test("the WordTris admin dashboard no longer links to a preview route, and WordtrisGame has no previewMode escape hatch", async () => {
  const dashboard = await read("app/admin/page.tsx");
  assert.doesNotMatch(dashboard, /admin\/preview\/wordtris/);
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.doesNotMatch(game, /previewMode/);
});

// Real reported request: an explicit, continuous ADAPTIVE speed curve --
// one clearly defined speed state (WPM), nudged by a small PERCENTAGE on
// every single catch (+3%) or miss (-12%), replacing the milestone ladder
// this used to be (flat until the 7th catch in a row, then a jump).
// Min/start/max bound it; the two factors shape it -- five constants are
// the entire curve. Six missed drops (not five) still end the round.
test("the difficulty curve is a continuous percentage-based adaptive speed: +3% per catch, -12% per miss, bounded by min/start/max, six lives", async () => {
  const content = await read("lib/wordtris-content.ts");
  assert.match(content, /WORDTRIS_START_WPM = 15/);
  assert.match(content, /WORDTRIS_MIN_WPM = 10/);
  assert.match(content, /WORDTRIS_MAX_WPM = 30/);
  assert.match(content, /WORDTRIS_CATCH_SPEEDUP_FACTOR = 1\.03/);
  assert.match(content, /WORDTRIS_MISS_SLOWDOWN_FACTOR = 0\.88/);
  assert.match(content, /WORDTRIS_STARTING_LIVES = 6/);
  assert.match(content, /export function wordtrisFallMs\(text: string, wpm: number, mode: WordtrisMode\)/);
  assert.match(content, /export function wordtrisSpeedUpOnCatch\(currentWpm: number\): number \{\s*\n\s*return Math\.min\(WORDTRIS_MAX_WPM, currentWpm \* WORDTRIS_CATCH_SPEEDUP_FACTOR\);/);
  assert.match(content, /export function wordtrisSlowDownOnMiss\(currentWpm: number\): number \{\s*\n\s*return Math\.max\(WORDTRIS_MIN_WPM, currentWpm \* WORDTRIS_MISS_SLOWDOWN_FACTOR\);/);
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /const next = wordtrisSpeedUpOnCatch\(wpmRef\.current\);/); // speeds up every catch
  assert.match(game, /const eased = wordtrisSlowDownOnMiss\(wpmRef\.current\);/); // eases off on miss
  assert.match(game, /const fallMs = wordtrisFallMs\(target, wpmRef\.current, m\);/);
});

// Real reported reference (a screen recording of an existing typing-rain
// game): only one word falls at a time, dead center -- not several
// concurrent lanes as an earlier iteration had -- and the next one spawns
// a short beat after the current one resolves (caught or missed), never
// while one is still active.
test("only one drop is ever active at a time, and the next one spawns shortly after the field is clear", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /const \[activeDrop, setActiveDrop\] = useState<ActiveDrop \| null>\(null\);/);
  assert.match(game, /if \(activeDropRef\.current\) return;/);
  assert.match(game, /if \(step !== "playing" \|\| activeDrop \|\| awaitingFirstKey\) return;/);
  assert.match(game, /window\.setTimeout\(\(\) => spawnDrop\(mode, language\), NEXT_DROP_DELAY_MS\);/);
});

// Real reported request: clicking Start used to drop the first word the
// instant the play field appeared. Now it waits, showing "Press any key
// to start", until the student's own first real keystroke (a lone
// modifier like Shift doesn't count) -- confirmed here by the spawn
// effect's own added guard and the keydown handler that clears it.
test("the first drop doesn't fall until the student's first keystroke, not the instant Start is clicked", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /const \[awaitingFirstKey, setAwaitingFirstKey\] = useState\(false\);/);
  assert.match(game, /setAwaitingFirstKey\(true\);\s*\n\s*setStep\("playing"\);/); // startRound arms it
  assert.match(game, /if \(awaitingFirstKey && !MODIFIER_ONLY_KEYS\.has\(event\.key\)\) \{/);
  assert.match(game, /Press any key to start/);
});

// Real reported bug: the exact keystroke that started the round was
// silently thrown away every single time. setAwaitingFirstKey(false)
// only SCHEDULES a state update -- the spawn effect that actually
// creates the drop doesn't run until after that render commits, ~250ms
// later. But the browser fires this keydown, then the input's own value
// change and onChange, synchronously in the very same event dispatch --
// all before any of that. So the starting keystroke always arrived
// while activeDropRef.current was still null, isValidPrefix rejected
// it, and React's controlled input reverted it to blank -- confirmed
// live (dispatched the real keydown-then-input sequence and watched the
// value snap back to ""). Fixed by spawning the first drop
// SYNCHRONOUSLY in the keydown handler (via the ref, not the delayed
// effect), so the exact keystroke that starts the round lands on a drop
// that already exists by the time the input's own change handler runs
// immediately afterward.
test("the starting keystroke spawns the first drop synchronously (via the ref), so that same keystroke can be validated against it instead of being silently discarded", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /if \(awaitingFirstKey && !MODIFIER_ONLY_KEYS\.has\(event\.key\)\) \{\s*\n\s*setAwaitingFirstKey\(false\);\s*\n\s*spawnDrop\(mode, language\);\s*\n\s*\}/);
});

// Real reported request, follow-up: starting speed and the per-catch/
// per-miss speed adjustment were briefly made setup-screen settings, then
// explicitly asked to be removed again -- both are fixed in code now
// (WORDTRIS_START_WPM, WORDTRIS_CATCH_SPEEDUP_FACTOR / WORDTRIS_MISS_
// SLOWDOWN_FACTOR), with no setup-screen control for either.
test("starting speed and the per-catch/per-miss speed adjustment are fixed in code, with no setup-screen control for either", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /wpmRef\.current = WORDTRIS_START_WPM;/);
  assert.match(game, /const next = wordtrisSpeedUpOnCatch\(wpmRef\.current\);/);
  assert.doesNotMatch(game, /Starting speed</);
  assert.doesNotMatch(game, /Speed up every…</);
  assert.doesNotMatch(game, /setStartingWpm/);
  assert.doesNotMatch(game, /setCatchesPerMilestone/);
});

// Real reported request: the separate bordered "type here" input box is
// gone -- the enlarged readout below the bucket is now the visible
// typing surface, showing the FULL word with the typed-so-far portion
// changed to a different COLOR (not removed from view), clearing only
// once the word is actually caught. The real input still exists (needed
// to reliably capture keystrokes/mobile keyboards) but is visually
// hidden, not shown as its own box.
test("the falling word's readout below the bucket shows the full word with typed letters colored, not truncated, and there's no separate visible input box", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /<span className="text-emerald-600">\{activeDrop\.target\.slice\(0, typedLength\)\}<\/span>/);
  assert.match(game, /<span className="text-slate-900">\{activeDrop\.target\.slice\(typedLength\)\}<\/span>/);
  assert.doesNotMatch(game, /border-2 border-slate-200 p-3 text-lg outline-none focus:border-slate-500/); // the old visible input box styling
  assert.match(game, /className="absolute h-px w-px overflow-hidden whitespace-nowrap opacity-0"/); // the real input, now visually hidden
});

// Real reported follow-up: the readout was sized too big at first pass --
// roughly halved (min-h-24 -> min-h-12, text-4xl/sm:text-5xl ->
// text-xl/sm:text-2xl) and capped with a max-w so it stays proportionate
// instead of stretching edge to edge at every viewport width.
test("the readout stays capped with a max-width so it stays proportionate at every screen size", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /min-h-4 w-full max-w-\[10rem\]/);
  assert.doesNotMatch(game, /flex min-h-24 w-full/); // the original, oversized box
  assert.doesNotMatch(game, /flex min-h-12 w-full max-w-sm/); // the first (still too big) size cut
  assert.doesNotMatch(game, /flex min-h-8 w-full max-w-\[12rem\]/); // the second (still too big) size cut
  assert.doesNotMatch(game, /text-4xl font-black outline-none/); // the original, oversized text
});

// Real requested feature: the readout was too small to read comfortably
// in either language, and should be resizable by the student rather than
// fixed. A student-facing A-/A+ stepper (matching the pattern already
// used in app/typing/practice/error-drill/error-drill-practice.tsx)
// adjusts an inline font-size in px, defaulting noticeably larger than
// the old fixed text-xs/sm:text-sm (12-14px).
test("the falling-word readout has a student-adjustable font size (A-/A+ stepper), defaulting larger than the old fixed size, applied via inline style so it works in both languages", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /const READOUT_MIN_FONT_PX = 14;/);
  assert.match(game, /const READOUT_MAX_FONT_PX = 32;/);
  assert.match(game, /const READOUT_DEFAULT_FONT_PX = 20;/);
  assert.match(game, /const \[readoutFontSize, setReadoutFontSize\] = useState\(READOUT_DEFAULT_FONT_PX\);/);
  assert.match(game, /aria-label="Decrease word text size"/);
  assert.match(game, /aria-label="Increase word text size"/);
  assert.match(game, /style=\{\{ fontFamily, fontSize: `\$\{readoutFontSize\}px` \}\}/);
});

// Real reported risk: the keystroke-capturing input is a visually 1px
// hidden element -- if it ever loses focus mid-round (a stray click, a
// device that's picky about focusing an invisible input), every
// subsequent keystroke would silently go nowhere, looking exactly like
// "I typed a key and the word just sat there / reset". Refocus it
// immediately on blur, for as long as a round is in progress.
test("the hidden keystroke-capturing input refocuses itself immediately if it ever loses focus mid-round", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /const refocus = \(\) => requestAnimationFrame\(\(\) => inputRef\.current\?\.focus\(\)\);/);
  assert.match(game, /input\.addEventListener\("blur", refocus\);/);
  assert.match(game, /return \(\) => input\.removeEventListener\("blur", refocus\);/);
});

// Real reported request, with a red box drawn over a screenshot marking
// the target size: the whole bucket/play-field assembly (clouds, rim,
// rain lane, base plate) was too big. Wrapped the whole assembly in one
// shared, centered max-width so every percentage-sized piece inside (the
// rim, base plate) shrinks together proportionately instead of the rim
// ending up wider than a separately-shrunk rain lane, and cut the rain
// lane's own height roughly in half.
test("the whole bucket assembly (clouds, rim, rain lane, base plate) is wrapped in one shared max-width, and the rain lane's height is cut roughly in half", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /<div className="mx-auto max-w-64">/);
  assert.match(game, /wordtris-rain-lane relative h-64 overflow-hidden rounded-\[2rem\] ring-1 ring-slate-700 transition sm:h-80/);
  assert.doesNotMatch(game, /rain-lane relative h-\[28rem\]/); // the original, oversized rain lane
  assert.doesNotMatch(game, /transition sm:h-\[34rem\]/);
});

// Real reported reference: each miss labels its own layer at the bottom
// of the bucket, one layer per life lost, sized so six stacked misses
// exactly fill it (matches WORDTRIS_STARTING_LIVES).
test("a missed word stacks up as a labeled layer in the bucket, sized so six of them exactly fill it", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /setMissedStack\(\(s\) => \[\.\.\.s, \{ id: missed\.id, text: missed\.target \}\]\);/);
  assert.match(game, /style=\{\{ height: `\$\{100 \/ startingLives\}%`, fontFamily \}\}/);
  assert.match(game, /flex-col-reverse/); // oldest miss stays at the floor, newest piles on top
});

// Real reported request: missed words used to stack up as flat grey
// blocks -- now rendered as rising water filling the bucket, one sixth
// per miss, with a wavy surface at the current level, matching the
// game's own rain/bucket theme.
test("missed words render as rising water (a continuous gradient sized to the miss count, with a wavy surface), not flat grey blocks", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /\{missedStack\.length > 0 && \(/);
  assert.match(game, /bg-gradient-to-b from-cyan-400\/85 via-cyan-600\/90 to-cyan-800\/95/);
  assert.match(game, /style=\{\{ height: `\$\{\(missedStack\.length \/ startingLives\) \* 100\}%` \}\}/);
  assert.match(game, /<path d="M0,4 Q10,0 20,4 T40,4 T60,4 T80,4 T100,4 V8 H0 Z" fill="currentColor" \/>/); // the wavy water surface
  assert.doesNotMatch(game, /border-t border-slate-400\/50 bg-slate-300\/95/); // the old flat grey blocks
});

// Real bug found and fixed during review: resetting a drop's position on
// mount must not itself animate (CSS transitions fire on any style
// change, not just the fall) -- only the actual fall from top to bottom
// should be animated.
test("each drop's position is set instantly on mount (no transition); only the actual fall animates", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /transition: falling \? `top \$\{drop\.fallMs\}ms linear` : "none"/);
});

test("WordTris is wired into the Typing Hub and the admin dashboard nav", async () => {
  const hub = await read("app/typing/page.tsx");
  assert.match(hub, /href: "\/typing\/games"/);
  assert.match(hub, /Eight focused typing areas/);
  const admin = await read("app/admin/page.tsx");
  assert.match(admin, /\/admin\/wordtris-words/);
});

test("the leaderboard is scoped per (language, category), never compared across categories with different point values", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /getWordtrisLeaderboard\(language, category, leaderboardLimit\)/);
});

// Real reported request: WordTris only drilled whole words; single
// keystrokes need a faster, separate difficulty curve and real,
// already-verified keyboard content -- not a new hand-typed character
// list (the same class of byte-collision bug hindi-font-converter.ts
// keeps finding).
test("character mode's key pool is the admin-configurable characterPool prop (which itself defaults to the Kruti Dev / English tutor keyboards' own GLYPH_KEYS -- see character-pool-content.ts), and has its own (smaller) reading buffer", async () => {
  const content = await read("lib/wordtris-content.ts");
  assert.match(content, /WORDTRIS_READING_BUFFER_MS: Record<WordtrisMode, number> = \{ word: 1200, character: 400 \};/);
  const poolContent = await read("lib/character-pool-content.ts");
  assert.match(poolContent, /GLYPH_KEYS as HINDI_GLYPH_KEYS \} from "\.\/krutidev-tutor-content\.ts"/);
  assert.match(poolContent, /GLYPH_KEYS as ENGLISH_GLYPH_KEYS \} from "\.\/english-tutor-content\.ts"/);
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  // mode (m) is passed through to wordtrisFallMs, which is what actually
  // selects the per-mode reading buffer (see the curve test above).
  assert.match(game, /const fallMs = wordtrisFallMs\(target, wpmRef\.current, m\);/);
});

// Character mode's Hindi content is already raw, typeable Kruti Dev bytes
// (unlike word mode's Unicode word banks) -- converting it again through
// toTypeableKrutiDev would mangle it, so the conversion must stay scoped
// to word mode only.
test("character mode's Hindi pool bypasses toTypeableKrutiDev -- only word mode's Unicode word banks need that conversion", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /if \(m === "word" && lang === "hindi"\) \{\s*\n\s*const verified = category === "common" \? getVerifiedHindiCommonKeys\(raw\) : undefined;\s*\n\s*if \(verified\) return verified;\s*\n\s*try \{ return toTypeableKrutiDev\(raw\); \}/);
});

// Character mode has no server-side leaderboard (its scores aren't
// comparable to the word-category point scheme the real leaderboard is
// scoped by) -- confirms it never calls the scoring RPCs, and instead
// keeps a personal best client-side.
test("character mode never calls the word-mode leaderboard/score RPCs, and keeps a personal best in localStorage instead", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /if \(mode === "word"\) \{\s*\n\s*void submitWordtrisScore/);
  assert.match(game, /wordtris-best-character-\$\{language\}/);
});

test("the WordTris admin word manager blocks Save when a Hindi word doesn't detect as real Unicode text, warning that it looks like raw Kruti Dev keystrokes", async () => {
  const manager = await read("app/admin/wordtris-words/wordtris-words-manager.tsx");
  assert.match(manager, /import \{ detectHindiTextFormat, toTypeableKrutiDev \} from "@\/lib\/hindi-font-converter";/);
  assert.match(manager, /detectHindiTextFormat\(liveWord\) !== "unicode"/);
  assert.match(manager, /disabled=\{savePending \|\| Boolean\(hindiWordWarning\)\}/);
  assert.match(manager, /\{hindiWordWarning && <p role="alert"/);
});

// Real reported bug: opening the edit dialog for one word showed a green
// "Word saved." message alongside the red validation warning, looking
// exactly like the currently-open (invalid) word had just been saved --
// it hadn't; Save was correctly disabled the whole time. saveState lives
// in the parent, not the dialog, so a SUCCESS message from an EARLIER
// save (a different word, an earlier open/close of this same dialog)
// stayed truthy and got rendered again the instant any new dialog
// opened. Fixed by only showing feedback once THIS dialog has actually
// submitted, reset every time a (possibly different) dialog opens.
test("stale Save feedback from a previous edit doesn't bleed into a newly opened dialog for a different word", async () => {
  const manager = await read("app/admin/wordtris-words/wordtris-words-manager.tsx");
  assert.match(manager, /const \[dialogSubmitted, setDialogSubmitted\] = useState\(false\);/);
  assert.match(manager, /setDialogSubmitted\(false\);\s*\n\s*\}, \[editing\]\);/);
  assert.match(manager, /onSubmit=\{\(\) => setDialogSubmitted\(true\)\}/);
  assert.match(manager, /\{dialogSubmitted && <Feedback state=\{saveState\} \/>\}/);
});

// Real reported gap: a multi-word word-bank entry ("दमकल गाड़ी", "पानी का
// टैंकर", ...) could never be caught in play. Space always meant "submit
// now", so finishing the first word and pressing Space to continue typing
// the second word submitted a (mismatched) incomplete answer instead of
// typing the space. Fixed by only treating Space as submit when the typed
// text is already a complete match, or when a space wouldn't continue
// toward the target at all -- otherwise it's a real mid-phrase space and
// is left to type normally.
test("WordTris lets Space type as a normal character mid-phrase (multi-word entries), only treating it as submit on a complete match or a genuinely wrong guess", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /const isCompleteMatch = Boolean\(activeDrop\) && isExactKrutiDevMatch\(normalize\(typed\), dropText\(activeDrop!\)\);/);
  assert.match(game, /const continuesPhrase = Boolean\(activeDrop\) && typed\.length > 0 && isValidPrefix\(`\$\{typed\} `\);/);
  assert.match(game, /if \(!isCompleteMatch && continuesPhrase\) return;/);
});

// Real reported bug: pressing Space as the very first keystroke (a
// natural way to answer "Press any key to start") used to slip through
// the same multi-word "continues the phrase" branch above with
// typed="" -- isValidPrefix treats an all-whitespace value as trivially
// valid, so the browser's native space-insertion wasn't prevented, and a
// literal " " got stored into `typed`. Every real letter typed after
// that was rejected as an invalid continuation of " ", which no target
// starts with -- the exact "type the first key, then can't type
// anything else" report. Requiring typed.length > 0 before a space can
// "continue a phrase" closes this.
test("WordTris does not let a bare Space (typed is still empty) fall through as a phrase-continuation and silently poison further typing", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /const continuesPhrase = Boolean\(activeDrop\) && typed\.length > 0 && isValidPrefix/);
});

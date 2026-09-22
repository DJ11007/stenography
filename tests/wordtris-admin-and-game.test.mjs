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

// Real reported request: the old ms-based curve (fixed base time shrinking
// by a constant exponential factor per catch) had no relationship to a
// real typing speed and felt too fast from the first drop. Replaced with
// an explicit WPM milestone ladder: starts at the first milestone, every
// WORDTRIS_CATCHES_PER_MILESTONE catches in a row advances to the next
// rung, and a miss instead backs the WPM off by WORDTRIS_MISS_WPM_PENALTY
// and restarts that catch count -- six missed drops (not five) end the
// round either way.
test("the difficulty curve is an explicit WPM milestone ladder -- starts slow, advances every 7 catches, eases off 3 WPM on a miss, six lives", async () => {
  const content = await read("lib/wordtris-content.ts");
  assert.match(content, /WORDTRIS_WPM_MILESTONES = \[15, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30\]/);
  assert.match(content, /WORDTRIS_CATCHES_PER_MILESTONE = 7/);
  assert.match(content, /WORDTRIS_MISS_WPM_PENALTY = 3/);
  assert.match(content, /WORDTRIS_STARTING_LIVES = 6/);
  assert.match(content, /export function wordtrisFallMs\(text: string, wpm: number, mode: WordtrisMode\)/);
  assert.match(content, /export function wordtrisNextMilestone\(currentWpm: number\)/);
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /catchesSinceBumpRef\.current \+= 1;/); // ramps up every N catches
  assert.match(game, /const eased = Math\.max\(WORDTRIS_MIN_WPM, wpmRef\.current - WORDTRIS_MISS_WPM_PENALTY\);/); // eases off on miss
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
  assert.match(game, /if \(awaitingFirstKey && !MODIFIER_ONLY_KEYS\.has\(event\.key\)\) setAwaitingFirstKey\(false\);/);
  assert.match(game, /Press any key to start/);
});

// Real reported request, follow-up: starting speed and the speed-up
// interval were briefly made setup-screen settings, then explicitly
// asked to be removed again -- both are fixed in code now
// (WORDTRIS_WPM_MILESTONES[0], WORDTRIS_CATCHES_PER_MILESTONE), with no
// setup-screen control for either.
test("starting speed and the speed-up interval are fixed in code, with no setup-screen control for either", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /wpmRef\.current = WORDTRIS_WPM_MILESTONES\[0\];/);
  assert.match(game, /if \(catchesSinceBumpRef\.current >= WORDTRIS_CATCHES_PER_MILESTONE\) \{/);
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
test("the readout is a small pill (a quarter of its original size), capped with a max-width so it stays proportionate at every screen size", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /min-h-4 w-full max-w-\[6rem\]/);
  assert.match(game, /text-xs font-black outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-blue-500 sm:text-sm/);
  assert.doesNotMatch(game, /flex min-h-24 w-full/); // the original, oversized box
  assert.doesNotMatch(game, /flex min-h-12 w-full max-w-sm/); // the first (still too big) size cut
  assert.doesNotMatch(game, /flex min-h-8 w-full max-w-\[12rem\]/); // the second (still too big) size cut
  assert.doesNotMatch(game, /text-4xl font-black outline-none/); // the original, oversized text
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

// Real reported reference: missed words stack up as their own labeled
// block at the bottom of the bucket (like the reference game), one block
// per life lost -- not a continuous fill level -- so six stacked misses
// exactly fill it (matches WORDTRIS_STARTING_LIVES).
test("a missed word stacks up as a labeled block in the bucket, sized so six of them exactly fill it", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /setMissedStack\(\(s\) => \[\.\.\.s, \{ id: missed\.id, text: missed\.target \}\]\);/);
  assert.match(game, /style=\{\{ height: `\$\{100 \/ startingLives\}%`, fontFamily \}\}/);
  assert.match(game, /flex-col-reverse/); // oldest miss stays at the floor, newest piles on top
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
  assert.match(game, /if \(m === "word" && lang === "hindi"\) \{\s*\n\s*try \{ return toTypeableKrutiDev\(raw\); \}/);
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
  assert.match(game, /const isCompleteMatch = Boolean\(activeDrop\) && dropText\(activeDrop!\) === normalize\(typed\);/);
  assert.match(game, /const continuesPhrase = Boolean\(activeDrop\) && isValidPrefix\(`\$\{typed\} `\);/);
  assert.match(game, /if \(!isCompleteMatch && continuesPhrase\) return;/);
});

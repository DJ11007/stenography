import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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
  assert.match(game, /if \(step !== "playing" \|\| activeDrop\) return;/);
  assert.match(game, /window\.setTimeout\(\(\) => spawnDrop\(mode, language\), NEXT_DROP_DELAY_MS\);/);
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
test("character mode reuses the Kruti Dev / English tutor keyboards' own GLYPH_KEYS, not a new hand-typed list, and has its own (smaller) reading buffer", async () => {
  const content = await read("lib/wordtris-content.ts");
  assert.match(content, /WORDTRIS_READING_BUFFER_MS: Record<WordtrisMode, number> = \{ word: 1200, character: 400 \};/);
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /GLYPH_KEYS as HINDI_GLYPH_KEYS \} from "@\/lib\/krutidev-tutor-content"/);
  assert.match(game, /GLYPH_KEYS as ENGLISH_GLYPH_KEYS \} from "@\/lib\/english-tutor-content"/);
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

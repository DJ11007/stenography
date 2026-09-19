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

// Locks in the difficulty curve the admin explicitly asked for: ease off
// after a miss, then ramp back up on a catch streak, floored so it never
// becomes unfair.
test("the difficulty curve eases off after a miss and ramps up on a catch streak, with a speed floor", async () => {
  const content = await read("lib/wordtris-content.ts");
  assert.match(content, /startingLives: 5/);
  assert.match(content, /speedUpFactor: 0\.92/);
  assert.match(content, /missBreatherFactor: 1\.2/);
  assert.match(content, /minFallMs: 1800/);
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /Math\.max\(minFallMs, fallMs \* speedUpFactor\)/);
  assert.match(game, /Math\.min\(baseFallMs, fallMs \* missBreatherFactor\)/);
});

// Real bug found and fixed during review: resetting the falling word's
// position between catches must not itself animate (CSS transitions fire
// on any style change, not just the fall), or every catch would look like
// the word floats back up before falling again.
test("the falling word's position reset is instant (no transition) between words, only the actual fall animates", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /transition: falling \? `top \$\{fallMs\}ms linear` : "none"/);
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
test("character mode reuses the Kruti Dev / English tutor keyboards' own GLYPH_KEYS, not a new hand-typed list, and has its own faster difficulty curve", async () => {
  const content = await read("lib/wordtris-content.ts");
  assert.match(content, /WORDTRIS_CHARACTER_DIFFICULTY/);
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /GLYPH_KEYS as HINDI_GLYPH_KEYS \} from "@\/lib\/krutidev-tutor-content"/);
  assert.match(game, /GLYPH_KEYS as ENGLISH_GLYPH_KEYS \} from "@\/lib\/english-tutor-content"/);
  assert.match(game, /mode === "character" \? WORDTRIS_CHARACTER_DIFFICULTY : WORDTRIS_DIFFICULTY/);
});

// Character mode's Hindi content is already raw, typeable Kruti Dev bytes
// (unlike word mode's Unicode word banks) -- converting it again through
// toTypeableKrutiDev would mangle it, so the conversion must stay scoped
// to word mode only.
test("character mode's Hindi pool bypasses toTypeableKrutiDev -- only word mode's Unicode word banks need that conversion", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /mode === "word" && language === "hindi" \? \(\(\) => \{ try \{ return toTypeableKrutiDev\(currentItem\)/);
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

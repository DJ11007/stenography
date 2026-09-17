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

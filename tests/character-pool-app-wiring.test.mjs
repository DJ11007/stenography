import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEFAULT_CHARACTER_POOL } from "../lib/character-pool-content.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature: WordTris's Character mode and Key Hunter both
// unconditionally drilled every key on the Kruti Dev / English tutor
// keyboards, with no admin control over which keys are actually
// practiced. Both now receive their pool as a server-fetched prop
// (falling back to the exact same full-keyboard set as before) instead
// of importing GLYPH_KEYS and building it themselves.
test("WordtrisGame and KeyHunterGame both receive characterPool as a prop instead of building it from GLYPH_KEYS themselves", async () => {
  const wordtrisGame = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.doesNotMatch(wordtrisGame, /GLYPH_KEYS/);
  assert.match(wordtrisGame, /characterPool: Record<CharacterPoolLanguage, CharacterPoolForLanguage>/);

  const keyHunterGame = await read("app/typing/games/key-hunter/key-hunter-game.tsx");
  assert.doesNotMatch(keyHunterGame, /GLYPH_KEYS/);
  assert.match(keyHunterGame, /Props = \{ characterPool: Record<CharacterPoolLanguage, CharacterPoolForLanguage> \}/);
  assert.match(keyHunterGame, /const pool = characterPool\[language\]\.keys;/);
});

test("both games' page.tsx server components fetch the character pool via getCharacterPool() and pass it down", async () => {
  const wordtrisPage = await read("app/typing/games/wordtris/page.tsx");
  assert.match(wordtrisPage, /import \{ getCharacterPool \} from "@\/lib\/character-pool-server";/);
  assert.match(wordtrisPage, /<WordtrisGame words=\{words\} characterPool=\{characterPool\} \/>/);

  const keyHunterPage = await read("app/typing/games/key-hunter/page.tsx");
  assert.match(keyHunterPage, /import \{ getCharacterPool \} from "@\/lib\/character-pool-server";/);
  assert.match(keyHunterPage, /<KeyHunterGame characterPool=\{characterPool\} \/>/);
});

test("getCharacterPool falls back to DEFAULT_CHARACTER_POOL (sequential: false) per language when the RPC errors or returns nothing, and marks a configured language sequential: true", async () => {
  const server = await read("lib/character-pool-server.ts");
  assert.match(server, /hindi: \{ keys: DEFAULT_CHARACTER_POOL\.hindi, sequential: false \},/);
  assert.match(server, /english: \{ keys: DEFAULT_CHARACTER_POOL\.english, sequential: false \},/);
  assert.match(server, /result\[language\] = \{ keys: data as string\[\], sequential: true \};/);
});

// Real requested feature: an admin who builds an explicit, ordered key
// list wants WordTris's Character mode to introduce those keys in
// exactly that sequence -- not shuffled, the way every other pool
// (word mode, and character mode's own untouched default) already is.
// Key Hunter is deliberately unaffected: it always adapts to the
// student's own weakest key next (keyHunterPickNext), regardless of any
// list order, so ordering only ever changes WordTris's behavior.
test("WordTris's Character mode plays a sequential (admin-ordered) pool back in exact order, looping without reshuffling, but still shuffles the untouched default pool", async () => {
  const game = await read("app/typing/games/wordtris/wordtris-game.tsx");
  assert.match(game, /const poolSequentialRef = useRef\(false\);/);
  assert.match(game, /if \(!poolSequentialRef\.current\) poolRef\.current = shuffledPool\(poolRef\.current\);/);
  assert.match(game, /const sequential = m === "character" && characterPool\[lang\]\.sequential;/);
  assert.match(game, /poolSequentialRef\.current = sequential;/);
  assert.match(game, /const basePool = m === "character" \? characterPool\[lang\]\.keys : words\[lang\]\[cat\];/);
  assert.match(game, /poolRef\.current = sequential \? \[\.\.\.basePool\] : shuffledPool\(basePool\);/);
});

test("the admin character-pool page is gated by requireAdmin, and is wired into the admin dashboard's Games section", async () => {
  const page = await read("app/admin/character-pool/page.tsx");
  assert.match(page, /await requireAdmin\(\);/);
  assert.match(page, /admin_list_character_pool_config/);
  const actions = await read("app/admin/character-pool/actions.ts");
  assert.match(actions, /await requireAdmin\(\);/);
  assert.match(actions, /admin_save_character_pool_config/);
  const dashboard = await read("app/admin/page.tsx");
  assert.match(dashboard, /\/admin\/character-pool/);
});

// Real reported gap: DEFAULT_CHARACTER_POOL used to keep only each key's
// unshifted byte, so Hindi's half-letters (Shift+D/R/T/U/L -- क्/त्/ज्/न्/स्,
// KEY_LESSONS l14) and conjuncts (Shift+Z/[/J/K -- र्/क्ष्/श्र/ज्ञ, l15)
// could never appear in WordTris's Character mode or Key Hunter -- an
// admin building a drill list on /admin/character-pool had no way to add
// them because they were never even offered as options.
test("DEFAULT_CHARACTER_POOL includes shifted bytes too (half-letters and conjuncts), not just each key's unshifted byte", () => {
  for (const halfLetterOrConjunct of ["D", "R", "T", "U", "L", "Z", "{", "J", "K"]) {
    assert.ok(DEFAULT_CHARACTER_POOL.hindi.includes(halfLetterOrConjunct), `expected Hindi pool to include "${halfLetterOrConjunct}"`);
  }
  // still includes the plain, unshifted bytes -- this is additive, not a replacement
  for (const plain of ["d", "j", "k", "g", "l"]) {
    assert.ok(DEFAULT_CHARACTER_POOL.hindi.includes(plain), `expected Hindi pool to still include "${plain}"`);
  }
  assert.ok(DEFAULT_CHARACTER_POOL.english.includes("D")); // English shift bytes (capitals/punctuation) are equally affected
});

test("the admin character-pool manager builds an ORDERED list (up/down/remove), not an unordered checkbox grid, and submits it as ordered hidden inputs", async () => {
  const manager = await read("app/admin/character-pool/character-pool-manager.tsx");
  assert.match(manager, /const \[ordered, setOrdered\] = useState<string\[\]>\(initialKeys\);/);
  assert.match(manager, /\{ordered\.map\(\(key\) => <input key=\{key\} type="hidden" name="key" value=\{key\} \/>\)\}/);
  assert.match(manager, /const move = \(index: number, delta: number\) =>/);
  assert.doesNotMatch(manager, /type="checkbox"/);
});

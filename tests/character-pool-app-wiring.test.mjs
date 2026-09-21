import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  assert.match(wordtrisGame, /characterPool: Record<CharacterPoolLanguage, string\[\]>/);
  assert.match(wordtrisGame, /characterPool\[lang\] : words\[lang\]\[cat\]/);

  const keyHunterGame = await read("app/typing/games/key-hunter/key-hunter-game.tsx");
  assert.doesNotMatch(keyHunterGame, /GLYPH_KEYS/);
  assert.match(keyHunterGame, /Props = \{ characterPool: Record<CharacterPoolLanguage, string\[\]> \}/);
  assert.match(keyHunterGame, /const pool = characterPool\[language\];/);
});

test("both games' page.tsx server components fetch the character pool via getCharacterPool() and pass it down", async () => {
  const wordtrisPage = await read("app/typing/games/wordtris/page.tsx");
  assert.match(wordtrisPage, /import \{ getCharacterPool \} from "@\/lib\/character-pool-server";/);
  assert.match(wordtrisPage, /<WordtrisGame words=\{words\} characterPool=\{characterPool\} \/>/);

  const keyHunterPage = await read("app/typing/games/key-hunter/page.tsx");
  assert.match(keyHunterPage, /import \{ getCharacterPool \} from "@\/lib\/character-pool-server";/);
  assert.match(keyHunterPage, /<KeyHunterGame characterPool=\{characterPool\} \/>/);
});

test("getCharacterPool falls back to DEFAULT_CHARACTER_POOL per language when the RPC errors or returns nothing", async () => {
  const server = await read("lib/character-pool-server.ts");
  assert.match(server, /const result = \{ \.\.\.DEFAULT_CHARACTER_POOL \};/);
  assert.match(server, /if \(!error && Array\.isArray\(data\) && data\.length\) result\[language\] = data as string\[\];/);
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

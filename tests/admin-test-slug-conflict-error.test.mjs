import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real bug hit live: an admin tried to create "TEST - 2" (slug "test-2")
// and got a bare "That URL slug is already in use." with nothing to act
// on. Root cause: a test's URL slug is derived from its title only once,
// at creation -- the slug field is never shown to the admin, and renaming
// a test afterward does NOT regenerate it. An old test originally titled
// "TEST - 2" had since been renamed to "TEST - 4" in the admin UI, but
// kept its original slug "test-2" -- invisibly colliding with the new
// test, with no way for the admin to discover which test actually held
// it. Fixed by looking up the conflicting test on a 23505 and naming it
// in the error, plus an explanatory note on the Title field itself.
test("a slug collision on save names the conflicting test's current title, mode, and status instead of a bare 'already in use'", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /if \(error\.code === "23505"\) \{/);
  assert.match(actions, /supabase\.from\("tests"\)\.select\("title,mode,status"\)\.eq\("slug", draft\.slug\)\.maybeSingle\(\)/);
  assert.match(actions, /already used by another test, currently titled "\$\{conflict\.title\}" \(\$\{conflict\.mode\}, \$\{conflict\.status\}\)/);
  assert.match(actions, /doesn't change if you rename it later -- rename that other test, or change this test's title/);
  // A conflict lookup that itself finds nothing (e.g. an RLS/race edge
  // case) still falls back to a working, if less specific, message rather
  // than throwing or returning undefined.
  assert.match(actions, /: `The web address "\/tests\/\$\{draft\.slug\}" is already in use by another test\.` \};/);
});

test("the Title field explains that a test's web address is set once from its title and won't follow a later rename", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /This title also sets the test's web address -- renaming later won't change the address/);
  assert.match(manager, /This test's web address was set from its title when first created and won't change if you rename it now/);
});

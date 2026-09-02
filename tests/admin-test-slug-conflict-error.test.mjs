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
  assert.match(actions, /supabase\.from\("tests"\)\.select\("title,mode,status"\)\.eq\("slug", finalSlug\)\.maybeSingle\(\)/);
  assert.match(actions, /already used by another test, currently titled "\$\{conflict\.title\}" \(\$\{conflict\.mode\}, \$\{conflict\.status\}\)/);
  assert.match(actions, /doesn't change if you rename it later -- rename that other test, or type a different address into this test's own "URL slug" field/);
  // A conflict lookup that itself finds nothing (e.g. an RLS/race edge
  // case) still falls back to a working, if less specific, message rather
  // than throwing or returning undefined.
  assert.match(actions, /: `The web address "\/tests\/\$\{finalSlug\}" is already in use by another test\.` \};/);
});

// Real friction hit live, twice, by the same admin: creating a new Hindi
// exam test titled "EXERCISE-2" collided with an existing English test
// already titled "EXERCISE - 2" -- both slugify to "exercise-2" -- and the
// admin had to manually retry with a different title. Fixed by
// auto-resolving the slug with a WordPress-style numeric suffix instead of
// hard-blocking, but only for a brand-new test whose "URL slug" field was
// left empty (an admin who explicitly chose a slug still gets the
// informative conflict error, not a silent override).
test("a slug collision auto-resolves with a numeric suffix when creating a new test with an auto-derived slug", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /const runSave = \(attemptPayload: typeof payload\) => lockedMode/);
  assert.match(actions, /let \{ error \} = await runSave\(payload\);/);
  assert.match(actions, /let finalSlug = draft\.slug;/);
  assert.match(actions, /const explicitSlug = text\(formData, "slug"\);/);
  assert.match(actions, /if \(error\?\.code === "23505" && !id && !explicitSlug\) \{/);
  assert.match(actions, /for \(let suffix = 2; error\?\.code === "23505" && suffix <= 20; suffix \+= 1\) \{/);
  assert.match(actions, /finalSlug = `\$\{draft\.slug\}-\$\{suffix\}`;/);
  assert.match(actions, /\(\{ error \} = await runSave\(\{ \.\.\.payload, slug: finalSlug \}\)\);/);
  // The admin is told when this happened, not left to notice a
  // surprising URL on their own.
  assert.match(actions, /const slugNote = finalSlug !== draft\.slug \? ` "\$\{draft\.slug\}" was already taken by another test, so this one was saved at \/tests\/\$\{finalSlug\} instead\.` : "";/);
  assert.match(actions, /return \{ success: \(publish \? "A new immutable version was saved and published\." : "A new immutable draft version was saved\."\) \+ slugNote \};/);
});

test("the Title field explains that a test's web address is set once from its title and won't follow a later rename", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /This title also sets the test's web address -- renaming later won't change the address/);
  assert.match(manager, /This test's web address was set from its title when first created and won't change if you rename it now/);
});

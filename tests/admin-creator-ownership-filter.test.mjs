import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Matches a reference stenography site's "Public"/"Personal" toggle and its
// per-card "Creator: ... / On: ..." line -- both admin test list entry
// points (the locked-section pages and the unscoped General Test
// Management page) now fetch created_by/created_at and the creator's
// profile name, and TestManager can filter down to "mine" and shows both
// on every row.
test("both admin test-list entry points fetch created_by/created_at and resolve the creator's profile name", async () => {
  const section = await read("app/admin/tests/section-test-page.tsx");
  assert.match(section, /"id,title,slug,description,language,status,mode,input_system_id,visibility,duration_seconds,current_version_id,current_version_number,updated_at,is_live,live_starts_at,live_ends_at,results_publish_at,created_by,created_at"/);
  assert.match(section, /supabase\.from\("profiles"\)\.select\("id,full_name"\)\.in\("id", creatorIds\)/);
  assert.match(section, /creatorName: test\.created_by \? creatorNameMap\.get\(test\.created_by\) \?\? null : null/);

  const general = await read("app/admin/tests/page.tsx");
  assert.match(general, /created_by,created_at/);
  assert.match(general, /supabase\.from\("profiles"\)\.select\("id,full_name"\)\.in\("id",creatorIds\)/);
});

test("TestManager offers a Public/Personal ownership filter (only once it knows who 'mine' is) and every row shows its creator and created date", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /currentAdminId\?:string/);
  assert.match(manager, /const \[ownership,setOwnership\] = useState<"all"\|"mine">\("all"\);/);
  assert.match(manager, /const ownershipMatch=ownership==="all"\|\|!currentAdminId\|\|item\.created_by===currentAdminId;/);
  assert.match(manager, /\{currentAdminId && <div role="radiogroup" aria-label="Show tests created by"/);
  assert.match(manager, /Public \(everyone&apos;s\)/);
  assert.match(manager, /Personal \(mine only\)/);
  assert.match(manager, /Creator: \{test\.creatorName\?\?"—"\} · Created \{test\.created_at\?new Date\(test\.created_at\)\.toLocaleDateString\("en-IN"\):"—"\}/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = new URL("../supabase/migrations/202609221900_speedrace_passages.sql", import.meta.url);
const adminId = "00000000-0000-4000-8000-000000000009";
const studentId = "00000000-0000-4000-8000-000000000001";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.current_uid', true), '')::uuid $$;
create table auth.users(id uuid primary key);
create table public.profiles(id uuid primary key, role text default 'student', full_name text);
create function public.is_aal2_admin() returns boolean language sql stable as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
insert into auth.users values ('${adminId}'), ('${studentId}');
insert into public.profiles values ('${adminId}','admin','Admin'), ('${studentId}','student','Student');
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid', $1, false)", [id]);

// Real reported request: an admin wants to author real Speed Race
// passages and let students choose among them, per language, instead of
// every race being an auto-generated word mix from the WordTris word
// bank. Executed for real against a Postgres engine (PGlite), not just
// pattern-matched -- see [[game-rooms-ambiguous-column-gotcha]] for why
// that matters: a string-matching-only test would have missed the exact
// class of bug found and fixed in game_rooms.sql this same session.
test("an admin can create, update, publish/unpublish, and delete a Speed Race passage; only published ones are visible to students", async () => {
  const db = await database();

  await asUser(db, studentId);
  try {
    await db.query("select * from public.admin_save_speedrace_passage(null, 'english', 'Test', 'hello world', true)");
    assert.fail("student should not be able to save a passage");
  } catch (e) {
    assert.match(e.message, /not authorized/);
  }

  await asUser(db, adminId);
  const created = await db.query(
    "select * from public.admin_save_speedrace_passage(null, 'english', 'My Passage', 'the quick brown fox', true)",
  );
  const id = created.rows[0].id;
  assert.equal(created.rows[0].title, "My Passage");

  await asUser(db, studentId);
  const visible = await db.query("select * from public.list_published_speedrace_passages('english')");
  assert.equal(visible.rows.length, 1);
  assert.equal(visible.rows[0].passage, "the quick brown fox");

  // Unpublishing hides it from students but keeps it in the admin list.
  await asUser(db, adminId);
  await db.query("select * from public.admin_save_speedrace_passage($1, 'english', 'My Passage', 'the quick brown fox', false)", [id]);
  await asUser(db, studentId);
  const hidden = await db.query("select * from public.list_published_speedrace_passages('english')");
  assert.equal(hidden.rows.length, 0);
  await asUser(db, adminId);
  const stillInAdminList = await db.query("select * from public.admin_list_speedrace_passages()");
  assert.equal(stillInAdminList.rows.length, 1);

  // A different language's list is unaffected.
  const hindiList = await db.query("select * from public.list_published_speedrace_passages('hindi')");
  assert.equal(hindiList.rows.length, 0);

  await db.query("select public.admin_delete_speedrace_passage($1)", [id]);
  const afterDelete = await db.query("select * from public.admin_list_speedrace_passages()");
  assert.equal(afterDelete.rows.length, 0);

  await db.close();
});

test("the migration is begin/commit wrapped, RLS-enabled with no policies (SECURITY DEFINER RPCs only), and every RPC is revoked from public/anon", async () => {
  const sql = await read("supabase/migrations/202609221900_speedrace_passages.sql");
  assert.match(sql, /^begin;/);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /alter table public\.speedrace_passages enable row level security;/);
  assert.doesNotMatch(sql, /create policy/);
  assert.match(sql, /grant execute on function public\.list_published_speedrace_passages\(text\) to authenticated;/);
  assert.match(sql, /revoke all on function public\.admin_list_speedrace_passages\(\),\s*\n\s*public\.admin_save_speedrace_passage\(uuid,text,text,text,boolean\),\s*\n\s*public\.admin_delete_speedrace_passage\(uuid\) from public, anon;/);
});

test("the admin passages page is gated by requireAdmin, and is wired into the admin dashboard's Games section", async () => {
  const page = await read("app/admin/speedrace-passages/page.tsx");
  assert.match(page, /await requireAdmin\(\);/);
  assert.match(page, /admin_list_speedrace_passages/);
  const actions = await read("app/admin/speedrace-passages/actions.ts");
  assert.match(actions, /await requireAdmin\(\);/);
  assert.match(actions, /admin_save_speedrace_passage/);
  assert.match(actions, /admin_delete_speedrace_passage/);
  const dashboard = await read("app/admin/page.tsx");
  assert.match(dashboard, /\/admin\/speedrace-passages/);
});

// Real reported bug precedent (WordTris word manager, same session):
// a stale success message from an earlier save must not bleed into a
// newly opened dialog.
test("the admin passage manager scopes Save feedback to the currently-open dialog, not a stale earlier save", async () => {
  const manager = await read("app/admin/speedrace-passages/speedrace-passages-manager.tsx");
  assert.match(manager, /const \[dialogSubmitted, setDialogSubmitted\] = useState\(false\);/);
  assert.match(manager, /onSubmit=\{\(\) => setDialogSubmitted\(true\)\}/);
  assert.match(manager, /\{dialogSubmitted && <Feedback state=\{saveState\} \/>\}/);
});

test("Speed Race shows a passage picker only once at least one is published for the current language, falling back to the existing random word mix otherwise", async () => {
  const game = await read("app/typing/games/speed-race/speed-race-game.tsx");
  assert.match(game, /passagesByLanguage: Record<WordtrisLanguage, SpeedRacePassage\[\]>;/);
  assert.match(game, /const availablePassages = passagesByLanguage\[language\] \?\? \[\];/);
  assert.match(game, /\{availablePassages\.length > 0 && \(/);
  assert.match(game, /const chosen = availablePassages\.find\(\(p\) => p\.id === selectedPassageId\);/);
  assert.match(game, /const nextPassage = chosen \? chosen\.passage : buildSpeedRacePassage\(words\[language\]\?\.\[category\] \?\? \[\]\);/);
});

test("Speed Race's page.tsx fetches passages for both languages and passes them down, alongside the existing word banks", async () => {
  const page = await read("app/typing/games/speed-race/page.tsx");
  assert.match(page, /import \{ getSpeedRacePassages \} from "@\/lib\/speedrace-passages-server";/);
  assert.match(page, /getSpeedRacePassages\("english"\)/);
  assert.match(page, /getSpeedRacePassages\("hindi"\)/);
  assert.match(page, /<SpeedRaceGame words=\{words\} passagesByLanguage=\{\{ english, hindi \}\} \/>/);
});

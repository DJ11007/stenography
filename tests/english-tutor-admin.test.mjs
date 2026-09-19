import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = new URL("../supabase/migrations/202609111530_english_tutor_exercises.sql", import.meta.url);
const adminId = "00000000-0000-4000-8000-000000000009";
const studentId = "00000000-0000-4000-8000-000000000001";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.current_uid', true), '')::uuid $$;
create table auth.users(id uuid primary key);
create table public.profiles(id uuid primary key, role text default 'student');
create function public.is_aal2_admin() returns boolean language sql stable as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
insert into auth.users values ('${adminId}'), ('${studentId}');
insert into public.profiles values ('${adminId}','admin'), ('${studentId}','student');
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid', $1, false)", [id]);

test("the migration seeds the full bundled curriculum (16 key drills, 12 word sets, 8 paragraphs)", async () => {
  const db = await database();
  const { rows } = await db.query("select kind, count(*)::int c from public.english_tutor_exercises group by kind order by kind");
  assert.deepEqual(rows, [
    { kind: "key-lesson", c: 16 },
    { kind: "paragraph", c: 8 },
    { kind: "word-set", c: 12 },
  ]);
  const { rows: pub } = await db.query("select count(*)::int c from public.list_published_english_tutor_exercises()");
  assert.equal(pub[0].c, 36);
  await db.close();
});

test("an admin can add and edit an exercise; a student cannot", async () => {
  const db = await database();
  await asUser(db, adminId);
  const { rows: [created] } = await db.query(
    "select (public.admin_save_english_tutor_exercise(null,'word-set','New Set','lamp desk chair',null,true,50)).id",
  );
  assert.ok(created.id);
  await db.query("select public.admin_save_english_tutor_exercise($1,'word-set','New Set (edited)','lamp desk chair table sofa',null,true,50)", [created.id]);
  const { rows: [edited] } = await db.query("select title, content from public.english_tutor_exercises where id = $1", [created.id]);
  assert.equal(edited.title, "New Set (edited)");
  assert.equal(edited.content, "lamp desk chair table sofa");

  await asUser(db, studentId);
  await assert.rejects(
    () => db.query("select public.admin_save_english_tutor_exercise(null,'word-set','hack','word',null,true,0)"),
    /not authorized/,
  );
  await assert.rejects(() => db.query("select public.admin_list_english_tutor_exercises()"), /not authorized/i);
  await db.close();
});

test("save rejects a bad kind, a blank title and blank content", async () => {
  const db = await database();
  await asUser(db, adminId);
  await assert.rejects(() => db.query("select public.admin_save_english_tutor_exercise(null,'nonsense','T','C',null,true,0)"), /Invalid exercise type/);
  await assert.rejects(() => db.query("select public.admin_save_english_tutor_exercise(null,'word-set','   ','C',null,true,0)"), /Title is required/);
  await assert.rejects(() => db.query("select public.admin_save_english_tutor_exercise(null,'word-set','T','   ',null,true,0)"), /Content is required/);
  await db.close();
});

test("an unpublished exercise disappears from the public listing but stays in the admin listing", async () => {
  const db = await database();
  await asUser(db, adminId);
  const { rows: [{ id }] } = await db.query("select id from public.english_tutor_exercises where kind='paragraph' order by display_order limit 1");
  await db.query("select public.admin_save_english_tutor_exercise($1,'paragraph','Hidden paragraph','Some text',null,false,0)", [id]);
  const { rows: pub } = await db.query("select count(*) filter (where id=$1)::int c from public.list_published_english_tutor_exercises()", [id]);
  assert.equal(pub[0].c, 0);
  const { rows: adm } = await db.query("select count(*) filter (where id=$1)::int c from public.admin_list_english_tutor_exercises()", [id]);
  assert.equal(adm[0].c, 1);
  await db.close();
});

test("delete is admin-only and removes the row", async () => {
  const db = await database();
  await asUser(db, adminId);
  const { rows: [{ id }] } = await db.query("select id from public.english_tutor_exercises limit 1");
  await asUser(db, studentId);
  await assert.rejects(() => db.query("select public.admin_delete_english_tutor_exercise($1)", [id]), /not authorized/);
  await asUser(db, adminId);
  await db.query("select public.admin_delete_english_tutor_exercise($1)", [id]);
  const { rows } = await db.query("select count(*)::int c from public.english_tutor_exercises where id = $1", [id]);
  assert.equal(rows[0].c, 0);
  await db.close();
});

test("public RPC is granted to anon/authenticated; admin RPCs are not", async () => {
  const db = await database();
  const { rows } = await db.query(`
    select
      has_function_privilege('anon', 'public.list_published_english_tutor_exercises()', 'execute') as pub_anon,
      has_function_privilege('anon', 'public.admin_list_english_tutor_exercises()', 'execute') as adm_anon,
      has_function_privilege('authenticated', 'public.admin_save_english_tutor_exercise(uuid,text,text,text,text,boolean,integer)', 'execute') as save_auth
  `);
  assert.equal(rows[0].pub_anon, true);
  assert.equal(rows[0].adm_anon, false);
  assert.equal(rows[0].save_auth, true);
  await db.close();
});

test("the tutor page reads from the DB with a bundled fallback, and the admin manager + hub link are wired", async () => {
  const [server, page, admin, manager, hub, learnHub] = await Promise.all([
    read("lib/english-tutor-server.ts"),
    read("app/typing/learn/english-tutor/page.tsx"),
    read("app/admin/page.tsx"),
    read("app/admin/english-lessons/english-lessons-manager.tsx"),
    read("app/admin/english-lessons/page.tsx"),
    read("app/typing/learn/page.tsx"),
  ]);
  assert.match(server, /list_published_english_tutor_exercises/);
  assert.match(server, /KEY_LESSONS\.map|WORD_SETS\.map|PARAGRAPHS\.map/);
  assert.match(page, /getEnglishTutorExercises/);
  assert.match(admin, /"\/admin\/english-lessons", "English Typing Tutor"/);
  assert.match(hub, /admin_list_english_tutor_exercises/);
  assert.match(manager, /admin_save_english_tutor_exercise|saveEnglishTutorExercise/);
  assert.match(manager, /\+ New \{KIND_LABEL\[kind\]\}/);
  assert.match(manager, /deleteEnglishTutorExercise/);
  assert.match(learnHub, /href: "\/typing\/learn\/english-tutor"/);
});

test("the tutor has a full-screen toggle and no font-conversion step (unlike Kruti Dev, English is typed exactly as authored)", async () => {
  const tutor = await read("app/typing/learn/english-tutor/english-tutor.tsx");
  assert.match(tutor, /requestFullscreen/);
  assert.match(tutor, /document\.exitFullscreen/);
  assert.match(tutor, /fullscreenchange/);
  assert.doesNotMatch(tutor, /toTypeableKrutiDev|krutiDevToUnicode/);
  const page = await read("app/typing/learn/english-tutor/page.tsx");
  assert.doesNotMatch(page, /toTypeableKrutiDev|krutiDevToUnicode/);
});

// Real reported requests: (1) the on-screen keyboard used to be shown by
// default -- now off by default (still toggleable from Settings); (2) the
// passage box and the typing box must render at the SAME size on screen
// at every resolution. A plain min-height on both was tried and found NOT
// to actually match in practice: a div naturally grows to fit its content
// (the full passage) while an empty textarea's height doesn't grow past
// its own min-height at all -- confirmed by measuring both boxes' real
// rendered heights in the browser. An explicit height (not min-height),
// the same clamp() formula on both, is what actually guarantees parity.
test("the on-screen keyboard defaults off, and the passage/typing boxes share the exact same explicit clamp()-based height", async () => {
  const tutor = await read("app/typing/learn/english-tutor/english-tutor.tsx");
  assert.match(tutor, /const \[showKeyboard, setShowKeyboard\] = useState\(false\);/);
  const heightDeclarations = [...tutor.matchAll(/height: "clamp\(14rem, 45vh, 34rem\)"/g)];
  assert.equal(heightDeclarations.length, 2, "both the passage box and the typing box must use the identical explicit height formula");
});

// Real reported friction: the real student-facing page is gated by
// requireStudent() (app/typing/layout.tsx), which redirects an admin
// session straight to /admin -- there was previously no way for an admin
// to just open it and see what a student sees, only a throwaway route
// recreated (and deleted) by hand each time. This permanent, admin-gated
// route renders the same page component/provider instead, and is wired
// into the admin dashboard so it doesn't need rebuilding again.
test("a permanent, admin-gated preview route renders the real EnglishTutor component, wired into the admin dashboard", async () => {
  const preview = await read("app/admin/preview/english-tutor/page.tsx");
  assert.match(preview, /await requireAdmin\(\);/);
  assert.match(preview, /getEnglishTutorExercises/);
  assert.match(preview, /<EnglishTutor/);
  assert.match(preview, /<TypingStudentProvider/);
  const admin = await read("app/admin/page.tsx");
  assert.match(admin, /"\/admin\/preview\/english-tutor", "Preview: English Typing Tutor"/);
});

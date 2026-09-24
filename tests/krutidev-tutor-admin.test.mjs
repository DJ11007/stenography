import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = new URL("../supabase/migrations/202609101600_krutidev_tutor_exercises.sql", import.meta.url);
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
  const { rows } = await db.query("select kind, count(*)::int c from public.krutidev_tutor_exercises group by kind order by kind");
  assert.deepEqual(rows, [
    { kind: "key-lesson", c: 16 },
    { kind: "paragraph", c: 8 },
    { kind: "word-set", c: 12 },
  ]);
  const { rows: pub } = await db.query("select count(*)::int c from public.list_published_krutidev_exercises()");
  assert.equal(pub[0].c, 36);
  await db.close();
});

test("an admin can add and edit an exercise; a student cannot", async () => {
  const db = await database();
  await asUser(db, adminId);
  const { rows: [created] } = await db.query(
    "select (public.admin_save_krutidev_exercise(null,'word-set','नया समूह','कमल जल फल',null,true,50)).id",
  );
  assert.ok(created.id);
  await db.query("select public.admin_save_krutidev_exercise($1,'word-set','नया समूह (संपादित)','कमल जल फल थल हम',null,true,50)", [created.id]);
  const { rows: [edited] } = await db.query("select title, content from public.krutidev_tutor_exercises where id = $1", [created.id]);
  assert.equal(edited.title, "नया समूह (संपादित)");
  assert.equal(edited.content, "कमल जल फल थल हम");

  await asUser(db, studentId);
  await assert.rejects(
    () => db.query("select public.admin_save_krutidev_exercise(null,'word-set','हैक','शब्द',null,true,0)"),
    /not authorized/,
  );
  await assert.rejects(() => db.query("select public.admin_list_krutidev_exercises()"), /not authorized/i);
  await db.close();
});

test("save rejects a bad kind, a blank title and blank content", async () => {
  const db = await database();
  await asUser(db, adminId);
  await assert.rejects(() => db.query("select public.admin_save_krutidev_exercise(null,'nonsense','T','C',null,true,0)"), /Invalid exercise type/);
  await assert.rejects(() => db.query("select public.admin_save_krutidev_exercise(null,'word-set','   ','C',null,true,0)"), /Title is required/);
  await assert.rejects(() => db.query("select public.admin_save_krutidev_exercise(null,'word-set','T','   ',null,true,0)"), /Content is required/);
  await db.close();
});

test("an unpublished exercise disappears from the public listing but stays in the admin listing", async () => {
  const db = await database();
  await asUser(db, adminId);
  const { rows: [{ id }] } = await db.query("select id from public.krutidev_tutor_exercises where kind='paragraph' order by display_order limit 1");
  await db.query("select public.admin_save_krutidev_exercise($1,'paragraph','अनुच्छेद (छिपा)','कुछ पाठ',null,false,0)", [id]);
  const { rows: pub } = await db.query("select count(*) filter (where id=$1)::int c from public.list_published_krutidev_exercises()", [id]);
  assert.equal(pub[0].c, 0);
  const { rows: adm } = await db.query("select count(*) filter (where id=$1)::int c from public.admin_list_krutidev_exercises()", [id]);
  assert.equal(adm[0].c, 1);
  await db.close();
});

test("delete is admin-only and removes the row", async () => {
  const db = await database();
  await asUser(db, adminId);
  const { rows: [{ id }] } = await db.query("select id from public.krutidev_tutor_exercises limit 1");
  await asUser(db, studentId);
  await assert.rejects(() => db.query("select public.admin_delete_krutidev_exercise($1)", [id]), /not authorized/);
  await asUser(db, adminId);
  await db.query("select public.admin_delete_krutidev_exercise($1)", [id]);
  const { rows } = await db.query("select count(*)::int c from public.krutidev_tutor_exercises where id = $1", [id]);
  assert.equal(rows[0].c, 0);
  await db.close();
});

test("public RPC is granted to anon/authenticated; admin RPCs are not", async () => {
  const db = await database();
  const { rows } = await db.query(`
    select
      has_function_privilege('anon', 'public.list_published_krutidev_exercises()', 'execute') as pub_anon,
      has_function_privilege('anon', 'public.admin_list_krutidev_exercises()', 'execute') as adm_anon,
      has_function_privilege('authenticated', 'public.admin_save_krutidev_exercise(uuid,text,text,text,text,boolean,integer)', 'execute') as save_auth
  `);
  assert.equal(rows[0].pub_anon, true);
  assert.equal(rows[0].adm_anon, false);
  assert.equal(rows[0].save_auth, true);
  await db.close();
});

test("the tutor page reads from the DB with a bundled fallback, and the admin manager + hub link are wired", async () => {
  const [server, page, admin, manager, hub] = await Promise.all([
    read("lib/krutidev-tutor-server.ts"),
    read("app/typing/learn/krutidev/page.tsx"),
    read("app/admin/page.tsx"),
    read("app/admin/krutidev-lessons/krutidev-lessons-manager.tsx"),
    read("app/admin/krutidev-lessons/page.tsx"),
  ]);
  assert.match(server, /list_published_krutidev_exercises/);
  assert.match(server, /KEY_LESSONS\.map|WORD_SETS\.map|PARAGRAPHS\.map/);
  assert.match(page, /getKrutiDevExercises/);
  assert.match(admin, /"\/admin\/krutidev-lessons", "Kruti Dev Typing Tutor"/);
  assert.match(hub, /admin_list_krutidev_exercises/);
  assert.match(manager, /admin_save_krutidev_exercise|saveKrutiDevExercise/);
  assert.match(manager, /\+ New \{KIND_LABEL\[kind\]\}/);
  assert.match(manager, /deleteKrutiDevExercise/);
});

// Real reported bug: "+ New" always opened the editor with Order defaulting
// to 0 -- easy to miss among the other two fields on that row, and every
// existing lesson of a kind (even a freshly-seeded curriculum) already has
// an entry at 0, so a new lesson silently tied with it and sorted into the
// wrong place (list order is kind, display_order, created_at) unless the
// admin remembered to type a different number in by hand. Bit the same
// admin twice in a row live. Now the button computes one past this kind's
// current highest Order and seeds the form with that instead.
test("+ New suggests one past the current highest Order for that kind, instead of always defaulting to 0", async () => {
  const manager = await read("app/admin/krutidev-lessons/krutidev-lessons-manager.tsx");
  assert.match(manager, /setEditing\(\{ kind, suggestedOrder: groupRows\.length \? Math\.max\(\.\.\.groupRows\.map\(\(row\) => row\.display_order\)\) \+ 1 : 0 \}\)/);
  assert.match(manager, /defaultValue=\{draft\?\.display_order \?\? \(editing && "suggestedOrder" in editing \? editing\.suggestedOrder : 0\)\}/);
});

test("the tutor has a full-screen toggle", async () => {
  const tutor = await read("app/typing/learn/krutidev/krutidev-tutor.tsx");
  assert.match(tutor, /requestFullscreen/);
  assert.match(tutor, /document\.exitFullscreen/);
  assert.match(tutor, /fullscreenchange/);
});

// Real requested removal: the admin no longer wants the read-only
// "Preview: X" pages cluttering the admin dashboard (they test with a
// real student account instead), so every /admin/preview/* route,
// including this one, was deleted.
test("the Kruti Dev tutor's admin preview route is gone", async () => {
  const admin = await read("app/admin/page.tsx");
  assert.doesNotMatch(admin, /admin\/preview\/krutidev-tutor/);
});

test("the on-screen keyboard defaults off, and the passage/typing boxes share the exact same explicit clamp()-based height", async () => {
  const tutor = await read("app/typing/learn/krutidev/krutidev-tutor.tsx");
  assert.match(tutor, /const \[showKeyboard, setShowKeyboard\] = useState\(false\);/);
  const heightDeclarations = [...tutor.matchAll(/height: "clamp\(14rem, 45vh, 34rem\)"/g)];
  assert.equal(heightDeclarations.length, 2, "both the passage box and the typing box must use the identical explicit height formula");
});

test("full screen replaces the fixed clamp() height with a flex-1 layout that's guaranteed to fit exactly one screen, no page scroll", async () => {
  const tutor = await read("app/typing/learn/krutidev/krutidev-tutor.tsx");
  assert.match(tutor, /isFullscreen \? "flex h-\[100dvh\] flex-col overflow-hidden" : "min-h-screen overflow-y-auto"/);
  assert.match(tutor, /isFullscreen \? "flex min-h-0 flex-1 flex-col" : ""/);
  const flexOneBoxes = [...tutor.matchAll(/\$\{isFullscreen \? "min-h-0 flex-1" : ""\}/g)];
  assert.equal(flexOneBoxes.length, 2, "both the passage box and the typing box must switch to flex-1 in full screen");
});

// Kruti-Dev-specific: the Alt-codes reference button used to live in the
// always-visible options row; it moved into the Settings popup along with
// everything else that used to live there (tests/tutor-backspace-and-
// options-bar.test.mjs covers the popup mechanics/Auto scroll/Progress-
// strip-removal shared with the English tutor).
test("the Alt-codes reference button moved into the Settings popup, and the AltCodesModal it opens is untouched", async () => {
  const tutor = await read("app/typing/learn/krutidev/krutidev-tutor.tsx");
  const settingsPopupStart = tutor.indexOf("<TypingSettingsPopup");
  const settingsPopupEnd = tutor.indexOf("</TypingSettingsPopup>");
  const altButtonIndex = tutor.indexOf("Alt कोड दिखाएँ");
  assert.ok(settingsPopupStart > 0 && altButtonIndex > settingsPopupStart && altButtonIndex < settingsPopupEnd, "the Alt-codes button must be inside the Settings popup");
  assert.match(tutor, /function AltCodesModal\(/);
  assert.match(tutor, /\{altOpen && <AltCodesModal onClose=\{\(\) => setAltOpen\(false\)\} \/>\}/);
});

// Real reported bug: the Content field expects real Unicode Hindi text
// (the bundled seed data is real words like "कर करक रकर", built from each
// lesson's own focus keys -- not raw keystrokes), but an admin thinking in
// Kruti Dev keystrokes (their day-to-day typing skill) typed the raw
// legacy keys directly ("sdfgh ';lkj", the literal home-row keys) into a
// brand new Key drill -- and toTypeableKrutiDev (Unicode -> Kruti Dev) ran
// on that non-Unicode input anyway, silently producing garbage in the
// Student preview with no warning at all (worse than the WordTris word
// manager's pre-fix state, which at least blocked Save). Fixed the same
// way as that manager: detected non-Unicode input is decoded via
// krutiDevToUnicode into the real Hindi text, which is what's actually
// saved and what the preview is derived from.
test("the Kruti Dev lessons manager auto-converts Kruti Dev keystrokes typed into Content, instead of silently mis-converting them", async () => {
  const manager = await read("app/admin/krutidev-lessons/krutidev-lessons-manager.tsx");
  assert.match(manager, /import \{ detectHindiTextFormat, krutiDevToUnicode, toTypeableKrutiDev \} from "@\/lib\/hindi-font-converter";/);
  assert.match(manager, /const detectedFormat = detectHindiTextFormat\(liveContent\);/);
  assert.match(manager, /return \{ canonicalContent: krutiDevToUnicode\(liveContent\), conversionError: null \};/);
  // The visible textarea stays uncontrolled-by-name (echoes exactly what
  // the admin typed); the actual "content" submitted is always the
  // decoded/canonical Unicode value via a hidden input, so the DB keeps
  // storing clean Unicode regardless of which way the admin typed it in.
  assert.doesNotMatch(manager, /<textarea name="content"/);
  assert.match(manager, /<input type="hidden" name="content" value=\{canonicalContent\} \/>/);
  // Save is only blocked on a genuine decode failure now, not merely on
  // detecting non-Unicode input.
  assert.match(manager, /disabled=\{savePending \|\| Boolean\(conversionError\)\}/);
});

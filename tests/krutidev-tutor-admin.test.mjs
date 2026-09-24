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
// Student preview with no warning at all.
//
// First fixed by decoding non-Unicode input to Unicode via
// krutiDevToUnicode before saving (matching the WordTris word manager's
// fix) -- but that round trip turned out to be LOSSY for a Key drill's
// arbitrary key-practice sequences: Kruti Dev has multiple physical keys
// that decode to the IDENTICAL Devanagari glyph (both "s" and "l" decode
// to "स"), so re-deriving Kruti Dev bytes from the saved Unicode could
// silently substitute a DIFFERENT key than the one the admin actually
// typed and wanted students to practice -- confirmed live: "sdfgh"
// round-tripped through Unicode and back came out re-keyed with "l"
// where "s" was typed. Fixed properly: content is now saved EXACTLY as
// typed (Kruti Dev keystrokes stay Kruti Dev keystrokes, Unicode stays
// Unicode, no hidden input / no save-time conversion in either
// direction), and krutiDevTypingTarget (lib/hindi-font-converter.ts) is
// the single shared "what should a student type" resolver used
// identically by the admin's live preview, the admin's row list, and the
// student-facing tutor page -- so all three always agree byte-for-byte.
test("the Kruti Dev lessons manager saves Content exactly as typed (Kruti Dev keystrokes or Unicode Hindi), never converting or blocking on non-Unicode input", async () => {
  const manager = await read("app/admin/krutidev-lessons/krutidev-lessons-manager.tsx");
  assert.match(manager, /import \{ detectHindiTextFormat, krutiDevToUnicode, krutiDevTypingTarget \} from "@\/lib\/hindi-font-converter";/);
  assert.match(manager, /const detectedFormat = detectHindiTextFormat\(liveContent\);/);
  // The textarea submits its own raw value directly again -- no hidden
  // input, no save-time conversion, so what's typed is exactly what's
  // stored.
  assert.match(manager, /<textarea name="content" value=\{liveContent\}/);
  assert.doesNotMatch(manager, /type="hidden" name="content"/);
  // Save is blocked only for genuinely ambiguous "mixed" input (which
  // can't render correctly in either font); plain Kruti Dev keystrokes,
  // however unusual-looking, are always safely storable verbatim.
  assert.match(manager, /disabled=\{savePending \|\| detectedFormat === "mixed"\}/);
  // The row list's own Kruti Dev preview (row.krutidev) and the live
  // editor's preview (livePreview) both resolve through the one shared
  // function, not a locally re-implemented conversion.
  assert.match(manager, /const livePreview = useMemo\(\(\) => \(liveContent\.trim\(\) \? krutiDevTypingTarget\(liveContent\) : ""\), \[liveContent\]\);/);
});

// Real reported bug, the actual root cause: krutiDevTypingTarget is the
// shared resolver now used by the admin editor, the admin row list, AND
// the student-facing tutor page (app/typing/learn/krutidev/page.tsx) --
// pinning its exact behavior here guards all three call sites at once.
test("krutiDevTypingTarget never converts already-Kruti-Dev content (avoiding the lossy round trip / double-conversion bug), and still converts genuine Unicode", async () => {
  const { krutiDevTypingTarget } = await import("../lib/hindi-font-converter.ts");
  // The exact reported case: raw keystrokes come back byte-identical,
  // not re-keyed through a lossy Unicode round trip.
  assert.equal(krutiDevTypingTarget("sdfgh';lkj"), "sdfgh';lkj");
  // Genuine Unicode Hindi still gets converted into typeable Kruti Dev
  // bytes, exactly as it always has for Word sets/Paragraphs.
  assert.equal(krutiDevTypingTarget("कर करक रकर"), "dj djd jdj");
});

// Real reported bug: a Key drill mixing Hindi lines with a raw-key line
// converted the raw line too, turning "jkl;'" into "jkl(*".
test("krutiDevTypingTarget keeps a line with no Hindi as raw keystrokes even when other lines are Unicode Hindi", async () => {
  const { krutiDevTypingTarget } = await import("../lib/hindi-font-converter.ts");
  assert.equal(krutiDevTypingTarget("कर करक\njkl;'\nरकर"), "dj djd\njkl;'\njdj");
  assert.equal(krutiDevTypingTarget("कर\r\nSDFGH LKJ\r\nरकर"), "dj\r\nSDFGH LKJ\r\njdj");
  assert.equal(krutiDevTypingTarget("कर करक रकर"), "dj djd jdj");
});

test("the student-facing tutor page's toTarget is krutiDevTypingTarget itself, not a re-implemented copy", async () => {
  const page = await read("app/typing/learn/krutidev/page.tsx");
  assert.match(page, /import \{ krutiDevTypingTarget \} from "@\/lib\/hindi-font-converter";/);
  assert.match(page, /const toTarget = krutiDevTypingTarget;/);
});

test("the admin list's per-row Kruti Dev preview also uses the shared krutiDevTypingTarget, not an unconditional toTypeableKrutiDev that would corrupt Kruti-Dev-typed content", async () => {
  const page = await read("app/admin/krutidev-lessons/page.tsx");
  assert.match(page, /import \{ krutiDevTypingTarget \} from "@\/lib\/hindi-font-converter";/);
  assert.match(page, /return \{ \.\.\.row, krutidev: krutiDevTypingTarget\(row\.content\) \};/);
});

// Real reported bug, found via pixel-level canvas measurement while
// verifying the fix above: several Kruti Dev 010 glyphs (स among them)
// have a substantial NEGATIVE left-side-bearing -- their ink draws to the
// LEFT of the character's own advance origin. An isolated "s" glyph's
// drawn pixels start well to the left of its nominal x origin (confirmed:
// ctx.measureText('s') at 80px is ~0.07px wide, and a canvas ink-scan of
// a fresh "s" showed ink starting ~27px left of where it was drawn).
// Mid-string this is invisible (the overhang draws into space already
// claimed by the PREVIOUS character's advance), but when such a glyph is
// the very FIRST character on a line, there's nothing to its left to draw
// into -- the overhang gets clipped by the element's own edge and the
// character visibly vanishes. Reported live: typing "s s s s" (4
// keystrokes) into the Kruti Dev lessons admin's Content field showed
// only 3 marks in the Student preview. A small extra left padding, sized
// to the worst-case overhang, is a complete fix -- verified live via a
// canvas ink-region scan of the real rendered page (4 distinct regions,
// not 1, after the fix) and confirmed the fourth mark visible in a
// screenshot at 80px font size.
test("Kruti-Dev-rendered text in the lessons admin gets extra left padding, to keep a negative-left-side-bearing first glyph (like स) from being clipped by the element's own edge", async () => {
  const manager = await read("app/admin/krutidev-lessons/krutidev-lessons-manager.tsx");
  assert.match(manager, /const KD_LEADING_PAD = "0\.4em";/);
  // All four places that can render an admin-controlled first character in
  // Kruti Dev: the live Content textarea, its Student preview, and the
  // row list's two KD-styled previews.
  assert.match(manager, /paddingLeft: isKrutiDevInput \? `calc\(0\.75rem \+ \$\{KD_LEADING_PAD\}\)` : undefined/);
  assert.match(manager, /style=\{\{ fontFamily: KD, paddingLeft: KD_LEADING_PAD \}\}>\{livePreview\}<\/p>/);
  const rowStyleMatches = [...manager.matchAll(/paddingLeft: KD_LEADING_PAD/g)];
  assert.ok(rowStyleMatches.length >= 3, "the textarea, the live preview, and at least one row-list preview must all apply the leading padding fix");
});

// Same bug, same fix, applied to the actual student-facing tutor page --
// found and fixed in the same pass since a real curriculum word starting
// with स (e.g. "सुबह" in the bundled "दैनिक जीवन" word set) would hit the
// identical clipping for real students, not just the admin editor. Here
// the safety margin scales with the tutor's own adjustable font-size
// control (default 30px, up to 56px via the A+ button) rather than being
// a fixed em value, since a larger font makes the same glyph's overhang
// proportionally wider in pixels.
test("the student-facing Kruti Dev tutor's passage box and typing textarea both scale their extra left padding with the adjustable font size, for the same reason", async () => {
  const tutor = await read("app/typing/learn/krutidev/krutidev-tutor.tsx");
  assert.match(tutor, /function kdLeadingPad\(fontPx: number, basePadding: string\) \{/);
  assert.match(tutor, /paddingLeft: kdLeadingPad\(fontPx, "1rem"\)/);
  assert.match(tutor, /paddingLeft: kdLeadingPad\(fontPx, "0\.75rem"\)/);
});

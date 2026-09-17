import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationPath = new URL("../supabase/migrations/202609171700_wordtris.sql", import.meta.url);
const adminId = "00000000-0000-4000-8000-000000000009";
const studentId = "00000000-0000-4000-8000-000000000001";
const otherStudentId = "00000000-0000-4000-8000-000000000002";

async function database() {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.current_uid', true), '')::uuid $$;
create table auth.users(id uuid primary key);
create table public.profiles(id uuid primary key, role text default 'student', full_name text);
create function public.is_aal2_admin() returns boolean language sql stable as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
insert into auth.users values ('${adminId}'), ('${studentId}'), ('${otherStudentId}');
insert into public.profiles values ('${adminId}','admin','Admin'), ('${studentId}','student','lokesh meena'), ('${otherStudentId}','student','manrajmeena');
`);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("select set_config('app.current_uid', $1, false)", [id]);

test("the migration seeds a starter word bank for every category x language (210 words)", async () => {
  const db = await database();
  const { rows } = await db.query("select count(*)::int c from public.wordtris_word_banks");
  assert.equal(rows[0].c, 7 * 2 * 15); // 7 categories x 2 languages x 15 words each
  await db.close();
});

test("list_published_wordtris_words returns only that language + category", async () => {
  const db = await database();
  const { rows } = await db.query("select word from public.list_published_wordtris_words('english','animals')");
  assert.equal(rows.length, 15);
  assert.ok(rows.some((r) => r.word === "cat"));
  const { rows: hindi } = await db.query("select word from public.list_published_wordtris_words('hindi','animals')");
  assert.equal(hindi.length, 15);
  assert.ok(hindi.some((r) => r.word === "बिल्ली"));
  await db.close();
});

test("an admin can add and edit a word; a student cannot", async () => {
  const db = await database();
  await asUser(db, adminId);
  const { rows: [created] } = await db.query("select (public.admin_save_wordtris_word(null,'english','animals','fox',true)).id");
  assert.ok(created.id);
  await db.query("select public.admin_save_wordtris_word($1,'english','animals','red fox',true)", [created.id]);
  const { rows: [edited] } = await db.query("select word from public.wordtris_word_banks where id=$1", [created.id]);
  assert.equal(edited.word, "red fox");

  await asUser(db, studentId);
  await assert.rejects(() => db.query("select public.admin_save_wordtris_word(null,'english','animals','hack',true)"), /not authorized/);
  await assert.rejects(() => db.query("select public.admin_list_wordtris_words()"), /not authorized/i);
  await db.close();
});

test("save rejects a bad language, a bad category, and a blank word", async () => {
  const db = await database();
  await asUser(db, adminId);
  await assert.rejects(() => db.query("select public.admin_save_wordtris_word(null,'french','animals','x',true)"), /Invalid language/);
  await assert.rejects(() => db.query("select public.admin_save_wordtris_word(null,'english','nonsense','x',true)"), /Invalid category/);
  await assert.rejects(() => db.query("select public.admin_save_wordtris_word(null,'english','animals','   ',true)"), /Word is required/);
  await db.close();
});

test("submit_wordtris_score resolves the student's name from their own session, never a client-supplied value", async () => {
  const db = await database();
  await asUser(db, studentId);
  const { rows: [row] } = await db.query("select * from public.submit_wordtris_score('english','easy_words',120,8)");
  assert.equal(row.student_name, "lokesh meena");
  assert.equal(row.student_id, studentId);
  assert.equal(row.score, 120);
  await db.close();
});

test("submit_wordtris_score rejects an invalid language, category, or negative score", async () => {
  const db = await database();
  await asUser(db, studentId);
  await assert.rejects(() => db.query("select public.submit_wordtris_score('french','easy_words',10,1)"), /Invalid language/);
  await assert.rejects(() => db.query("select public.submit_wordtris_score('english','nonsense',10,1)"), /Invalid category/);
  await assert.rejects(() => db.query("select public.submit_wordtris_score('english','easy_words',-5,1)"), /Invalid score/);
  await db.close();
});

// The core novel logic this migration introduces: no existing table in
// this codebase caps itself at N rows. Insert 51 scores for the same
// (language, category) and confirm exactly 50 remain, with the LOWEST
// score evicted -- not the oldest, not a random one -- so a genuinely
// better new score always survives even against 50 already-full slots.
test("wordtris_scores keeps only the top 50 per (language, category), evicting the lowest score when a 51st arrives", async () => {
  const db = await database();
  await asUser(db, studentId);
  for (let i = 1; i <= 50; i += 1) {
    await db.query("select public.submit_wordtris_score('english','numbers',$1,1)", [i * 10]);
  }
  const { rows: full } = await db.query("select count(*)::int c from public.wordtris_scores where language='english' and category='numbers'");
  assert.equal(full[0].c, 50);
  const { rows: lowestBefore } = await db.query("select min(score)::int m from public.wordtris_scores where language='english' and category='numbers'");
  assert.equal(lowestBefore[0].m, 10);

  // A new score higher than the current lowest (10) must evict it, not
  // itself, and the group must stay capped at exactly 50.
  await db.query("select public.submit_wordtris_score('english','numbers',15,1)");
  const { rows: afterBetter } = await db.query("select count(*)::int c, min(score)::int m from public.wordtris_scores where language='english' and category='numbers'");
  assert.equal(afterBetter[0].c, 50);
  assert.equal(afterBetter[0].m, 15, "the score of 10 should have been evicted, not the new score of 15");

  // A different (language, category) group is entirely unaffected.
  await db.query("select public.submit_wordtris_score('hindi','numbers',1,1)");
  const { rows: hindiCount } = await db.query("select count(*)::int c from public.wordtris_scores where language='hindi' and category='numbers'");
  assert.equal(hindiCount[0].c, 1);
  await db.close();
});

test("wordtris_leaderboard orders by score descending and clamps the limit to 1-50", async () => {
  const db = await database();
  await asUser(db, studentId);
  await db.query("select public.submit_wordtris_score('english','common',50,3)");
  await db.query("select public.submit_wordtris_score('english','common',200,10)");
  await db.query("select public.submit_wordtris_score('english','common',120,6)");
  const { rows: top2 } = await db.query("select score from public.wordtris_leaderboard('english','common',2)");
  assert.deepEqual(top2.map((r) => r.score), [200, 120]);
  const { rows: clampedHigh } = await db.query("select count(*)::int c from public.wordtris_leaderboard('english','common',999)");
  assert.equal(clampedHigh[0].c, 3);
  await db.close();
});

test("leaderboard read and score submission require a signed-in session, not anon", async () => {
  const content = await readFile(migrationPath, "utf8");
  assert.match(content, /revoke all on function public\.submit_wordtris_score\(text,text,integer,integer\),\s*\n\s*public\.wordtris_leaderboard\(text,text,integer\) from public, anon;/);
  assert.doesNotMatch(content, /grant execute on function public\.submit_wordtris_score[\s\S]{0,120}to anon/);
  assert.doesNotMatch(content, /grant execute on function public\.wordtris_leaderboard[\s\S]{0,120}to anon/);
});

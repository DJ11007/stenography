import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Real reported problem (25 Nov 2026): "Submission failed" on Hindi Word Test 7. PAGE LAYOUT > Hyphenation recorded the
// editor command "hyphenation", which no editor setting is called, so the server's capability check refused every save
// and the submit once a student used it (Test 7 Q13). Migration 202611251000 counts it as Line Numbers (the setting
// that shows the button) and switches on the tools Tests 7 and 8 need; the editor records "lineNumbers" from now on.

const sql = async (name) => (await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const EDITOR = new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url);

// Test 7's settings as copied from the older paper: Line Numbers on, but no Page Size / Orientation / Borders.
const caps = (pageSetup = { margins: true, columns: true, lineNumbers: true, sectionBreak: true }) => ({
  schemaVersion: "2", fonts: [], fontSizeMin: 8, fontSizeMax: 72,
  tabs: {
    File: { enabled: false, groups: {} },
    Home: { enabled: true, groups: { font: { enabled: true, options: { fontSize: true, increaseFontSize: true, fontDialog: true } }, paragraph: { enabled: true, options: { bullets: true, paragraphDialog: true, lineSpacing: true } } } },
    Insert: { enabled: true, groups: { tables: { enabled: true, options: { insertTable: true } }, pages: { enabled: true, options: { pageBreak: true } } } },
    Design: { enabled: true, groups: { pageBackground: { enabled: true, options: { pageBorders: true } } } },
    "Page Layout": { enabled: true, groups: { pageSetup: { enabled: true, options: pageSetup } } },
    View: { enabled: true, groups: {} },
  },
});

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
create table public.word_efficiency_tests(id uuid primary key, current_version_id uuid, title text, language text);
create table public.word_efficiency_versions(id uuid primary key, editor_capabilities jsonb);
-- The check as it was (migration 202608240006).
create function public.word_efficiency_command_enabled(c jsonb,command_name text)
returns boolean language sql immutable set search_path=pg_catalog,public as $$select exists(select 1 from jsonb_each(c->'tabs')as tab_entries(tab_name,tab_value)join lateral jsonb_each(tab_entries.tab_value->'groups')as group_entries(group_name,group_value)on true join lateral jsonb_each(group_entries.group_value->'options')as option_entries(option_name,option_value)on true where option_entries.option_name=command_name and(tab_entries.tab_value->>'enabled')::boolean and(group_entries.group_value->>'enabled')::boolean and(option_entries.option_value#>>'{}')::boolean)$$;`);
  return db;
}

test("Hyphenation is allowed wherever Line Numbers is, and Tests 7 and 8 get the tools their questions need", async () => {
  const db = await database();
  await db.query("insert into public.word_efficiency_versions values('00000000-0000-0000-0000-0000000000a7',$1::jsonb),('00000000-0000-0000-0000-0000000000a8',$2::jsonb)",
    [JSON.stringify(caps()), JSON.stringify({ schemaVersion: "2", tabs: {} })]);
  await db.exec(`insert into public.word_efficiency_tests values
    ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-0000000000a7','EFFICIENCY TEST 7','Hindi'),
    ('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-0000000000a8','EFFICIENCY TEST 8','Hindi')`);
  const enabled = async (command, value = caps()) => (await db.query("select public.word_efficiency_command_enabled($1::jsonb,$2) ok", [JSON.stringify(value), command])).rows[0].ok;
  assert.equal(await enabled("hyphenation"), false, "before the fix no setting is called hyphenation");

  const migration = await sql("202611251000_word_hyphenation_command_and_test7_8_tools.sql");
  const results = await db.exec(migration);
  assert.equal(await enabled("hyphenation"), true);
  assert.equal(await enabled("hyphenation", caps({ margins: true, lineNumbers: false })), false, "not when Line Numbers is off");
  assert.equal(await enabled("lineNumbers"), true);
  assert.equal(await enabled("pageSize"), false, "other commands are unchanged");

  const check = results.findLast((result) => result.rows.length).rows;
  assert.deepEqual(check.map((row) => [row.title, row.hyphenation_allowed, row.still_off]), [["EFFICIENCY TEST 7", true, null], ["EFFICIENCY TEST 8", true, null]]);
  const { rows } = await db.query("select id, editor_capabilities c from public.word_efficiency_versions order by id");
  const pageSetup7 = rows[0].c.tabs["Page Layout"].groups.pageSetup.options;
  assert.equal(pageSetup7.pageSize, true);
  assert.equal(pageSetup7.orientation, true);
  assert.equal(rows[0].c.tabs.Home.groups.paragraph.options.borders, true, "Hyphenation's paragraph change needs Borders or Shading");
  assert.equal(rows[1].c.tabs.Insert.groups.headerFooter.options.pageNumber, true);
  // A second run changes nothing.
  await db.exec(migration);
  const { rows: again } = await db.query("select id, editor_capabilities c from public.word_efficiency_versions order by id");
  assert.deepEqual(again, rows);
});

test("the editor records Hyphenation as the Line Numbers command", async () => {
  const editor = await readFile(EDITOR, "utf8");
  assert.match(editor, /if\(action==="hyphenation"\)\{[^\n]*noteOperation\("lineNumbers"\);changed\(\);return\}/);
  assert.doesNotMatch(editor, /noteOperation\("hyphenation"\)/);
});

test("the solved Test 7 paper only uses commands that exist in the editor settings", async () => {
  const model = await read("hindi-word-test7-v2-model.json");
  const { SUPPORTED_WORD_COMMANDS } = await import("../lib/word-editor-capabilities.ts");
  for (const operation of model.operations ?? []) assert.ok(SUPPORTED_WORD_COMMANDS.has(operation) || operation === "hyphenation", operation);
});

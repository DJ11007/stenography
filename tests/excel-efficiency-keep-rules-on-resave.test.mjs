import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Uploading the question paper PDF (any admin save) makes a new version; the form holds one simple rule per
// question, so EXCEL TEST 1's parts and rule criteria would have been lost. Unchanged questions keep them.
test("a re-saved version keeps the previous marking for unchanged questions only", async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create function public.is_aal2_admin() returns boolean language sql stable as $$select true$$;
    create table public.excel_efficiency_versions(id uuid primary key, test_id uuid);
    create table public.excel_efficiency_questions(id uuid primary key default gen_random_uuid(), version_id uuid, question_number int, instruction text, marks numeric);
    create table public.excel_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text, expected_operation text, expected_value jsonb, allocated_marks numeric, partial_marks numeric, additional_criteria jsonb, part_label text);
    create table public.excel_efficiency_attempts(id uuid primary key default gen_random_uuid(), version_id uuid);`);
  await db.exec(`insert into public.excel_efficiency_versions values
      ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1'),
      ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f1'),
      ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000f2');
    insert into public.excel_efficiency_questions(id, version_id, question_number, instruction, marks) values
      ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000000a', 6, 'find the Total fee', 2.5),
      ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-00000000000a', 7, 'Set print Area', 2.5),
      ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-00000000000b', 6, 'find the Total fee ', 2.5),
      ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-00000000000b', 7, 'Set print Area for A1:K20', 2.5);
    insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, additional_criteria, part_label)
    select '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000101', 'sheet', 'rule-criteria', 'null', m, '[{"rule":"value"}]', p from (values ('a', 0.62), ('b', 0.62), ('c', 0.63), ('d', 0.63)) v(p, m);
    insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, additional_criteria)
    values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000102', 'sheet', 'rule-criteria', 'null', 2.5, '[{"rule":"sheet"}]'),
      ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000201', 'I5', 'value', '1', 2.5, '[]'),
      ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000202', 'A1', 'value', '1', 2.5, '[]');`);
  await db.exec((await read("supabase/migrations/202610252000_excel_efficiency_keep_rules_on_resave.sql")).replace(/^begin;|^commit;/gm, ""));
  const copied = (await db.query(`select public.copy_excel_efficiency_grading_rules('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b') n`)).rows[0].n;
  assert.equal(copied, 4, "Question 6's four parts are copied");
  const rules = (await db.query(`select q.question_number n, r.part_label, r.allocated_marks::float m, r.expected_operation op from public.excel_efficiency_grading_rules r join public.excel_efficiency_questions q on q.id = r.question_id where r.version_id = '00000000-0000-0000-0000-00000000000b' order by 1, 2`)).rows;
  assert.deepEqual(rules.map(r => [r.n, r.part_label, r.m, r.op]), [[6, "a", 0.62, "rule-criteria"], [6, "b", 0.62, "rule-criteria"], [6, "c", 0.63, "rule-criteria"], [6, "d", 0.63, "rule-criteria"], [7, null, 2.5, "value"]], "the form's lossy rule is replaced; a reworded question keeps its new rule");
  await assert.rejects(db.query(`select public.copy_excel_efficiency_grading_rules('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c')`), /different tests/);
});

test("the admin save keeps the previous version's marking", async () => {
  const source = await read("app/admin/excel-efficiency-tests/actions.ts");
  assert.match(source, /rpc\("copy_excel_efficiency_grading_rules", \{ p_from_version: previousVersionId, p_to_version: savedTest\.current_version_id \}\)/);
});

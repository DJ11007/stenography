import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

// Real reported bug: a Word/Excel Efficiency test's results page read
// "Maximum Marks" from the TEST's current maximum_marks (version_record),
// not from what the attempt was actually scored out of when the student
// took it. Lowering a test's marks later (e.g. correcting "50" down to the
// real "25" per-language exam pattern) would then retroactively change an
// already-graded student's header total while their own per-question rows
// -- and the results table's own Grand Total, summed from those rows --
// still added up to the OLD total, disagreeing with the new header.
for(const[label,rpc]of[["Word Efficiency","get_word_efficiency_attempt_result"],["Excel Efficiency","get_excel_efficiency_attempt_result"]]){
 test(`${label}'s ${rpc} reads maximumMarks from the attempt's own frozen snapshot, not the test's current live total`,async()=>{
  const sql=await read("supabase/migrations/202609301600_efficiency_results_use_frozen_maximum_marks.sql");
  assert.match(sql,new RegExp(`create or replace function public\\.${rpc}\\(p_attempt_id uuid\\)`));
  assert.match(sql,/frozen_maximum_marks:=coalesce\(\(attempt_record\.snapshot->>'maximum_marks'\)::numeric,version_record\.maximum_marks\);/);
  assert.match(sql,/'maximumMarks',frozen_maximum_marks/);
  assert.doesNotMatch(sql.split(`function public.${rpc}`)[1].split("$$;")[0],/'maximumMarks',version_record\.maximum_marks/);
 });
}

test("the migration is wrapped in a transaction, matching the codebase's convention for multi-function replacements",async()=>{
 const sql=await read("supabase/migrations/202609301600_efficiency_results_use_frozen_maximum_marks.sql");
 assert.match(sql,/^begin;/);
 assert.match(sql,/commit;\s*$/);
});

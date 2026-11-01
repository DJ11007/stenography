-- Live Exam check (2026-11-01): English EFFICIENCY TEST 1's saved model answer has paragraph 1 at 19 pt, because it
-- was saved before font sizes kept half points (18.5 was rounded to 19). Q8 asks for Bookman Old Style 18.5, so the
-- model answer scored 23/25. Students' attempts already keep 18.5. Only the stored model answer changes; the
-- marking rules do not. Safe to run twice.
begin;

update public.word_efficiency_versions as v
set model_answer_snapshot = jsonb_set(v.model_answer_snapshot, '{blocks,0,runs}',
  (select jsonb_agg(case when run->>'fontSize' = '19' then jsonb_set(run, '{fontSize}', '18.5') else run end order by n)
   from jsonb_array_elements(v.model_answer_snapshot->'blocks'->0->'runs') with ordinality r(run, n)))
from public.word_efficiency_tests as t
where t.id = 'b2acc201-6b77-4799-9552-08c8650b29d5' and v.id = t.current_version_id
  and v.model_answer_snapshot->'blocks'->0->'runs'->0->>'fontFamily' = 'Bookman Old Style'
  and exists (select 1 from jsonb_array_elements(v.model_answer_snapshot->'blocks'->0->'runs') run where run->>'fontSize' = '19');

commit;

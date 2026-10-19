-- EFFICIENCY TEST 2 was re-saved by the admin (2026-10-19) as version 3 (d5e201a5...), with a new
-- question paper PDF and Q4(c) changed to "Give first paragraph with font colour green." Saving a
-- new version does not carry the grading rules over, so version 3 had none (no automatic marks).
--
-- Copy every rule from version 2 (e5830d7a...) to version 3, matching questions by number, and
-- give Q4(c) its new check: paragraph 1 in green (Word's Green 00B050; Light Green 92D050 and
-- bright green 00FF00 accepted), no highlight required. Idempotent: does nothing if version 3
-- already has rules.
begin;

insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select 'd5e201a5-1ab8-40e1-beb0-393b40f1db0e', new_q.id, old_r.exact_target, old_r.expected_operation, old_r.expected_value, old_r.allocated_marks, old_r.partial_marks, old_r.additional_criteria, old_r.part_label
from public.word_efficiency_grading_rules old_r
join public.word_efficiency_questions old_q on old_q.id = old_r.question_id
join public.word_efficiency_questions new_q on new_q.version_id = 'd5e201a5-1ab8-40e1-beb0-393b40f1db0e' and new_q.question_number = old_q.question_number
where old_r.version_id = 'e5830d7a-9bbb-4594-9a73-bc3dddc29305'
  and not exists (select 1 from public.word_efficiency_grading_rules where version_id = 'd5e201a5-1ab8-40e1-beb0-393b40f1db0e');

update public.word_efficiency_grading_rules r
   set exact_target = 'blocks.1.runs.0.color',
       expected_value = to_jsonb('00B050'::text),
       additional_criteria = (
         select jsonb_agg(jsonb_build_object('kind','body','place',0,'target',format('blocks.1.runs.%s.color', run_index),'ignoreCase',false,'alternatives',jsonb_build_array('92D050','00FF00'),'expectedValue','00B050') order by run_index)
         from generate_series(0, 4) as run_index)
  from public.word_efficiency_questions q
 where r.version_id = 'd5e201a5-1ab8-40e1-beb0-393b40f1db0e'
   and q.id = r.question_id and q.question_number = 4
   and r.part_label = 'c';

commit;

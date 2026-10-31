-- EXCEL EFFICIENCY TEST 2, version 2 (1866e1f0): its model answer and the marking rules that match the questions.
-- Version 2 only changed rows 40-44 of the starting sheet (the Hindi lines in Kruti Dev became English, plain font)
-- and the wording of Q2, Q7 and Q10; it was saved without a model answer and with version 1's rules copied over.
--
-- Model answer: version 1's (f2d4d587), with
--   * A40:A44 formatting cleared (as HOME > Clear > Clear Formats does: the text is kept) and A40:I44 left indent 10,
--     as the new Q7 asks;
--   * J8 back to the starting sheet's cell (A1's formatting had been pasted there by mistake).
-- Rules (Q1, Q5, Q8, Q9, Q10 keep the copied ones):
--   Q2  B26:J37  a middle + centre  b red font  c 11.5 pt  d Light Green 92D050   (Q6 later replaces A26:A37)
--   Q3  thick box border without the left edge that Q6 replaces: top A25 / B25:I25 / J25, right J26:J36,
--       bottom B37:I37 / J37
--   Q4  AutoFit rows (1-44) and columns (A-M) only
--   Q6  A26:A37 has A4's formatting after Q2's range was formatted (the starting A26:A37 already looks like A4)
--   Q7  a A40:A44 formatting cleared  b left indent 10 on A40:I44
--   Q10 version 1's 25 parts (totals G4:G15 and percentages I4:I15 in Percent Style): its wording changed only to
--       say "Percent Style", so saving did not copy them and it was left with one 0.10 rule from the test form.
-- Safe to run twice.
begin;

update public.excel_efficiency_versions as v2
set model_answer_snapshot = jsonb_set(v1.model_answer_snapshot, '{cells}', (v1.model_answer_snapshot->'cells') || (
  select jsonb_object_agg(ref,
    case
      when ref = 'J8' then coalesce(v2.working_matter_snapshot->'cells'->'J8', '{}'::jsonb)
      when ref ~ '^A' then '{"bold":false,"italic":false,"underline":false,"fontColor":null,"fillColor":null,"border":null,"numberFormat":"General","formula":null,"align":"left","indent":10}'::jsonb
                           || jsonb_build_object('value', v2.working_matter_snapshot->'cells'->ref->'value')
      else coalesce(v2.working_matter_snapshot->'cells'->ref, '{"value":null,"formula":null,"bold":false,"italic":false,"underline":false,"fontColor":null,"fillColor":null,"border":null,"numberFormat":"General"}'::jsonb)
           || '{"align":"left","indent":10}'::jsonb
    end)
  from (select 'J8' as ref union all select c || r from unnest(array['A','B','C','D','E','F','G','H','I']) c, generate_series(40, 44) r) refs))
from public.excel_efficiency_versions as v1
where v2.id = '1866e1f0-35d3-45a1-9303-53e8c7a1e0cf' and v1.id = 'f2d4d587-01b3-4350-9ff6-31a55b50da3f' and v1.model_answer_snapshot is not null;

delete from public.excel_efficiency_grading_rules r
using public.excel_efficiency_questions q
where q.id = r.question_id and r.version_id = '1866e1f0-35d3-45a1-9303-53e8c7a1e0cf' and q.version_id = r.version_id and q.question_number in (2, 3, 4, 6, 7, 10);

insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select '1866e1f0-35d3-45a1-9303-53e8c7a1e0cf'::uuid, n.id, r.exact_target, r.expected_operation, r.expected_value, r.allocated_marks, r.partial_marks, r.additional_criteria, r.part_label
from public.excel_efficiency_grading_rules r
join public.excel_efficiency_questions o on o.id = r.question_id and o.version_id = 'f2d4d587-01b3-4350-9ff6-31a55b50da3f' and o.question_number = 10
join public.excel_efficiency_questions n on n.version_id = '1866e1f0-35d3-45a1-9303-53e8c7a1e0cf' and n.question_number = 10
where r.version_id = 'f2d4d587-01b3-4350-9ff6-31a55b50da3f';

insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select '1866e1f0-35d3-45a1-9303-53e8c7a1e0cf'::uuid, q.id, 'sheet', 'rule-criteria', 'null'::jsonb, rule.marks, null, rule.criteria::jsonb, rule.part_label
from (values
  (2, 'a', 0.62, '[{"rule":"cells","range":"B26:J37","props":{"align":["center"],"vAlign":["middle"]}}]'),
  (2, 'b', 0.62, '[{"rule":"cells","range":"B26:J37","props":{"fontColor":["FF0000"]}}]'),
  (2, 'c', 0.62, '[{"rule":"cells","range":"B26:J37","props":{"fontSize":[11.5]}}]'),
  (2, 'd', 0.64, '[{"rule":"cells","range":"B26:J37","props":{"fillColor":["92D050"]}}]'),
  (3, 'a', 0.41, '[{"rule":"cells","range":"A25","props":{"border":["TL"]}}]'),
  (3, 'b', 0.41, '[{"rule":"cells","range":"B25:I25","props":{"border":["T"]}}]'),
  (3, 'c', 0.42, '[{"rule":"cells","range":"J25","props":{"border":["TR"]}}]'),
  (3, 'd', 0.42, '[{"rule":"cells","range":"J26:J36","props":{"border":["R"]}}]'),
  (3, 'e', 0.42, '[{"rule":"cells","range":"B37:I37","props":{"border":["B"]}}]'),
  (3, 'f', 0.42, '[{"rule":"cells","range":"J37","props":{"border":["RB"]}}]'),
  (4, 'a', 1.25, '[{"rule":"sheet","path":"autoFitRows","includesAll":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44]}]'),
  (4, 'b', 1.25, '[{"rule":"sheet","path":"autoFitCols","includesAll":["A","B","C","D","E","F","G","H","I","J","K","L","M"]}]'),
  (6, null, 2.50, '[{"rule":"sameFormat","source":"A4","targets":["A26","A27","A28","A29","A30","A31","A32","A33","A34","A35","A36","A37"]},{"rule":"cells","range":"B26:J37","props":{"fillColor":["92D050"]}}]'),
  (7, 'a', 1.25, '[{"rule":"cells","range":"A40:A44","props":{"bold":[false],"italic":[false],"underline":[false],"fontColor":[null],"fillColor":[null],"fontSize":[11],"fontFamily":["Calibri"]}}]'),
  (7, 'b', 1.25, '[{"rule":"cells","range":"A40:I44","props":{"align":["left"],"indent":[10]}}]')
) as rule(question_number, part_label, marks, criteria)
join public.excel_efficiency_questions q on q.version_id = '1866e1f0-35d3-45a1-9303-53e8c7a1e0cf' and q.question_number = rule.question_number;

commit;

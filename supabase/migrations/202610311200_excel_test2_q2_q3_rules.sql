-- EXCEL EFFICIENCY TEST 2 (version f2d4d587): Q2 and Q3 rules that the paper's own Q6 cannot break.
-- Q6 ("copy only the formatting of A4:A15 and paste it to A26:A37") replaces the formatting and borders of
-- A26:A37, as in Excel, so the rules made from the Model Answer for Q2 (red / 11.5 pt / light green on A26:A37) and
-- Q3 (the thick left edge A26:A37) failed on the finished model answer itself (23.13 / 25). They now check the cells
-- Q6 leaves alone:
--   Q2  B26:J37  a middle + centre   b red font   c 11.5 pt   d light green fill (Excel's "Light Green", 92D050)
--   Q3  thick box border without the left edge: top A25 / B25:I25 / J25, right J26:J36, bottom B37:I37 / J37
--   Q6  A26:A37 has A4's formatting (same font, colours, fill, borders, alignment) AND the rest of the table shows
--       Q2's light green: in the starting sheet A26:A37 already looks like A4:A15, so on its own the check gave an
--       untouched sheet full marks; with Q2 done first, A26:A37 only looks like A4 again if Q6 was done.
-- Safe to run twice (the three questions' rules are replaced).
begin;

delete from public.excel_efficiency_grading_rules
where version_id = 'f2d4d587-01b3-4350-9ff6-31a55b50da3f'
  and question_id in ('948dc7c9-8d94-49da-8073-86dbcd7cc2e1', '2b610184-1efb-47ec-a885-e8b8f7314e7b',
                      (select id from public.excel_efficiency_questions where version_id = 'f2d4d587-01b3-4350-9ff6-31a55b50da3f' and question_number = 6));

insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select 'f2d4d587-01b3-4350-9ff6-31a55b50da3f'::uuid, q.id, 'sheet', 'rule-criteria', 'null'::jsonb, 2.50, null,
  '[{"rule":"sameFormat","source":"A4","targets":["A26","A27","A28","A29","A30","A31","A32","A33","A34","A35","A36","A37"]},{"rule":"cells","range":"B26:J37","props":{"fillColor":["92D050"]}}]'::jsonb, null
from public.excel_efficiency_questions q where q.version_id = 'f2d4d587-01b3-4350-9ff6-31a55b50da3f' and q.question_number = 6;

insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select 'f2d4d587-01b3-4350-9ff6-31a55b50da3f'::uuid, rule.question_id::uuid, 'sheet', 'rule-criteria', 'null'::jsonb, rule.marks, null, rule.criteria::jsonb, rule.part_label
from (values
  ('948dc7c9-8d94-49da-8073-86dbcd7cc2e1', 'a', 0.62, '[{"rule":"cells","range":"B26:J37","props":{"align":["center"],"vAlign":["middle"]}}]'),
  ('948dc7c9-8d94-49da-8073-86dbcd7cc2e1', 'b', 0.62, '[{"rule":"cells","range":"B26:J37","props":{"fontColor":["FF0000"]}}]'),
  ('948dc7c9-8d94-49da-8073-86dbcd7cc2e1', 'c', 0.62, '[{"rule":"cells","range":"B26:J37","props":{"fontSize":[11.5]}}]'),
  ('948dc7c9-8d94-49da-8073-86dbcd7cc2e1', 'd', 0.64, '[{"rule":"cells","range":"B26:J37","props":{"fillColor":["92D050"]}}]'),
  ('2b610184-1efb-47ec-a885-e8b8f7314e7b', 'a', 0.41, '[{"rule":"cells","range":"A25","props":{"border":["TL"]}}]'),
  ('2b610184-1efb-47ec-a885-e8b8f7314e7b', 'b', 0.41, '[{"rule":"cells","range":"B25:I25","props":{"border":["T"]}}]'),
  ('2b610184-1efb-47ec-a885-e8b8f7314e7b', 'c', 0.42, '[{"rule":"cells","range":"J25","props":{"border":["TR"]}}]'),
  ('2b610184-1efb-47ec-a885-e8b8f7314e7b', 'd', 0.42, '[{"rule":"cells","range":"J26:J36","props":{"border":["R"]}}]'),
  ('2b610184-1efb-47ec-a885-e8b8f7314e7b', 'e', 0.42, '[{"rule":"cells","range":"B37:I37","props":{"border":["B"]}}]'),
  ('2b610184-1efb-47ec-a885-e8b8f7314e7b', 'f', 0.42, '[{"rule":"cells","range":"J37","props":{"border":["RB"]}}]')
) as rule(question_id, part_label, marks, criteria)
where exists (select 1 from public.excel_efficiency_questions q where q.id = rule.question_id::uuid and q.version_id = 'f2d4d587-01b3-4350-9ff6-31a55b50da3f');

commit;

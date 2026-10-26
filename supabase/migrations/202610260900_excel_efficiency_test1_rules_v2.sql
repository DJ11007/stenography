-- English EXCEL EFFICIENCY TEST 1, re-created by the admin from the question paper PDF (test 0ac5a025, version
-- 17f3ee3f, working sheet "LDC EXCEL 1 PRACTICE 1.xlsx"): automatic marking with rule criteria, the same checks as
-- migration 202610251710 had for the earlier copy of this paper, matched to the new questions by number.
--  Q1  A27:L27  a merged and centred  b font colour red  c font size 14
--  Q2  A28:L31  a merged across (A28:L28 ... A31:L31)  b red  c 14 pt
--  Q3  merged and Middle Align  a A1:G1  b A6:G6  c A9:G9
--  Q4  B5's formatting (Format Painter) on  a B13  b B21  c B26
--  Q5  gridlines off
--  Q6  offline total fees  a I5 = 6000  b I13 = 9999  c I21 = 6499 (offline course I16 + typing I18)
--      d 7999 in I26 (I24+I25), or a formula in I25 giving 7999 (the paper says I25, which holds a fee)
--  Q7  print area A1:L31
--  Q8  page number in the header's right section
--  Q9  a landscape  b Legal paper
--  Q10 row and column headings off
-- Re-running replaces this version's rules with the same set.
begin;

delete from public.excel_efficiency_grading_rules where version_id = '17f3ee3f-5568-49bf-b10d-49db13011ddb';

insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select q.version_id, q.id, 'sheet', 'rule-criteria', 'null'::jsonb, r.marks, null, r.criteria::jsonb, r.part
from (values
 (1,'a',0.83,'[{"rule":"merged","ranges":["A27:L27"]},{"rule":"cells","range":"A27","props":{"align":["center"]}}]'),
 (1,'b',0.83,'[{"rule":"cells","range":"A27","props":{"fontColor":["FF0000","C00000"]}}]'),
 (1,'c',0.84,'[{"rule":"cells","range":"A27","props":{"fontSize":[14]}}]'),
 (2,'a',0.83,'[{"rule":"merged","ranges":["A28:L28","A29:L29","A30:L30","A31:L31"]}]'),
 (2,'b',0.83,'[{"rule":"cells","range":"A28:A31","props":{"fontColor":["FF0000","C00000"]}}]'),
 (2,'c',0.84,'[{"rule":"cells","range":"A28:A31","props":{"fontSize":[14]}}]'),
 (3,'a',0.83,'[{"rule":"merged","ranges":["A1:G1"]},{"rule":"cells","range":"A1","props":{"vAlign":["middle"]}}]'),
 (3,'b',0.83,'[{"rule":"merged","ranges":["A6:G6"]},{"rule":"cells","range":"A6","props":{"vAlign":["middle"]}}]'),
 (3,'c',0.84,'[{"rule":"merged","ranges":["A9:G9"]},{"rule":"cells","range":"A9","props":{"vAlign":["middle"]}}]'),
 (4,'a',0.83,'[{"rule":"sameFormat","source":"B5","targets":["B13"]},{"rule":"cells","range":"B13","props":{"bold":[true],"fillColor":["FF0000"]}}]'),
 (4,'b',0.83,'[{"rule":"sameFormat","source":"B5","targets":["B21"]},{"rule":"cells","range":"B21","props":{"bold":[true],"fillColor":["FF0000"]}}]'),
 (4,'c',0.84,'[{"rule":"sameFormat","source":"B5","targets":["B26"]},{"rule":"cells","range":"B26","props":{"bold":[true],"fillColor":["FF0000"]}}]'),
 (5,null,2.5,'[{"rule":"sheet","path":"gridlines","equals":false}]'),
 (6,'a',0.62,'[{"rule":"value","cell":"I5","equals":6000}]'),
 (6,'b',0.62,'[{"rule":"value","cell":"I13","equals":9999}]'),
 (6,'c',0.63,'[{"rule":"value","cell":"I21","equals":6499}]'),
 (6,'d',0.63,'[{"rule":"anyOf","criteria":[{"rule":"value","cell":"I26","equals":7999},{"rule":"value","cell":"I25","equals":7999,"formula":true}]}]'),
 (7,null,2.5,'[{"rule":"sheet","path":"printArea","in":["A1:L31"]}]'),
 (8,null,2.5,'[{"rule":"sheet","path":"header.right","contains":"&[Page]"}]'),
 (9,'a',1.25,'[{"rule":"sheet","path":"orientation","equals":"landscape"}]'),
 (9,'b',1.25,'[{"rule":"sheet","path":"paperSize","equals":"Legal"}]'),
 (10,null,2.5,'[{"rule":"sheet","path":"headings","equals":false}]')
) as r(number, part, marks, criteria)
join public.excel_efficiency_questions q on q.version_id = '17f3ee3f-5568-49bf-b10d-49db13011ddb' and q.question_number = r.number;

update public.excel_efficiency_tests set auto_publish_results = true where id = '0ac5a025-c087-4b6d-ac07-670fa683ef0c';

commit;

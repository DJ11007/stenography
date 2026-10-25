-- English EXCEL EFFICIENCY TEST 1 (version f157a8ee, working sheet "LDC EXCEL 1 PRACTICE 1.xlsx", rows 1-26,
-- columns A-L): automatic marking with rule criteria (migration 202610251700). 2.5 marks a question; a
-- question asking several things gives each part its share. Red accepts Excel's Red (FF0000) and Dark Red.
--  Q1  A27:L27  a merged and centred  b font colour red  c font size 14
--  Q2  A28:L31  a merged across (A28:L28 ... A31:L31)  b red  c 14 pt
--  Q3  merged and Middle Align  a A1:G1  b A6:G6  c A9:G9
--  Q4  B5's formatting (Format Painter) on  a B13  b B21  c B26
--  Q5  gridlines off
--  Q6  offline total fees (0.62 + 0.62 + 0.63 + 0.63)  a I5 = 6000 (I3+I4)  b I13 = 9999 (I11+I12)  c I21 = 6499 (offline course I16 +
--      offline typing I18)  d I26 = 7999 (I24+I25; the paper says I25, which holds a fee in this sheet)
--  Q7  print area A1:L31
--  Q8  page number in the header's right section
--  Q9  a landscape  b Legal paper
--  Q10 row and column headings off
-- Re-running replaces this version's rules with the same set.
begin;

delete from public.excel_efficiency_grading_rules
where version_id = 'f157a8ee-0431-40d9-8395-0665e7fa32a7'
  and exists (select 1 from public.excel_efficiency_versions where id = 'f157a8ee-0431-40d9-8395-0665e7fa32a7');

insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select 'f157a8ee-0431-40d9-8395-0665e7fa32a7'::uuid, r.question_id::uuid, 'rule', 'rule-criteria', 'null'::jsonb, r.marks, null, r.criteria::jsonb, r.part_label
from (values
 ('4f3679c1-3142-4b5f-bccc-aabdfb5e1ea4','a',0.83,'[{"rule":"merged","ranges":["A27:L27"]},{"rule":"cells","range":"A27","props":{"align":["center"]}}]'),
 ('4f3679c1-3142-4b5f-bccc-aabdfb5e1ea4','b',0.83,'[{"rule":"cells","range":"A27","props":{"fontColor":["FF0000","C00000"]}}]'),
 ('4f3679c1-3142-4b5f-bccc-aabdfb5e1ea4','c',0.84,'[{"rule":"cells","range":"A27","props":{"fontSize":[14]}}]'),
 ('0d5e9e21-a6bd-4f86-9170-f213489f44ac','a',0.83,'[{"rule":"merged","ranges":["A28:L28","A29:L29","A30:L30","A31:L31"]}]'),
 ('0d5e9e21-a6bd-4f86-9170-f213489f44ac','b',0.83,'[{"rule":"cells","range":"A28:A31","props":{"fontColor":["FF0000","C00000"]}}]'),
 ('0d5e9e21-a6bd-4f86-9170-f213489f44ac','c',0.84,'[{"rule":"cells","range":"A28:A31","props":{"fontSize":[14]}}]'),
 ('8eb6bcef-9ec4-4735-ab35-63786911f9ee','a',0.83,'[{"rule":"merged","ranges":["A1:G1"]},{"rule":"cells","range":"A1","props":{"vAlign":["middle"]}}]'),
 ('8eb6bcef-9ec4-4735-ab35-63786911f9ee','b',0.83,'[{"rule":"merged","ranges":["A6:G6"]},{"rule":"cells","range":"A6","props":{"vAlign":["middle"]}}]'),
 ('8eb6bcef-9ec4-4735-ab35-63786911f9ee','c',0.84,'[{"rule":"merged","ranges":["A9:G9"]},{"rule":"cells","range":"A9","props":{"vAlign":["middle"]}}]'),
 ('7d5730c7-a11a-4962-9535-f25fc1238887','a',0.83,'[{"rule":"sameFormat","source":"B5","targets":["B13"]},{"rule":"cells","range":"B13","props":{"bold":[true],"fillColor":["FF0000"]}}]'),
 ('7d5730c7-a11a-4962-9535-f25fc1238887','b',0.83,'[{"rule":"sameFormat","source":"B5","targets":["B21"]},{"rule":"cells","range":"B21","props":{"bold":[true],"fillColor":["FF0000"]}}]'),
 ('7d5730c7-a11a-4962-9535-f25fc1238887','c',0.84,'[{"rule":"sameFormat","source":"B5","targets":["B26"]},{"rule":"cells","range":"B26","props":{"bold":[true],"fillColor":["FF0000"]}}]'),
 ('0aa62302-037f-4789-a535-c5a923c6d94a',null,2.5,'[{"rule":"sheet","path":"gridlines","equals":false}]'),
 ('a72bd2f7-0046-4fd5-9268-d06c9f4715a9','a',0.62,'[{"rule":"value","cell":"I5","equals":6000}]'),
 ('a72bd2f7-0046-4fd5-9268-d06c9f4715a9','b',0.62,'[{"rule":"value","cell":"I13","equals":9999}]'),
 ('a72bd2f7-0046-4fd5-9268-d06c9f4715a9','c',0.63,'[{"rule":"value","cell":"I21","equals":6499}]'),
 ('a72bd2f7-0046-4fd5-9268-d06c9f4715a9','d',0.63,'[{"rule":"anyOf","criteria":[{"rule":"value","cell":"I26","equals":7999},{"rule":"value","cell":"I25","equals":7999,"formula":true}]}]'),
 ('142779a8-b156-48e4-a412-1f54abffb982',null,2.5,'[{"rule":"sheet","path":"printArea","in":["A1:L31"]}]'),
 ('5a878c93-787a-4847-8d5c-d28696774342',null,2.5,'[{"rule":"sheet","path":"header.right","contains":"&[Page]"}]'),
 ('0947bc43-6c81-41d5-b4f5-a9d31c5864c0','a',1.25,'[{"rule":"sheet","path":"orientation","equals":"landscape"}]'),
 ('0947bc43-6c81-41d5-b4f5-a9d31c5864c0','b',1.25,'[{"rule":"sheet","path":"paperSize","equals":"Legal"}]'),
 ('72583430-5830-4517-b20d-1e85f7f1c2a3',null,2.5,'[{"rule":"sheet","path":"headings","equals":false}]')
) as r(question_id, part_label, marks, criteria)
where exists (select 1 from public.excel_efficiency_versions where id = 'f157a8ee-0431-40d9-8395-0665e7fa32a7');

commit;

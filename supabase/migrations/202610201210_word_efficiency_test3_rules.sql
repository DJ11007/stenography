-- EFFICIENCY TEST 3 (version 2ab6ed46): automatic marking for all 15 questions, written as rule
-- criteria (migration 202610201200) because almost every question is "every word / every
-- occurrence / the whole column", which position-by-position model-answer criteria grade wrongly.
-- Marks per question are the admin's; a question with parts (a, b, c) gives each part its share,
-- so half-done work earns half marks. Re-running replaces this version's rules with the same set.
--
--  Q1  turquoise highlight on every word of paragraph 1, not on the spaces ("words only")
--  Q2  red "Words only" underline on paragraph 2 (or red underline on the words, none on spaces)
--  Q3  green paragraph shading on paragraph 3 (Green 00B050 or Bright Green 00FF00)
--  Q4  a: paragraph 1 left indent 1.1" (79.2 pt; 2.79-2.8 cm also) b: condensed by 0.5 pt
--  Q5  every "Ajay sir" (5): red highlight, yellow double underline, purple font
--  Q6  a: no "rajasthan" left, 3 "punjab" b: every "punjab" 24 pt red
--  Q7  header "Rajasthan LDC" a: text b: 24 pt green c: red dot-dot-dash underline
--  Q8  footer date a: inserted b: M/d/yyyy h:mm:ss AM/PM (Word's only seconds+AM/PM format; the
--      paper's "07:11:00 PM" is that format) and the footer line left aligned
--  Q9  footer page number a: inserted b: right aligned (Plain Number 3, or Current Position on a
--      right-aligned line)
--  Q10 Moderate margins (1" top/bottom, 0.75" left/right, by gallery or typed)
--  Q11 Legal paper (8.5" x 14")
--  Q12 page border a: top and bottom only b: green wave (single or double)
--  Q13 every table cell with text a: bottom aligned b: centred
--  Q14 a: AutoFit Contents b: a fifth column added after CITY
--  Q15 every cell of the CITY column in a colour other than black or white
begin;

delete from public.word_efficiency_grading_rules
where version_id='2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b'
  and exists(select 1 from public.word_efficiency_versions where id='2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b');

insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria,part_label)
select '2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b'::uuid,rule.question_id::uuid,'rule','model-answer-match-v2','null'::jsonb,rule.marks,null,rule.criteria::jsonb,rule.part_label
from (values
 ('07c2914f-917e-48a9-a3bd-b89637fd79ad',null,1,'[{"rule":"words","kind":"body","place":0,"props":{"highlight":["00FFFF"]},"spaceProps":{"highlight":[null]},"except":["ajay sir"]}]'),
 ('987386e5-b31c-4356-bbe1-252d8ad46a1b',null,1,'[{"rule":"anyOf","criteria":[{"rule":"words","kind":"body","place":1,"props":{"underline":[true],"underlineStyle":["words-only"],"underlineColor":["FF0000"]},"except":["ajay sir"]},{"rule":"words","kind":"body","place":1,"props":{"underline":[true],"underlineColor":["FF0000"]},"spaceProps":{"underline":[false]},"except":["ajay sir"]}]}]'),
 ('81d6c884-1688-4dc5-9fa1-2dc55030bd6f',null,1,'[{"rule":"value","target":"blocks.3.attrs.backgroundColor","kind":"body","place":2,"spec":["rgb(0, 176, 80)","rgb(0, 255, 0)","00B050","00FF00","#00B050","#00FF00"]}]'),
 ('f3876018-a66b-4ca5-aea4-518bef6461a0','a',0.5,'[{"rule":"value","target":"blocks.1.attrs.marginLeft","kind":"body","place":0,"spec":{"regex":"^(79(\\.[0-9]+)?pt|1\\.1in)$"}}]'),
 ('f3876018-a66b-4ca5-aea4-518bef6461a0','b',0.5,'[{"rule":"words","kind":"body","place":0,"props":{"charSpacing":[-0.5]}}]'),
 ('0db67773-6e96-4fc6-8ad6-518151d7a17f',null,1,'[{"rule":"text","kind":"body","find":"ajay sir","minCount":5,"props":{"highlight":["FF0000"],"underline":[true],"underlineStyle":["double"],"underlineColor":["FFFF00"],"color":["7030A0","800080"]}}]'),
 ('79375d7a-1773-49b0-8a7c-06b570f4de6a','a',1,'[{"rule":"text","kind":"body","find":"rajasthan","minCount":0,"maxCount":0},{"rule":"text","kind":"body","find":"punjab","minCount":3,"maxCount":3}]'),
 ('79375d7a-1773-49b0-8a7c-06b570f4de6a','b',1,'[{"rule":"text","kind":"body","find":"punjab","minCount":3,"props":{"fontSize":[24],"color":["FF0000"]}}]'),
 ('6299d0d7-4f03-45bd-8cdf-ed8b6d42af0f','a',0.5,'[{"rule":"text","kind":"header","find":"rajasthan ldc"}]'),
 ('6299d0d7-4f03-45bd-8cdf-ed8b6d42af0f','b',0.75,'[{"rule":"text","kind":"header","find":"rajasthan ldc","props":{"fontSize":[24],"color":["00B050","00FF00"]}}]'),
 ('6299d0d7-4f03-45bd-8cdf-ed8b6d42af0f','c',0.75,'[{"rule":"text","kind":"header","find":"rajasthan ldc","props":{"underline":[true],"underlineStyle":["dot-dot-dash"],"underlineColor":["FF0000"]}}]'),
 ('104cf337-1d8e-45a3-b143-20b6bdca5984','a',1,'[{"rule":"run","kind":"footer","props":{"text":{"regex":"[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}"}}}]'),
 ('104cf337-1d8e-45a3-b143-20b6bdca5984','b',1,'[{"rule":"run","kind":"footer","props":{"text":{"regex":"^\\s*[0-9]{1,2}/[0-9]{1,2}/[0-9]{4} [0-9]{1,2}:[0-9]{2}:[0-9]{2} (AM|PM)\\s*$"}}},{"rule":"value","target":"blocks.0.alignment","kind":"footer","place":0,"spec":["left","justify"]}]'),
 ('7d4d951f-e844-47b9-a8de-e4fae53ee600','a',1,'[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|"}}}]'),
 ('7d4d951f-e844-47b9-a8de-e4fae53ee600','b',1,'[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|[a-z]+\\|right$"}}}]'),
 ('503c62fa-6523-401f-8e0f-d0571b9cc3d6',null,2,'[{"rule":"value","target":"pageLayout.padding","spec":{"regex":"^25\\.4mm 19\\.(05|1)mm 25\\.4mm 19\\.(05|1)mm$"}}]'),
 ('b823b410-f89f-4e6c-be8c-8b30e1093342',null,2,'[{"rule":"value","target":"pageLayout.aspectRatio","spec":["21.59 / 35.56"]},{"rule":"value","target":"pageLayout.maxWidth","spec":["816px"]}]'),
 ('be82f2b7-f778-4dd9-a52d-f50eea5a7780','a',1,'[{"rule":"value","target":"pageLayout.borderSides","spec":["bottom,top"]}]'),
 ('be82f2b7-f778-4dd9-a52d-f50eea5a7780','b',1,'[{"rule":"value","target":"pageLayout.border","spec":{"regex":" (wave|doubleWave) #(00B050|00FF00)( |$)"}}]'),
 ('ef970bc0-4205-42b1-aa4b-3b42fd9fda5d','a',1,'[{"rule":"table","place":0,"nonEmptyOnly":true,"cellProps":{"valign":["bottom"]}}]'),
 ('ef970bc0-4205-42b1-aa4b-3b42fd9fda5d','b',1,'[{"rule":"table","place":0,"nonEmptyOnly":true,"cellProps":{"align":["center"]}}]'),
 ('7065de29-b35e-47d6-ab2d-4d97b3efcf20','a',1,'[{"rule":"table","place":0,"attrs":{"tableLayout":["auto"]}}]'),
 ('7065de29-b35e-47d6-ab2d-4d97b3efcf20','b',1,'[{"rule":"table","place":0,"columns":5,"headerAt":{"3":"city"}}]'),
 ('abf7a79b-d8d8-4d38-a29f-e4ccf4473872',null,2,'[{"rule":"table","place":0,"columnHeader":"city","cellProps":{"color":{"notIn":["000000","FFFFFF","020618"]}}}]')
) as rule(question_id,part_label,marks,criteria)
where exists(select 1 from public.word_efficiency_versions where id='2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b');

commit;

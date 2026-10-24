-- EFFICIENCY TEST 4 (version 6632c423, Hindi paragraphs in Kruti Dev 010): automatic marking for
-- all 5 questions as rule criteria (migrations 202610201200 and 202610241000). 5 marks each, split
-- between the parts by how much each part asks; a part earns its marks when all of it is done.
-- Body places count the paragraphs/table with text: 0-4 the five paragraphs, 5 the table.
--
--  Q1 a (2)   paragraph 1: 14.5 pt, green, italic, thick dark blue underline (the words "ukyank"
--             [नालंदा], "lkseokj" and "jfookj" are left out: Q2 formats them differently)
--     b (1.5) paragraph 2: orange outline (Text Effects > Outline, or Font > Outline in orange)
--     c (1.5) paragraph 1: left and right indent 0.3" (21.6 pt, 0.76 cm)
--  Q2 a (1.5) paragraph 2: first line indent 0.9" (64.8 pt, 2.29 cm)
--     b (1.5) every "ukyank" (20): yellow dot-dash underline
--     c (2)   no "jfookj" [रविवार] left; every "lkseokj" [सोमवार] (10) bold, italic, highlighted
--             purple (Word's highlight palette has no "Purple": Violet 800080, or Pink FF00FF)
--  Q3 a (1.5) header "We are all Indians", 18 pt, centred
--     b (1.5) footer "SAMRADHI CLASSES", 20 pt, on the left
--     c (2)   footer page number on the right (Plain Number 3, or Current Position in the
--             right-hand position)
--  Q4 a (1.5) A3 landscape (42 x 29.7 cm)
--     b (1.5) watermark ",yMhlh" [एलडीसी] in Kruti Dev 010 (or एलडीसी in Unicode), red, not
--             semitransparent
--     c (2)   the 13 list lines as a Multilevel List, any library style, using 2 or more levels
--  Q5 a (1.5) a new row at the end of the table (11 rows)
--     b (1.5) first column in ascending order (Word sorts the new empty row to the top)
--     c (2)   first row and first column shaded in a colour other than black or red
-- Re-running replaces this version's rules with the same set.
begin;

delete from public.word_efficiency_grading_rules
where version_id='6632c423-d16f-4a4b-a600-47b0aecb7bea'
  and exists(select 1 from public.word_efficiency_versions where id='6632c423-d16f-4a4b-a600-47b0aecb7bea');

insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria,part_label)
select '6632c423-d16f-4a4b-a600-47b0aecb7bea'::uuid,rule.question_id::uuid,'rule','model-answer-match-v2','null'::jsonb,rule.marks,null,rule.criteria::jsonb,rule.part_label
from (values
 ('442210ab-cdaf-45f5-b117-aaab60e1d839','a',2,'[{"rule":"words","kind":"body","place":0,"props":{"fontSize":[14.5],"color":["00B050","00FF00","008000","70AD47","548235","375623","006400"],"italic":[true],"underline":[true],"underlineStyle":["thick"],"underlineColor":["002060","000080","00008B","44546A","1F3864","222A35","333F50"]},"except":["ukyank","lkseokj","jfookj"]}]'),
 ('442210ab-cdaf-45f5-b117-aaab60e1d839','b',1.5,'[{"rule":"words","kind":"body","place":1,"props":{"outline":[true],"color":["FFC000","ED7D31","FFA500","FF8C00","C55A11","F4B183"]},"except":["lkseokj","jfookj"]}]'),
 ('442210ab-cdaf-45f5-b117-aaab60e1d839','c',1.5,'[{"rule":"value","target":"blocks.1.attrs.marginLeft","kind":"body","place":0,"spec":{"regex":"^(21\\.[5-7][0-9]*pt|0\\.3in|0\\.7[56][0-9]*cm|7\\.6[0-9]*mm)$"}},{"rule":"value","target":"blocks.1.attrs.marginRight","kind":"body","place":0,"spec":{"regex":"^(21\\.[5-7][0-9]*pt|0\\.3in|0\\.7[56][0-9]*cm|7\\.6[0-9]*mm)$"}}]'),
 ('2ea44dd2-f7ca-4bcf-bfd1-e828da822819','a',1.5,'[{"rule":"value","target":"blocks.2.attrs.specialIndentMode","kind":"body","place":1,"spec":["firstLine"]},{"rule":"value","target":"blocks.2.attrs.specialIndentAmount","kind":"body","place":1,"spec":{"regex":"^(0\\.9in|64\\.[7-9][0-9]*pt|2\\.(29|3)[0-9]*cm|22\\.[89][0-9]*mm)$"}}]'),
 ('2ea44dd2-f7ca-4bcf-bfd1-e828da822819','b',1.5,'[{"rule":"text","kind":"body","find":"ukyank","minCount":20,"props":{"underline":[true],"underlineStyle":["dot-dash"],"underlineColor":["FFFF00"]}}]'),
 ('2ea44dd2-f7ca-4bcf-bfd1-e828da822819','c',2,'[{"rule":"text","kind":"body","find":"jfookj","minCount":0,"maxCount":0},{"rule":"text","kind":"body","find":"lkseokj","minCount":10,"props":{"bold":[true],"italic":[true],"highlight":["800080","FF00FF"]}}]'),
 ('920a33fe-35fa-438e-a1b2-b1bc87b073c1','a',1.5,'[{"rule":"text","kind":"header","find":"we are all indians","props":{"fontSize":[18]}},{"rule":"value","target":"blocks.0.alignment","kind":"header","place":0,"spec":["center"]}]'),
 ('920a33fe-35fa-438e-a1b2-b1bc87b073c1','b',1.5,'[{"rule":"run","kind":"footer","props":{"text":{"regex":"^ *samradhi classes[ \t]*$"},"fontSize":[20]}},{"rule":"value","target":"blocks.0.alignment","kind":"footer","place":0,"spec":["left","justify"]}]'),
 ('920a33fe-35fa-438e-a1b2-b1bc87b073c1','c',2,'[{"rule":"anyOf","criteria":[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|[a-z]+\\|right$"}}},{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|"},"text":{"regex":"^\t\t"}}}]}]'),
 ('f5b19fe9-ab60-4eaf-88a8-890ed87e7eca','a',1.5,'[{"rule":"value","target":"pageLayout.aspectRatio","spec":{"regex":"^42 ?/ ?29\\.7$"}}]'),
 ('f5b19fe9-ab60-4eaf-88a8-890ed87e7eca','b',1.5,'[{"rule":"value","target":"pageLayout.watermark","spec":[",yMhlh","एलडीसी"]},{"rule":"anyOf","criteria":[{"rule":"value","target":"pageLayout.watermarkFont","spec":{"regex":"^kruti dev"}},{"rule":"value","target":"pageLayout.watermark","spec":["एलडीसी"]}]},{"rule":"value","target":"pageLayout.watermarkColor","spec":["FF0000"]},{"rule":"value","target":"pageLayout.watermarkSemitransparent","spec":["false"]}]'),
 ('f5b19fe9-ab60-4eaf-88a8-890ed87e7eca','c',2,'[{"rule":"list","minItems":13,"minLevels":2}]'),
 ('728649f0-bf1e-453e-8635-a6c139b0028f','a',1.5,'[{"rule":"table","place":0,"rowCount":11}]'),
 ('728649f0-bf1e-453e-8635-a6c139b0028f','b',1.5,'[{"rule":"table","place":0,"sortedColumn":0}]'),
 ('728649f0-bf1e-453e-8635-a6c139b0028f','c',2,'[{"rule":"table","place":0,"onlyRow":0,"nonEmptyOnly":true,"cellProps":{"shading":{"notIn":["000000","FF0000"]}}},{"rule":"table","place":0,"onlyColumn":0,"nonEmptyOnly":true,"cellProps":{"shading":{"notIn":["000000","FF0000"]}}}]')
) as rule(question_id,part_label,marks,criteria)
where exists(select 1 from public.word_efficiency_versions where id='6632c423-d16f-4a4b-a600-47b0aecb7bea');

commit;

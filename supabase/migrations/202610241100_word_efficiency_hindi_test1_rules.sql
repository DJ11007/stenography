-- Hindi EFFICIENCY TEST 1 (version 69dbc0f2, 15 questions in Hindi, working document in Kruti Dev 010):
-- automatic marking as rule criteria (migrations 202610201200 and 202610241000). The admin's marks are
-- kept (1.66 each, 1.76 for Q15); a question that asks two things gives each half its marks.
-- Body places count the paragraphs/table with text: 0-4 the five paragraphs. Kruti Dev words are
-- matched as typed (नालंदा = ukyank, रविवार = jfookj, सोमवार = lkseokj); header, footer and watermark
-- text is accepted typed in Kruti Dev keys in a Kruti Dev font, or in Unicode Hindi.
--
--  Q1  a size 14.5 and pink   b italic, thick dark blue underline        (paragraph 1)
--  Q2  blue outline (Text Effects > Outline, or Font > Outline in blue)    (paragraph 2)
--  Q3  a left and right indent 0.3"   b hanging indent 0.6"               (paragraph 1)
--  Q4  first line indent 0.9"                                             (paragraph 2)
--  Q5  every नालंदा (20): red dot-dash underline
--  Q6  a no रविवार left, 10 सोमवार   b सोमवार bold, italic, purple highlight (Violet 800080, Word's purple)
--  Q7  a header "राजस्थान एल.डी.सी." centred   b in 22 pt
--  Q8  a footer "अधिनस्थ बोर्ड" in 22 pt   b on the right (the right-hand position, or a right-aligned footer)
--  Q9  a page number on the left   b starting at 4
--  Q10 a A3   b landscape
--  Q11 a watermark "एल.डी.सी-2026"   b red, not semitransparent
--  Q12 the list as a Multilevel List with 2 or more levels
--  Q13 a new row at the end (11 rows)
--  Q14 first column ascending
--  Q15 the cell of row 3 and column 3 orange (after the sort; or the row that was third, if shaded first)
-- Re-running replaces this version's rules with the same set.
begin;

delete from public.word_efficiency_grading_rules
where version_id='69dbc0f2-9055-41d3-a88b-44a65d8f33c5'
  and exists(select 1 from public.word_efficiency_versions where id='69dbc0f2-9055-41d3-a88b-44a65d8f33c5');

insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria,part_label)
select '69dbc0f2-9055-41d3-a88b-44a65d8f33c5'::uuid,rule.question_id::uuid,'rule','model-answer-match-v2','null'::jsonb,rule.marks,null,rule.criteria::jsonb,rule.part_label
from (values
 ('4dc8e113-9170-4d04-adbe-d83184b3ea27','a',0.83,'[{"rule":"words","kind":"body","place":0,"props":{"fontSize":[14.5],"color":["FF00FF","FF66FF","FF99FF","FFC0CB","FF69B4","FF1493","FF3399","FF66CC","FF99CC","E91E63"]},"except":["ukyank","lkseokj","jfookj"]}]'),
 ('4dc8e113-9170-4d04-adbe-d83184b3ea27','b',0.83,'[{"rule":"words","kind":"body","place":0,"props":{"italic":[true],"underline":[true],"underlineStyle":["thick"],"underlineColor":["002060","000080","00008B","44546A","1F3864","222A35","333F50"]},"except":["ukyank","lkseokj","jfookj"]}]'),
 ('9b6d1e93-f5ec-4722-9376-d990f847056e',null,1.66,'[{"rule":"words","kind":"body","place":1,"props":{"outline":[true],"color":["0070C0","0000FF","5B9BD5","4472C4","00B0F0","2E75B6","1F4E79","2F5597","002060","000080","00008B","0000CC","9DC3E6","BDD7EE"]},"except":["lkseokj","jfookj"]}]'),
 ('b39277b7-44e8-4be2-942b-9cedfd2f70b2','a',0.83,'[{"rule":"value","target":"blocks.1.attrs.marginLeft","kind":"body","place":0,"spec":{"regex":"^(21\\.[5-7][0-9]*pt|0\\.3in|0\\.7[56][0-9]*cm|7\\.6[0-9]*mm)$"}},{"rule":"value","target":"blocks.1.attrs.marginRight","kind":"body","place":0,"spec":{"regex":"^(21\\.[5-7][0-9]*pt|0\\.3in|0\\.7[56][0-9]*cm|7\\.6[0-9]*mm)$"}}]'),
 ('b39277b7-44e8-4be2-942b-9cedfd2f70b2','b',0.83,'[{"rule":"value","target":"blocks.1.attrs.specialIndentMode","kind":"body","place":0,"spec":["hanging"]},{"rule":"value","target":"blocks.1.attrs.specialIndentAmount","kind":"body","place":0,"spec":{"regex":"^(0\\.6in|43\\.[1-3][0-9]*pt|1\\.5[2-3][0-9]*cm|15\\.2[0-9]*mm)$"}}]'),
 ('f5f2aaa0-52bc-42de-8e84-8b761ba0eabc',null,1.66,'[{"rule":"value","target":"blocks.2.attrs.specialIndentMode","kind":"body","place":1,"spec":["firstLine"]},{"rule":"value","target":"blocks.2.attrs.specialIndentAmount","kind":"body","place":1,"spec":{"regex":"^(0\\.9in|64\\.[7-9][0-9]*pt|2\\.(29|3)[0-9]*cm|22\\.[89][0-9]*mm)$"}}]'),
 ('981b99d2-33b1-4dcd-9d1a-7c9b1427d8c5',null,1.66,'[{"rule":"text","kind":"body","find":"ukyank","minCount":20,"props":{"underline":[true],"underlineStyle":["dot-dash"],"underlineColor":["FF0000","C00000"]}}]'),
 ('8b16befa-0e0e-4bb6-9735-3a1ed1ba77d5','a',0.83,'[{"rule":"text","kind":"body","find":"jfookj","minCount":0,"maxCount":0},{"rule":"text","kind":"body","find":"lkseokj","minCount":10}]'),
 ('8b16befa-0e0e-4bb6-9735-3a1ed1ba77d5','b',0.83,'[{"rule":"text","kind":"body","find":"lkseokj","minCount":10,"props":{"bold":[true],"italic":[true],"highlight":["800080"]}}]'),
 ('3542d2c2-d7ee-47e2-96e7-d3738a0fcd49','a',0.83,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"header","find":"jktLFkku ,y-Mh-lh","props":{"fontFamily":{"regex":"^kruti dev"}}},{"rule":"text","kind":"header","find":"राजस्थान एल.डी.सी"}]},{"rule":"value","target":"blocks.0.alignment","kind":"header","place":0,"spec":["center"]}]'),
 ('3542d2c2-d7ee-47e2-96e7-d3738a0fcd49','b',0.83,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"header","find":"jktLFkku ,y-Mh-lh","props":{"fontSize":[22],"fontFamily":{"regex":"^kruti dev"}}},{"rule":"text","kind":"header","find":"राजस्थान एल.डी.सी","props":{"fontSize":[22]}}]}]'),
 ('e10c2f52-730c-4a62-8bec-5c4045ddd41a','a',0.83,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"footer","find":"vf/kuLFk cksMZ","props":{"fontSize":[22],"fontFamily":{"regex":"^kruti dev"}}},{"rule":"text","kind":"footer","find":"अधिनस्थ बोर्ड","props":{"fontSize":[22]}},{"rule":"text","kind":"footer","find":"अधीनस्थ बोर्ड","props":{"fontSize":[22]}}]}]'),
 ('e10c2f52-730c-4a62-8bec-5c4045ddd41a','b',0.83,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"footer","find":"\t\tvf/kuLFk cksMZ"},{"rule":"text","kind":"footer","find":"\t\tअधिनस्थ बोर्ड"},{"rule":"text","kind":"footer","find":"\t\tअधीनस्थ बोर्ड"},{"rule":"value","target":"blocks.0.alignment","kind":"footer","place":0,"spec":["right"]}]}]'),
 ('3c017160-9992-43fa-8509-20647861df7b','a',0.83,'[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|[a-z]+\\|left$"}}}]'),
 ('3c017160-9992-43fa-8509-20647861df7b','b',0.83,'[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|"},"text":{"regex":"^\\s*4\\s*$"}}}]'),
 ('fd046e72-01c6-4669-aa89-b01bc3a02f95','a',0.83,'[{"rule":"value","target":"pageLayout.aspectRatio","spec":{"regex":"^(42 ?/ ?29\\.7|29\\.7 ?/ ?42)$"}}]'),
 ('fd046e72-01c6-4669-aa89-b01bc3a02f95','b',0.83,'[{"rule":"value","target":"pageLayout.aspectRatio","spec":{"regex":"^42 ?/ ?29\\.7$"}}]'),
 ('7f4ec18e-b817-4bef-a5ba-24956d108931','a',0.83,'[{"rule":"value","target":"pageLayout.watermark","spec":[",y-Mh-lh&2026","एल.डी.सी-2026","एल.डी.सी.-2026"]},{"rule":"anyOf","criteria":[{"rule":"value","target":"pageLayout.watermarkFont","spec":{"regex":"^kruti dev"}},{"rule":"value","target":"pageLayout.watermark","spec":["एल.डी.सी-2026","एल.डी.सी.-2026"]}]}]'),
 ('7f4ec18e-b817-4bef-a5ba-24956d108931','b',0.83,'[{"rule":"value","target":"pageLayout.watermarkColor","spec":["FF0000"]},{"rule":"value","target":"pageLayout.watermarkSemitransparent","spec":["false"]}]'),
 ('00e8288a-9f04-454c-a34f-1fa8c7afc4e4',null,1.66,'[{"rule":"list","minItems":13,"minLevels":2}]'),
 ('992073ac-fd42-4679-8d8a-ebad885526f5',null,1.66,'[{"rule":"table","place":0,"rowCount":11}]'),
 ('9253b3aa-492f-44f4-95ed-0ed789c21543',null,1.66,'[{"rule":"table","place":0,"sortedColumn":0}]'),
 ('4be81f9d-d9bb-4646-ba0e-e3fdf558af3c',null,1.76,'[{"rule":"anyOf","criteria":[{"rule":"table","place":0,"onlyRow":2,"onlyColumn":2,"cellProps":{"shading":{"regex":"^(FFC000|ED7D31|FFA500|FF8C00|F4B183|C55A11|F8CBAD)$"}}},{"rule":"table","place":0,"rowCount":11,"onlyRow":10,"onlyColumn":2,"cellProps":{"shading":{"regex":"^(FFC000|ED7D31|FFA500|FF8C00|F4B183|C55A11|F8CBAD)$"}}}]}]')
) as rule(question_id,part_label,marks,criteria)
where exists(select 1 from public.word_efficiency_versions where id='69dbc0f2-9055-41d3-a88b-44a65d8f33c5');

commit;

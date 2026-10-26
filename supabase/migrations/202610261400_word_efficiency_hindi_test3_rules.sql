-- Hindi EFFICIENCY TEST 3 (version 766b80e8; questions in Hindi, working document = a Kruti Dev
-- paragraph and 4 English paragraphs): automatic marking as rule criteria (migrations 202610201200,
-- 202610241000, 202610251000). The admin's marks are kept (1.66 each, 1.76 for Q15); a question that
-- asks two things gives each half its marks. Body places: 0-2 paragraphs 1-3, 3 the table (Q8, once it
-- has data), 4-5 paragraphs 4-5. Paragraphs 4 and 5 are found by their own text, so they are marked the
-- same whether or not the table was made or filled.
--
--  Q1  every "समाज" (Kruti Dev "lekt", 4) in paragraph 1 underlined and struck through
--  Q2  a paragraph 2 in 24 pt   b paragraph 2 line spacing 3.1
--  Q3  paragraph 2 in Arial Narrow
--  Q4  a paragraph 2 in UPPERCASE (Change Case, or All caps)   b paragraph 2 right aligned
--  Q5  a paragraph 2 spacing after removed (0)   b first-line indent 0.58"
--  Q6  paragraph 3 shaded light green
--  Q7  every "document" (3) in paragraph 3 highlighted red
--  Q8  a 6 x 4 table (6 columns x 4 rows, as Word's grid names it, or 6 rows x 4 columns)
--  Q9  a paragraph 4 italic   b red double underline
--  Q10 a paragraph 3 right aligned   b left indent 0.58"
--  Q11 paragraph 5 outline (Text Effects > Outline)
--  Q12 paragraph 1 justified
--  Q13 a the table filled with data (some cell has text)   b every cell Align Bottom Center
--  Q14 the table's first row in 24 pt, in a colour other than black / automatic
--  Q15 paragraph 2 character spacing condensed by 0.3 pt
-- Re-running replaces this version's rules with the same set.
begin;

delete from public.word_efficiency_grading_rules
where version_id='766b80e8-41d9-4a21-be3a-f675cd128b0d'
  and exists(select 1 from public.word_efficiency_versions where id='766b80e8-41d9-4a21-be3a-f675cd128b0d');

insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria,part_label)
select '766b80e8-41d9-4a21-be3a-f675cd128b0d'::uuid,rule.question_id::uuid,'rule','model-answer-match-v2','null'::jsonb,rule.marks,null,rule.criteria::jsonb,rule.part_label
from (values
 ('ed28067f-3972-4cd0-a60e-f8ec250ad8ae',null,1.66,'[{"rule":"text","kind":"body","place":0,"find":"lekt","minCount":4,"props":{"underline":[true],"strike":[true]}}]'),
 ('4742bbea-1796-4938-93a3-b2e00049eaab','a',0.83,'[{"rule":"words","kind":"body","place":1,"props":{"fontSize":[24]}}]'),
 ('4742bbea-1796-4938-93a3-b2e00049eaab','b',0.83,'[{"rule":"value","target":"blocks.1.attrs.lineHeight","kind":"body","place":1,"spec":{"regex":"^3\\.10*$"}}]'),
 ('397687ba-4dae-451b-aab8-86751de7c3f4',null,1.66,'[{"rule":"words","kind":"body","place":1,"props":{"fontFamily":["Arial Narrow"]}}]'),
 ('901667ec-4045-4110-b25c-36a4f2e96740','a',0.83,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"body","place":1,"caseSensitive":true,"find":"ON THE INSERT TAB, THE GALLERIES INCLUDE ITEMS THAT ARE DESIGNED TO COORDINATE WITH THE OVERALL LOOK OF YOUR DOCUMENT"},{"rule":"words","kind":"body","place":1,"props":{"allCaps":[true]}}]}]'),
 ('901667ec-4045-4110-b25c-36a4f2e96740','b',0.83,'[{"rule":"value","target":"blocks.1.alignment","kind":"body","place":1,"spec":["right"]}]'),
 ('412e2979-25f1-42e3-8858-055788bce7ad','a',0.83,'[{"rule":"value","target":"blocks.1.attrs.marginBottom","kind":"body","place":1,"spec":{"regex":"^0(\\.0+)?(pt|px|in|cm|mm)?$"}}]'),
 ('412e2979-25f1-42e3-8858-055788bce7ad','b',0.83,'[{"rule":"value","target":"blocks.1.attrs.specialIndentMode","kind":"body","place":1,"spec":["firstLine"]},{"rule":"value","target":"blocks.1.attrs.specialIndentAmount","kind":"body","place":1,"spec":{"regex":"^(0\\.58in|41\\.7[0-9]*pt|41\\.8pt|1\\.47[0-9]*cm|14\\.7[0-9]*mm)$"}}]'),
 ('0f682329-e260-46ae-aa55-132afc9177e4',null,1.66,'[{"rule":"value","target":"blocks.2.attrs.backgroundColor","kind":"body","place":2,"spec":["rgb(146, 208, 80)","92D050","#92D050"]}]'),
 ('f11629ee-9aeb-4ec2-8d3d-287b359e5099',null,1.66,'[{"rule":"text","kind":"body","place":2,"find":"document","minCount":3,"props":{"highlight":["FF0000","C00000"]}}]'),
 ('9699ce35-b121-4656-9156-a6b7a5d9ed5c',null,1.66,'[{"rule":"anyOf","criteria":[{"rule":"table","place":0,"rowCount":4,"columns":6},{"rule":"table","place":0,"rowCount":6,"columns":4}]}]'),
 ('7f4c12f6-8f72-4ae1-add5-9923c2c7d88a','a',0.83,'[{"rule":"text","kind":"body","find":"Both the Themes gallery and the Quick Styles gallery provide reset commands so that you can always restore the look of your document to the original contained in your current template","props":{"italic":[true]}}]'),
 ('7f4c12f6-8f72-4ae1-add5-9923c2c7d88a','b',0.83,'[{"rule":"text","kind":"body","find":"Both the Themes gallery and the Quick Styles gallery provide reset commands so that you can always restore the look of your document to the original contained in your current template","props":{"underline":[true],"underlineStyle":["double"],"underlineColor":["FF0000","C00000"]}}]'),
 ('eb6daca8-0ba4-4d82-bc9a-d41227061951','a',0.83,'[{"rule":"value","target":"blocks.2.alignment","kind":"body","place":2,"spec":["right"]}]'),
 ('eb6daca8-0ba4-4d82-bc9a-d41227061951','b',0.83,'[{"rule":"value","target":"blocks.2.attrs.marginLeft","kind":"body","place":2,"spec":{"regex":"^(0\\.58in|41\\.7[0-9]*pt|41\\.8pt|1\\.47[0-9]*cm|14\\.7[0-9]*mm)$"}}]'),
 ('c4b12ac0-d5fd-4ab8-9bd5-979be5224f7b',null,1.66,'[{"rule":"text","kind":"body","find":"To change the overall look of your document, choose new Theme designed elements on the Page Layout tab","props":{"outline":[true]}}]'),
 ('e034e4da-955f-418c-8063-5d7e2f585b41',null,1.66,'[{"rule":"value","target":"blocks.0.alignment","kind":"body","place":0,"spec":["justify"]}]'),
 ('0629c3cc-a63e-42c3-9a22-11f0f0d5c5db','a',0.83,'[{"rule":"run","kind":"table","props":{"text":{"regex":"\\S"}}}]'),
 ('0629c3cc-a63e-42c3-9a22-11f0f0d5c5db','b',0.83,'[{"rule":"table","place":0,"cellProps":{"valign":["bottom"],"align":["center"]}}]'),
 ('4da228d7-da36-4ea2-83cd-576f7b59840d',null,1.66,'[{"rule":"table","place":0,"onlyRow":0,"cellProps":{"fontSize":[24],"color":{"regex":"^(?!(000000|020618)$)[0-9A-Fa-f]{6}$"}}}]'),
 ('b7e6613a-146e-4da8-a515-8b42976e6262',null,1.76,'[{"rule":"words","kind":"body","place":1,"props":{"charSpacing":[-0.3]}}]')
) as rule(question_id,part_label,marks,criteria)
where exists(select 1 from public.word_efficiency_versions where id='766b80e8-41d9-4a21-be3a-f675cd128b0d');

commit;

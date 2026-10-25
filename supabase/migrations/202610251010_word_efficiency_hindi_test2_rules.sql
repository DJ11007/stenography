-- Hindi EFFICIENCY TEST 2 (version 33a36886; questions in Hindi, working document = 6 English
-- paragraphs): automatic marking as rule criteria (migrations 202610201200, 202610241000,
-- 202610251000). The admin's marks are kept (1.66 each, 1.76 for Q15); a question that asks two
-- things gives each half its marks. Body places: 0-4 paragraphs 1-5, 5 the copy of paragraph 1
-- pasted after paragraph 5 (Q8), 6 the last paragraph.
--
--  Q1  every "document" (4) in paragraph 1 underlined and struck through
--  Q2  paragraph 2 in 16 pt
--  Q3  a paragraph 1 in Times New Roman   b in 17 pt
--  Q4  paragraph 2 in tOGGLE cASE (case compared exactly)
--  Q5  paragraph 2 right aligned
--  Q6  paragraph 3 highlighted red
--  Q7  paragraph 4 subscript
--  Q8  paragraph 1 copied after paragraph 5
--  Q9  a paragraph 4 italic   b each word underlined (Words only, or the words without the spaces)
--  Q10 the pasted paragraph in Arial Black
--  Q11 paragraph 3 in Capitalize Each Word (case compared exactly)
--  Q12 paragraph 1 centred
--  Q13 paragraph 4 shaded red (Home > Shading; or every word with a red background)
--  Q14 paragraph 3 line spacing 2.0
--  Q15 paragraph 5 a numbered list
-- Re-running replaces this version's rules with the same set.
begin;

delete from public.word_efficiency_grading_rules
where version_id='33a36886-41a9-4993-b167-dc10f2735630'
  and exists(select 1 from public.word_efficiency_versions where id='33a36886-41a9-4993-b167-dc10f2735630');

insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria,part_label)
select '33a36886-41a9-4993-b167-dc10f2735630'::uuid,rule.question_id::uuid,'rule','model-answer-match-v2','null'::jsonb,rule.marks,null,rule.criteria::jsonb,rule.part_label
from (values
 ('d768ad75-585e-428a-a556-b2f3ac95d4ed',null,1.66,'[{"rule":"text","kind":"body","place":0,"find":"document","minCount":4,"props":{"underline":[true],"strike":[true]}}]'),
 ('a62d8323-15cf-4f65-8fc8-d59f4e350566',null,1.66,'[{"rule":"words","kind":"body","place":1,"props":{"fontSize":[16]}}]'),
 ('b42c62bb-8e4e-4423-a19d-e54f42dabe47','a',0.83,'[{"rule":"words","kind":"body","place":0,"props":{"fontFamily":["Times New Roman"]}}]'),
 ('b42c62bb-8e4e-4423-a19d-e54f42dabe47','b',0.83,'[{"rule":"words","kind":"body","place":0,"props":{"fontSize":[17]}}]'),
 ('f12c5688-27f0-47da-bc6c-9f2a01db563a',null,1.66,'[{"rule":"text","kind":"body","place":1,"caseSensitive":true,"find":"bOTH THE tHEMES GALLERY AND THE qUICK sTYLES GALLERY PROVIDE RESET COMMANDS SO THAT YOU CAN ALWAYS RESTORE THE LOOK OF YOUR DOCUMENT"}]'),
 ('595b2e0d-47b8-45db-bc29-d74768ff70fe',null,1.66,'[{"rule":"value","target":"blocks.2.alignment","kind":"body","place":1,"spec":["right"]}]'),
 ('caca2272-2706-4c87-9452-6a3837cf822c',null,1.66,'[{"rule":"words","kind":"body","place":2,"props":{"highlight":["FF0000"]}}]'),
 ('28d7ab67-2d1e-4b1c-8f28-d9499d9cd41f',null,1.66,'[{"rule":"words","kind":"body","place":3,"props":{"subscript":[true]}}]'),
 ('5aae3821-ea4c-42ee-bd7d-2177a847ac14',null,1.66,'[{"rule":"text","kind":"body","place":5,"find":"On the Insert tab, the galleries include items that are designed to coordinate with the overall look of your document"}]'),
 ('4409a5a0-2bf9-478d-963b-e82d2f046561','a',0.83,'[{"rule":"words","kind":"body","place":3,"props":{"italic":[true]}}]'),
 ('4409a5a0-2bf9-478d-963b-e82d2f046561','b',0.83,'[{"rule":"anyOf","criteria":[{"rule":"words","kind":"body","place":3,"props":{"underline":[true],"underlineStyle":["words-only"]}},{"rule":"words","kind":"body","place":3,"props":{"underline":[true]},"spaceProps":{"underline":[false]}}]}]'),
 ('024a6233-fd07-476b-9aa1-55e794d7300c',null,1.66,'[{"rule":"text","kind":"body","place":5,"find":"On the Insert tab, the galleries include items that are designed to coordinate with the overall look of your document"},{"rule":"words","kind":"body","place":5,"props":{"fontFamily":["Arial Black"]}}]'),
 ('c10c0a8a-9f35-467e-8668-c625634ab184',null,1.66,'[{"rule":"text","kind":"body","place":2,"caseSensitive":true,"find":"To Change The Looks Available In The Quick Style Gallery, Use The Change Current Quick Style Set Command."}]'),
 ('7d54e215-2466-4038-b096-634cfdc59583',null,1.66,'[{"rule":"value","target":"blocks.1.alignment","kind":"body","place":0,"spec":["center"]}]'),
 ('4786dc66-0d1d-4d11-9cfd-85c4bc7f8537',null,1.66,'[{"rule":"anyOf","criteria":[{"rule":"value","target":"blocks.4.attrs.backgroundColor","kind":"body","place":3,"spec":["rgb(255, 0, 0)","FF0000","#FF0000","rgb(192, 0, 0)","C00000","#C00000"]},{"rule":"words","kind":"body","place":3,"props":{"highlight":["FF0000","C00000"]}}]}]'),
 ('57957523-8cd9-4807-a896-b29c6c20593a',null,1.66,'[{"rule":"value","target":"blocks.3.attrs.lineHeight","kind":"body","place":2,"spec":{"regex":"^2(\\.0+)?$"}}]'),
 ('fb9ab680-dcb3-403a-b369-589147625f34',null,1.76,'[{"rule":"value","target":"blocks.5.type","kind":"body","place":4,"spec":["list-item"]},{"rule":"value","target":"blocks.5.attrs.listStyle","kind":"body","place":4,"spec":{"regex":"^(decimal|decimal-paren|upper-roman|upper-alpha|lower-alpha|lower-alpha-paren|lower-roman|multilevel-.+)$"}}]')
) as rule(question_id,part_label,marks,criteria)
where exists(select 1 from public.word_efficiency_versions where id='33a36886-41a9-4993-b167-dc10f2735630');

commit;

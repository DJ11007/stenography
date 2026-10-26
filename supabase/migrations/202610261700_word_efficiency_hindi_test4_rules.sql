-- Hindi EFFICIENCY TEST 4 (version 990b4098; questions in Hindi, working document = 6 English paragraphs and
-- the series lines C4H10O2 and A2-B3): automatic marking as rule criteria (migrations 202610201200,
-- 202610241000, 202610251000, 202610261600). The admin's marks are kept (1.66 each, 1.76 for Q15); a
-- question that asks several things gives each part its share. Body places 0-5 are paragraphs 1-6 (numbered
-- or not), 6 the C4H10O2 line, 7 the A2-B3 line.
--
-- Also fixes the working document in place (no attempts yet): in A2-B3 the 2 and the 3 are bold, as in the
-- question paper, so Q9 ("the bold characters") can be answered.
--
--  Q1  paragraphs 1, 3 and 5 a green box (outside) border            (a/b/c one paragraph each)
--  Q2  all six paragraphs numbered
--  Q3  footer: "समृद्धि क्लासेस" (Kruti Dev "le`f) Dyklsl", or Unicode), left aligned
--  Q4  every "galleries": a Arial Narrow  b red  c bold  d strikethrough
--  Q5  paragraph 1: a right aligned  b line spacing 1.36  c UPPERCASE
--  Q6  paragraph 2: a centred  b line spacing 1.25  c UPPERCASE
--  Q7  paragraph 3: a justified  b line spacing 1.0
--  Q8  C4H10O2: 4, 10 and 2 subscript
--  Q9  A2-B3: the bold 2 and 3 superscript
--  Q10 every word "you" in paragraph 4 (not "your"): a green highlight  b red double underline
--  Q11 paragraph 5: a orange outline (Text Effects > Outline)  b bold
--  Q12 footer: a date like 24 December 2026 and a time like 3:30 PM
--  Q13 page: a Moderate margins  b Executive size  c Landscape  d page colour light green
--  Q14 footer page number: a at the right  b starting at 4
--  Q15 paragraph 4: Drop Cap, dropped, 2 lines
-- Re-running replaces this version's rules with the same set.
begin;

update public.word_efficiency_versions v
set working_matter_snapshot=jsonb_set(v.working_matter_snapshot,'{paragraphs,7,runs}',jsonb_build_array(
  (v.working_matter_snapshot->'paragraphs'->7->'runs'->0)||'{"text":"A","bold":false}',
  (v.working_matter_snapshot->'paragraphs'->7->'runs'->0)||'{"text":"2","bold":true}',
  (v.working_matter_snapshot->'paragraphs'->7->'runs'->0)||'{"text":"-B","bold":false}',
  (v.working_matter_snapshot->'paragraphs'->7->'runs'->0)||'{"text":"3","bold":true}'))
where v.id='990b4098-5cd2-4f9b-9e58-904a3e532417'
  and jsonb_array_length(v.working_matter_snapshot->'paragraphs'->7->'runs')=1
  and v.working_matter_snapshot->'paragraphs'->7->'runs'->0->>'text'='A2-B3'
  and not exists(select 1 from public.word_efficiency_attempts a where a.version_id=v.id);

delete from public.word_efficiency_grading_rules
where version_id='990b4098-5cd2-4f9b-9e58-904a3e532417'
  and exists(select 1 from public.word_efficiency_versions where id='990b4098-5cd2-4f9b-9e58-904a3e532417');

insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria,part_label)
select '990b4098-5cd2-4f9b-9e58-904a3e532417'::uuid,rule.question_id::uuid,'rule','model-answer-match-v2','null'::jsonb,rule.marks,null,rule.criteria::jsonb,rule.part_label
from (values
 ('71d4ee1a-835d-4d30-b56a-9d5fe872ad76','a',0.55,'[{"rule":"value","target":"blocks.0.attrs.border","kind":"body","place":0,"spec":{"regex":"(?i)rgb\\((0, 176, 80|146, 208, 80|112, 173, 71|0, 128, 0|0, 255, 0|84, 130, 53|56, 87, 36|169, 206, 145|198, 222, 181)\\)|#?(00B050|92D050|70AD47|008000|00FF00)"}}]'),
 ('71d4ee1a-835d-4d30-b56a-9d5fe872ad76','b',0.55,'[{"rule":"value","target":"blocks.2.attrs.border","kind":"body","place":2,"spec":{"regex":"(?i)rgb\\((0, 176, 80|146, 208, 80|112, 173, 71|0, 128, 0|0, 255, 0|84, 130, 53|56, 87, 36|169, 206, 145|198, 222, 181)\\)|#?(00B050|92D050|70AD47|008000|00FF00)"}}]'),
 ('71d4ee1a-835d-4d30-b56a-9d5fe872ad76','c',0.56,'[{"rule":"value","target":"blocks.4.attrs.border","kind":"body","place":4,"spec":{"regex":"(?i)rgb\\((0, 176, 80|146, 208, 80|112, 173, 71|0, 128, 0|0, 255, 0|84, 130, 53|56, 87, 36|169, 206, 145|198, 222, 181)\\)|#?(00B050|92D050|70AD47|008000|00FF00)"}}]'),
 ('57eeb56f-8602-48f5-badc-14548a9af33b',null,1.66,'[{"rule":"value","target":"blocks.0.attrs.listStyle","kind":"body","place":0,"spec":{"regex":"^(decimal|decimal-paren|upper-roman|upper-alpha|lower-alpha|lower-alpha-paren|lower-roman|multilevel-decimal|multilevel-paren|multilevel-outline)$"}},{"rule":"value","target":"blocks.1.attrs.listStyle","kind":"body","place":1,"spec":{"regex":"^(decimal|decimal-paren|upper-roman|upper-alpha|lower-alpha|lower-alpha-paren|lower-roman|multilevel-decimal|multilevel-paren|multilevel-outline)$"}},{"rule":"value","target":"blocks.2.attrs.listStyle","kind":"body","place":2,"spec":{"regex":"^(decimal|decimal-paren|upper-roman|upper-alpha|lower-alpha|lower-alpha-paren|lower-roman|multilevel-decimal|multilevel-paren|multilevel-outline)$"}},{"rule":"value","target":"blocks.3.attrs.listStyle","kind":"body","place":3,"spec":{"regex":"^(decimal|decimal-paren|upper-roman|upper-alpha|lower-alpha|lower-alpha-paren|lower-roman|multilevel-decimal|multilevel-paren|multilevel-outline)$"}},{"rule":"value","target":"blocks.4.attrs.listStyle","kind":"body","place":4,"spec":{"regex":"^(decimal|decimal-paren|upper-roman|upper-alpha|lower-alpha|lower-alpha-paren|lower-roman|multilevel-decimal|multilevel-paren|multilevel-outline)$"}},{"rule":"value","target":"blocks.5.attrs.listStyle","kind":"body","place":5,"spec":{"regex":"^(decimal|decimal-paren|upper-roman|upper-alpha|lower-alpha|lower-alpha-paren|lower-roman|multilevel-decimal|multilevel-paren|multilevel-outline)$"}}]'),
 ('cd52b41f-9cb2-46e1-8a75-5dce2078fa06',null,1.66,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"footer","find":"le`f) Dyklsl"},{"rule":"text","kind":"footer","find":"समृद्धि क्लासेस"}]},{"rule":"value","target":"blocks.0.alignment","kind":"footer","place":0,"spec":["left","justify"]}]'),
 ('ad9b81d7-0016-442e-b821-ae7341bed671','a',0.42,'[{"rule":"text","kind":"body","find":"galleries","minCount":2,"props":{"fontFamily":["Arial Narrow"]}}]'),
 ('ad9b81d7-0016-442e-b821-ae7341bed671','b',0.42,'[{"rule":"text","kind":"body","find":"galleries","minCount":2,"props":{"color":["FF0000","C00000"]}}]'),
 ('ad9b81d7-0016-442e-b821-ae7341bed671','c',0.41,'[{"rule":"text","kind":"body","find":"galleries","minCount":2,"props":{"bold":[true]}}]'),
 ('ad9b81d7-0016-442e-b821-ae7341bed671','d',0.41,'[{"rule":"text","kind":"body","find":"galleries","minCount":2,"props":{"strike":[true]}}]'),
 ('fc6ad12d-5260-4d89-bf11-de4ca8ddd5d8','a',0.55,'[{"rule":"value","target":"blocks.0.alignment","kind":"body","place":0,"spec":["right"]}]'),
 ('fc6ad12d-5260-4d89-bf11-de4ca8ddd5d8','b',0.55,'[{"rule":"value","target":"blocks.0.attrs.lineHeight","kind":"body","place":0,"spec":{"regex":"^1\\.360*$"}}]'),
 ('fc6ad12d-5260-4d89-bf11-de4ca8ddd5d8','c',0.56,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"body","place":0,"caseSensitive":true,"find":"VIDEO PROVIDES A POWERFUL WAY TO HELP YOU PROVE YOUR POINT"},{"rule":"words","kind":"body","place":0,"props":{"allCaps":[true]}}]}]'),
 ('052d9b96-7971-404c-a1d9-83e24387777d','a',0.55,'[{"rule":"value","target":"blocks.1.alignment","kind":"body","place":1,"spec":["center"]}]'),
 ('052d9b96-7971-404c-a1d9-83e24387777d','b',0.55,'[{"rule":"value","target":"blocks.1.attrs.lineHeight","kind":"body","place":1,"spec":{"regex":"^1\\.250*$"}}]'),
 ('052d9b96-7971-404c-a1d9-83e24387777d','c',0.56,'[{"rule":"anyOf","criteria":[{"rule":"text","kind":"body","place":1,"caseSensitive":true,"find":"FOR EXAMPLE, YOU CAN ADD A MATCHING COVER PAGE, HEADER, AND SIDEBAR"},{"rule":"words","kind":"body","place":1,"props":{"allCaps":[true]}}]}]'),
 ('671e82ce-678b-4daf-9945-5c7d374e589b','a',0.83,'[{"rule":"value","target":"blocks.2.alignment","kind":"body","place":2,"spec":["justify"]}]'),
 ('671e82ce-678b-4daf-9945-5c7d374e589b','b',0.83,'[{"rule":"value","target":"blocks.2.attrs.lineHeight","kind":"body","place":2,"spec":{"regex":"^1(\\.0+)?$"}}]'),
 ('30c573ca-48f3-45bc-9e25-abadd6896095',null,1.66,'[{"rule":"text","kind":"body","place":6,"find":"4","props":{"subscript":[true]}},{"rule":"text","kind":"body","place":6,"find":"10","props":{"subscript":[true]}},{"rule":"text","kind":"body","place":6,"find":"2","props":{"subscript":[true]}}]'),
 ('671eb64d-5867-40bf-9dd7-f818b7127d3b',null,1.66,'[{"rule":"text","kind":"body","place":7,"find":"2","props":{"superscript":[true]}},{"rule":"text","kind":"body","place":7,"find":"3","props":{"superscript":[true]}}]'),
 ('63de9e4e-6bf8-4f45-aa25-4bcc0d1b2d63','a',0.83,'[{"rule":"text","kind":"body","place":3,"find":"you","wholeWord":true,"minCount":6,"props":{"highlight":["00FF00","008000","00B050","92D050"]}}]'),
 ('63de9e4e-6bf8-4f45-aa25-4bcc0d1b2d63','b',0.83,'[{"rule":"text","kind":"body","place":3,"find":"you","wholeWord":true,"minCount":6,"props":{"underline":[true],"underlineStyle":["double"],"underlineColor":["FF0000","C00000"]}}]'),
 ('7e5abbee-31c8-4a50-85c7-0f3abeffbd0d','a',0.83,'[{"rule":"words","kind":"body","place":4,"props":{"outline":[true],"color":["FFC000","ED7D31","F4B183","C55A11","FF8C00","FFA500"]}}]'),
 ('7e5abbee-31c8-4a50-85c7-0f3abeffbd0d','b',0.83,'[{"rule":"words","kind":"body","place":4,"props":{"bold":[true]}}]'),
 ('b8204b45-d107-47b9-9443-eb1dfacfcc98',null,1.66,'[{"rule":"run","kind":"footer","props":{"text":{"regex":"(?i)[0-9]{1,2} (january|february|march|april|may|june|july|august|september|october|november|december) [0-9]{4}"}}},{"rule":"run","kind":"footer","props":{"text":{"regex":"[0-9]{1,2}:[0-9]{2}(:[0-9]{2})? ?[AaPp][Mm]"}}}]'),
 ('f56d3ce9-b8b5-4860-b50e-0b6bb6470e0a','a',0.42,'[{"rule":"value","target":"pageLayout.padding","spec":{"regex":"^25\\.4mm 19(\\.0?5|\\.1)mm 25\\.4mm 19(\\.0?5|\\.1)mm$"}}]'),
 ('f56d3ce9-b8b5-4860-b50e-0b6bb6470e0a','b',0.42,'[{"rule":"value","target":"pageLayout.aspectRatio","spec":{"regex":"^(26\\.67 ?/ ?18\\.41|18\\.41 ?/ ?26\\.67)$"}}]'),
 ('f56d3ce9-b8b5-4860-b50e-0b6bb6470e0a','c',0.41,'[{"rule":"value","target":"pageLayout.aspectRatio","spec":{"regex":"^(26\\.67 ?/ ?18\\.41|27\\.94 ?/ ?21\\.59|29\\.7 ?/ ?21|35\\.56 ?/ ?21\\.59|21 ?/ ?14\\.8|21\\.59 ?/ ?13\\.97|42 ?/ ?29\\.7)$"}}]'),
 ('f56d3ce9-b8b5-4860-b50e-0b6bb6470e0a','d',0.41,'[{"rule":"value","target":"pageLayout.backgroundColor","spec":{"regex":"(?i)^#?(92D050|C6EFCE|E2EFDA|C5E0B4|A9D08E|CCFFCC|90EE90)$"}}]'),
 ('c649fdf6-ce09-4033-bca5-f415ee4a83bb','a',0.83,'[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|[a-z]+\\|right$"}}}]'),
 ('c649fdf6-ce09-4033-bca5-f415ee4a83bb','b',0.83,'[{"rule":"run","kind":"footer","props":{"text":{"regex":"^\\s*4\\s*$"},"field":{"regex":"^page-number\\|"}}}]'),
 ('a3413688-5be2-4530-945c-4394b3ce64d0',null,1.76,'[{"rule":"value","target":"blocks.3.attrs.dropCap","kind":"body","place":3,"spec":[true]},{"rule":"value","target":"blocks.3.attrs.dropCapLines","kind":"body","place":3,"spec":[2]}]')
) as rule(question_id,part_label,marks,criteria)
where exists(select 1 from public.word_efficiency_versions where id='990b4098-5cd2-4f9b-9e58-904a3e532417');

update public.word_efficiency_tests set auto_publish_results=true
where id='d22b43e0-e756-4877-8786-7703eb0d541b' and current_version_id='990b4098-5cd2-4f9b-9e58-904a3e532417';

commit;

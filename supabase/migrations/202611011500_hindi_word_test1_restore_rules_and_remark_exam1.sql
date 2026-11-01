-- Hindi EFFICIENCY TEST 1 (version 69dbc0f2): restore its hand-written marking rules and re-mark RSMSSB LDC Exam-1's
-- Word answers. On 29 Oct most of this version's rules were regenerated automatically from an incomplete model answer,
-- so they checked for formatting being ABSENT (Q3/Q4 no hanging/first-line indent, Q10 page not A3, Q11 no watermark
-- colour) or demanded unrelated things (Q2 also required every table cell to be 12 pt Segoe UI). This puts back the
-- rules of migration 202610241100 (model 25/25, untouched paper 0 in tests/word-efficiency-hindi-test1-rules-runtime),
-- then marks each exam answer again from the document the student handed in, and updates its marks in the exam.
-- Safe to run twice.
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

create temporary table remarked (student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare
  v_version constant uuid := '69dbc0f2-9055-41d3-a88b-44a65d8f33c5';
  v_section uuid; v_max numeric; a record; q record; earned numeric; parts jsonb; model jsonb; total numeric; maximum numeric; passing numeric;
begin
  select ls.id, ls.max_marks into v_section, v_max from public.live_exam_sections ls
   where ls.exam_id = '6a97650a-4c93-4e4f-aae5-d454ce8ca0e6' and ls.kind = 'word';
  select model_answer_snapshot, passing_marks into model, passing from public.word_efficiency_versions where id = v_version;
  for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
           from public.live_exam_section_attempts l join public.word_efficiency_attempts w on w.id = l.attempt_id
           left join public.profiles p on p.id = w.student_id
           where l.section_id = v_section and w.version_id = v_version and w.final_document_snapshot is not null loop
    for q in select s.id, s.question_id, s.maximum_marks from public.word_efficiency_question_scores s where s.attempt_id = a.id and s.graded_by is null loop
      select scored.awarded, scored.parts into earned, parts
        from public.word_efficiency_score_question(a.doc, v_version, q.question_id, q.maximum_marks, model) as scored;
      update public.word_efficiency_question_scores set awarded_marks = coalesce(earned, 0), part_scores = parts, grading_status = 'graded',
        teacher_comment = case when coalesce(earned, 0) >= q.maximum_marks then 'Full marks: the required change was found in your document.'
                               when coalesce(earned, 0) <= 0 then 'No marks: the required change was not found in your document.'
                               else 'Partial marks: you used the right tool, but the result is different from what was asked.' end,
        updated_at = now()
      where id = q.id;
    end loop;
    select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum from public.word_efficiency_question_scores where attempt_id = a.id;
    update public.word_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
        'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end,
        'passed', case when passing is null then null else total >= passing end), updated_at = now()
      where id = a.id;
    update public.live_exam_section_attempts set marks = least(total, v_max) where section_id = v_section and attempt_id = a.id;
    insert into remarked values (a.name, nullif(a.result->>'marks', '')::numeric, total);
  end loop;
end $$;

select * from remarked order by student;

commit;

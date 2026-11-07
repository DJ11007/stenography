-- Word efficiency marking: no marks for questions a student never attempted, and no part marks inside a question.
--
-- 1. word_efficiency_score_question now
--    * ignores any rule that already passes on the untouched starting document (it checks nothing the student did;
--      e.g. Hindi TEST 2's rules rebuilt on 29 Oct expected the starting "left" / "1.15" / "paragraph", so Q5, Q12,
--      Q14 and Q15 were free; English TEST 3 Q3 and Q6 were free the same way), and
--    * gives a question its full marks only when every check of that question is met -- otherwise 0. The paper's
--      total is split equally over its questions; a question's marks are not split again into parts.
-- 2. English EFFICIENCY TEST 3 (version 4, 8b02dec0): the rules rebuilt from the model answer on 5 Nov checked the
--    model's exact footer text "11/5/2026 11:07:59 AM" (no student can type that moment again), Q3 accepted "no
--    background", Q6 checked the paragraph's text instead of the replacement. Written again from the questions
--    (the same starting document as version 1, whose hand-written checks are reused where the question is unchanged).
-- 3. Hindi EFFICIENCY TEST 2 (version 33a36886): the hand-written checks of 202610251010 are put back.
-- 4. Every finished attempt of these two versions is marked again (scores are fixed at submission).
begin;

create or replace function public.word_efficiency_score_question(p_document jsonb, p_version_id uuid, p_question_id uuid, p_maximum numeric, p_model jsonb, out awarded numeric, out parts jsonb)
returns record
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  rule record; earned numeric; start_earned numeric;
  words_document jsonb; start_document jsonb; start_words jsonb;
  counted integer := 0; all_done boolean := true;
begin
  awarded := null; parts := null;
  if not exists (select 1 from public.word_efficiency_grading_rules g where g.version_id = p_version_id and g.question_id = p_question_id) then
    return;
  end if;
  words_document := public.word_efficiency_merge_word_runs(p_document);
  begin
    select public.word_efficiency_initial_editor_document(v.working_matter_snapshot) into start_document
      from public.word_efficiency_versions v where v.id = p_version_id;
    start_words := public.word_efficiency_merge_word_runs(start_document);
  exception when others then
    start_document := null; start_words := null;
  end;
  for rule in select g.* from public.word_efficiency_grading_rules g
              where g.version_id = p_version_id and g.question_id = p_question_id
              order by coalesce(g.part_label, ''), g.created_at, g.id loop
    -- A check the untouched document already meets says nothing about what the student did: it gives nothing.
    if start_document is not null then
      start_earned := greatest(
        coalesce(public.evaluate_word_efficiency_grading_rule(start_document, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0),
        coalesce(public.evaluate_word_efficiency_grading_rule(start_words, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0));
      if start_earned >= rule.allocated_marks - 0.005 then continue; end if;
    end if;
    counted := counted + 1;
    earned := greatest(
      coalesce(public.evaluate_word_efficiency_grading_rule(p_document, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0),
      coalesce(public.evaluate_word_efficiency_grading_rule(words_document, rule.exact_target, rule.expected_operation, rule.expected_value, rule.allocated_marks, rule.partial_marks, rule.additional_criteria, p_model), 0));
    if earned < rule.allocated_marks - 0.005 then all_done := false; end if;
  end loop;
  -- The whole question, or nothing.
  awarded := case when counted > 0 and all_done then p_maximum else 0 end;
end $function$;

-- English EFFICIENCY TEST 3, version 4
delete from public.word_efficiency_grading_rules
where version_id = '8b02dec0-32af-42f6-9491-b7cd177e9766'
  and exists (select 1 from public.word_efficiency_versions where id = '8b02dec0-32af-42f6-9491-b7cd177e9766');

insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select '8b02dec0-32af-42f6-9491-b7cd177e9766', q.id, 'rule', 'model-answer-match-v2', 'null'::jsonb, q.marks, null, r.criteria::jsonb, null
from (values
 -- Q1 first paragraph, words only (not the spaces), turquoise highlight
 (1, '[{"kind":"body","rule":"words","place":0,"props":{"highlight":["00FFFF"]},"except":["ajay sir"],"spaceProps":{"highlight":[null]}}]'),
 -- Q2 second paragraph, words-only underline in red
 (2, '[{"rule":"anyOf","criteria":[{"kind":"body","rule":"words","place":1,"props":{"underline":[true],"underlineColor":["FF0000"],"underlineStyle":["words-only"]},"except":["ajay sir"]},{"kind":"body","rule":"words","place":1,"props":{"underline":[true],"underlineColor":["FF0000"]},"except":["ajay sir"],"spaceProps":{"underline":[false]}}]}]'),
 -- Q3 third paragraph, green background (shading)
 (3, '[{"kind":"body","rule":"value","spec":["rgb(0, 176, 80)","rgb(0, 255, 0)","00B050","00FF00","#00B050","#00FF00"],"place":2,"target":"blocks.3.attrs.backgroundColor"}]'),
 -- Q4 first paragraph: left indent 1.1" and condensed 0.5 pt
 (4, '[{"kind":"body","rule":"value","spec":{"regex":"^(79(\\.[0-9]+)?pt|1\\.1in)$"},"place":0,"target":"blocks.1.attrs.marginLeft"},{"kind":"body","rule":"words","place":0,"props":{"charSpacing":[-0.5]}}]'),
 -- Q5 "Ajay sir" in the fourth paragraph: red highlight, yellow double underline, purple font
 (5, '[{"find":"Ajay sir","kind":"body","rule":"text","place":3,"props":{"color":["7030A0","800080"],"highlight":["FF0000"],"underline":[true],"underlineColor":["FFFF00"],"underlineStyle":["double"]},"caseSensitive":true}]'),
 -- Q6 every "rajasthan" replaced by "punjab", in red with double strikethrough
 (6, '[{"find":"rajasthan","kind":"body","rule":"text","maxCount":0,"minCount":0,"caseSensitive":true},{"find":"punjab","kind":"body","rule":"text","minCount":2,"props":{"color":["FF0000"],"doubleStrike":[true]}}]'),
 -- Q7 "Rajasthan LDC" in the header, centred, 24 pt green, red dot-dot-dash underline
 (7, '[{"find":"rajasthan ldc","kind":"header","rule":"text","props":{"color":["00B050","00FF00"],"fontSize":[24],"underline":[true],"underlineColor":["FF0000"],"underlineStyle":["dot-dot-dash"]}},{"kind":"header","rule":"value","spec":["center"],"place":0,"target":"blocks.0.alignment"}]'),
 -- Q8 date and time in the footer as M/d/yyyy h:mm:ss AM/PM, footer left aligned
 (8, '[{"kind":"footer","rule":"run","props":{"text":{"regex":"^\\s*[0-9]{1,2}/[0-9]{1,2}/[0-9]{4} [0-9]{1,2}:[0-9]{2}:[0-9]{2} (AM|PM)\\s*$"}}},{"kind":"footer","rule":"value","spec":["left","justify"],"place":0,"target":"blocks.0.alignment"}]'),
 -- Q9 page number on the right of the footer
 (9, '[{"kind":"footer","rule":"run","props":{"field":{"regex":"^page-number\\|[a-z]+\\|right$"}}}]'),
 -- Q10 Moderate margins
 (10, '[{"rule":"value","spec":{"regex":"^25\\.4mm 19\\.(05|1)mm 25\\.4mm 19\\.(05|1)mm$"},"target":"pageLayout.padding"}]'),
 -- Q11 Legal page size
 (11, '[{"rule":"value","spec":["21.59 / 35.56"],"target":"pageLayout.aspectRatio"},{"rule":"value","spec":["816px"],"target":"pageLayout.maxWidth"}]'),
 -- Q12 green wave page border, top and bottom
 (12, '[{"rule":"value","spec":["bottom,top"],"target":"pageLayout.borderSides"},{"rule":"value","spec":{"regex":" (wave|doubleWave) #(00B050|00FF00)( |$)"},"target":"pageLayout.border"}]'),
 -- Q13 table data Align Bottom Center
 (13, '[{"rule":"table","place":0,"cellProps":{"valign":["bottom"],"align":["center"]},"nonEmptyOnly":true}]'),
 -- Q14 AutoFit Contents and a fifth column after "city"
 (14, '[{"rule":"table","attrs":{"tableLayout":["auto"]},"place":0},{"rule":"table","place":0,"columns":5,"headerAt":{"3":"city"}}]'),
 -- Q15 fourth column (city) in Gray, Accent 3, Lighter 40%
 (15, '[{"rule":"table","place":0,"cellProps":{"color":["C9C9C9"]},"columnHeader":"city"}]')
) as r(question_number, criteria)
join public.word_efficiency_questions q on q.version_id = '8b02dec0-32af-42f6-9491-b7cd177e9766' and q.question_number = r.question_number;

-- Hindi EFFICIENCY TEST 2 (only version)
delete from public.word_efficiency_grading_rules
where version_id = '33a36886-41a9-4993-b167-dc10f2735630'
  and exists (select 1 from public.word_efficiency_versions where id = '33a36886-41a9-4993-b167-dc10f2735630');

insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select '33a36886-41a9-4993-b167-dc10f2735630'::uuid, rule.question_id::uuid, 'rule', 'model-answer-match-v2', 'null'::jsonb, rule.marks, null, rule.criteria::jsonb, rule.part_label
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
) as rule(question_id, part_label, marks, criteria)
where exists (select 1 from public.word_efficiency_versions where id = '33a36886-41a9-4993-b167-dc10f2735630');

-- English EFFICIENCY TEST 2, version 5 (8c8317da): its rules rebuilt from the model answer on 3 Nov demanded the
-- model's own header font (Segoe UI 12 pt, colour 020618) and an exact gutter value. Version 3 (d5e201a5) has the
-- same document and the same five questions, with checks written for each of (a) (b) (c); copied by question number.
delete from public.word_efficiency_grading_rules
where version_id = '8c8317da-4971-4abd-9c86-71755715af08'
  and exists (select 1 from public.word_efficiency_grading_rules where version_id = 'd5e201a5-1ab8-40e1-beb0-393b40f1db0e');

insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select '8c8317da-4971-4abd-9c86-71755715af08', q5.id, r.exact_target, r.expected_operation, r.expected_value, r.allocated_marks, r.partial_marks, r.additional_criteria, r.part_label
from public.word_efficiency_grading_rules r
join public.word_efficiency_questions q3 on q3.id = r.question_id
join public.word_efficiency_questions q5 on q5.version_id = '8c8317da-4971-4abd-9c86-71755715af08' and q5.question_number = q3.question_number
where r.version_id = 'd5e201a5-1ab8-40e1-beb0-393b40f1db0e';

-- Hindi EFFICIENCY TEST 1, version 5 (01d2b34f): questions reworded on 4 Nov (Q1 Green, Accent 6, Darker 25%; Q5 and
-- Q6 one paragraph only; Q8 www.sctyping.com centred 18 pt; Q13 also AutoFit Window; Q15 first row, Orange, Accent 2,
-- Lighter 40%); the rebuilt rules had Q5 unchecked, Q3 on the header, Q8/Q9 on the model's exact footer text and
-- Segoe UI font, Q14 on the model's exact rows. Written from the questions (Kruti Dev text: ukyank = नालंदा,
-- jfookj = रविवार, lkseokj = सोमवार); unchanged questions keep version 2's hand-written checks.
delete from public.word_efficiency_grading_rules
where version_id = '01d2b34f-e288-4ee9-a34c-1b1b32b92e97'
  and exists (select 1 from public.word_efficiency_versions where id = '01d2b34f-e288-4ee9-a34c-1b1b32b92e97');

insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select '01d2b34f-e288-4ee9-a34c-1b1b32b92e97', q.id, 'rule', 'model-answer-match-v2', 'null'::jsonb, q.marks, null, r.criteria::jsonb, null
from (values
 (1, '[{"kind":"body","rule":"words","place":0,"props":{"color":["548235"],"fontSize":[14.5],"italic":[true],"underline":[true],"underlineStyle":["thick"],"underlineColor":["002060","000080","00008B","44546A","1F3864","222A35","333F50"]}}]'),
 (2, '[{"kind":"body","rule":"words","place":1,"props":{"color":["0070C0","0000FF","5B9BD5","4472C4","00B0F0","2E75B6","1F4E79","2F5597","002060","000080","00008B","0000CC","9DC3E6","BDD7EE"],"outline":[true]}}]'),
 (3, '[{"kind":"body","rule":"value","spec":{"regex":"^(21\\.[5-7][0-9]*pt|0\\.3in|0\\.7[56][0-9]*cm|7\\.6[0-9]*mm)$"},"place":0,"target":"blocks.1.attrs.marginLeft"},{"kind":"body","rule":"value","spec":{"regex":"^(21\\.[5-7][0-9]*pt|0\\.3in|0\\.7[56][0-9]*cm|7\\.6[0-9]*mm)$"},"place":0,"target":"blocks.1.attrs.marginRight"},{"kind":"body","rule":"value","spec":["hanging"],"place":0,"target":"blocks.1.attrs.specialIndentMode"},{"kind":"body","rule":"value","spec":{"regex":"^(0\\.6in|43\\.[1-3][0-9]*pt|1\\.5[2-3][0-9]*cm|15\\.2[0-9]*mm)$"},"place":0,"target":"blocks.1.attrs.specialIndentAmount"}]'),
 (4, '[{"kind":"body","rule":"value","spec":["firstLine"],"place":1,"target":"blocks.2.attrs.specialIndentMode"},{"kind":"body","rule":"value","spec":{"regex":"^(0\\.9in|64\\.[7-9][0-9]*pt|2\\.(29|3)[0-9]*cm|22\\.[89][0-9]*mm)$"},"place":1,"target":"blocks.2.attrs.specialIndentAmount"}]'),
 (5, '[{"find":"ukyank","kind":"body","rule":"text","place":1,"minCount":4,"props":{"underline":[true],"underlineColor":["FF0000","C00000"],"underlineStyle":["dot-dash"]}}]'),
 (6, '[{"find":"jfookj ","kind":"body","rule":"text","place":2,"maxCount":0,"minCount":0},{"find":"lkseokj","kind":"body","rule":"text","place":2,"minCount":1}]'),
 (7, '[{"rule":"anyOf","criteria":[{"find":"jktLFkku ,y-Mh-lh","kind":"header","rule":"text","props":{"fontSize":[22],"fontFamily":{"regex":"^kruti dev"}}},{"find":"राजस्थान एल.डी.सी","kind":"header","rule":"text","props":{"fontSize":[22]}}]},{"kind":"header","rule":"value","spec":["center"],"place":0,"target":"blocks.0.alignment"}]'),
 (8, '[{"find":"www.sctyping.com","kind":"footer","rule":"text","props":{"fontSize":[18]}},{"rule":"anyOf","criteria":[{"kind":"footer","rule":"value","spec":["center"],"place":0,"target":"blocks.0.alignment"},{"find":"\twww.sctyping.com","kind":"footer","rule":"text"}]}]'),
 (9, '[{"kind":"footer","rule":"run","props":{"field":{"regex":"^page-number\\|[a-z]+\\|left$"}}},{"kind":"footer","rule":"run","props":{"text":{"regex":"^\\s*4"},"field":{"regex":"^page-number\\|"}}}]'),
 (10, '[{"rule":"value","spec":{"regex":"^42 ?/ ?29\\.7$"},"target":"pageLayout.aspectRatio"}]'),
 (11, '[{"rule":"value","spec":[",y-Mh-lh&2026","एल.डी.सी-2026","एल.डी.सी.-2026"],"target":"pageLayout.watermark"},{"rule":"value","spec":["FF0000"],"target":"pageLayout.watermarkColor"},{"rule":"value","spec":["false"],"target":"pageLayout.watermarkSemitransparent"}]'),
 (12, '[{"rule":"list","minItems":13,"minLevels":2}]'),
 (13, '[{"rule":"table","place":0,"rowCount":11},{"rule":"table","place":0,"attrs":{"tableLayout":["window"]}}]'),
 (14, '[{"rule":"table","place":0,"sortedColumn":0}]'),
 (15, '[{"rule":"table","place":0,"onlyRow":0,"onlyColumn":2,"cellProps":{"shading":["F4B183"]}}]')
) as r(question_number, criteria)
join public.word_efficiency_questions q on q.version_id = '01d2b34f-e288-4ee9-a34c-1b1b32b92e97' and q.question_number = r.question_number;

create temporary table remarked (test text, student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare
  v record; a record; q record; earned numeric; total numeric; maximum numeric;
begin
  for v in select id, model_answer_snapshot model, passing_marks passing from public.word_efficiency_versions
           where id in ('8b02dec0-32af-42f6-9491-b7cd177e9766', '33a36886-41a9-4993-b167-dc10f2735630', '8c8317da-4971-4abd-9c86-71755715af08', '01d2b34f-e288-4ee9-a34c-1b1b32b92e97') loop
    for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
             from public.word_efficiency_attempts w left join public.profiles p on p.id = w.student_id
             where w.version_id = v.id and w.final_document_snapshot is not null loop
      for q in select s.id, s.question_id, s.maximum_marks from public.word_efficiency_question_scores s
               where s.attempt_id = a.id and s.graded_by is null loop
        select scored.awarded into earned
          from public.word_efficiency_score_question(a.doc, v.id, q.question_id, q.maximum_marks, v.model) as scored;
        update public.word_efficiency_question_scores set awarded_marks = coalesce(earned, 0), part_scores = null, grading_status = 'graded',
          teacher_comment = case when coalesce(earned, 0) >= q.maximum_marks then 'Full marks: the required change was found in your document.'
                                 else 'No marks: the question was not done as asked.' end,
          updated_at = now()
        where id = q.id;
      end loop;
      select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum from public.word_efficiency_question_scores where attempt_id = a.id;
      if a.result ? 'marks' then
        update public.word_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
            'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end,
            'passed', case when v.passing is null then null else total >= v.passing end), updated_at = now()
          where id = a.id;
        update public.live_exam_section_attempts l set marks = least(total, ls.max_marks)
          from public.live_exam_sections ls where ls.id = l.section_id and l.attempt_id = a.id;
      end if;
      insert into remarked values (case v.id when '33a36886-41a9-4993-b167-dc10f2735630' then 'Hindi TEST 2' when '01d2b34f-e288-4ee9-a34c-1b1b32b92e97' then 'Hindi TEST 1' when '8c8317da-4971-4abd-9c86-71755715af08' then 'English TEST 2' else 'English TEST 3' end,
                                   a.name, nullif(a.result->>'marks', '')::numeric, total);
    end loop;
  end loop;
end $$;

select test, student, old_marks, new_marks from remarked order by test, student;

commit;

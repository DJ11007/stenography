-- English EXCEL EFFICIENCY TEST 2 (version 4, 347e7895): marks did not match what students did. Its rules were built
-- on 2 Nov from the admin's model answer, which skipped Q5 (A25:J25 has none of 16pt / double underline / orange)
-- and Q7's "clear all the formatting" (A40:A44 kept bold, dark red), so the rules demanded those mistakes: the model
-- answer itself scored 1.25 / 1.88 / 0 / 1.25 on Q2 / Q3 / Q5 / Q7, Q2(a) checked no alignment at all, Q6(a) checked
-- A25:J25 against Q5, and Q6 gave 1.25 to students who never touched it.
--
-- Q2, Q3, Q5, Q6 and Q7 are rewritten from the questions (Q1, Q4, Q8-Q10 were already right):
--   Q2  B26:J37 (Q6 then reformats A26:A37): (a) Middle + Center (b) Gold, Accent 4, Darker 25% BF9000 (c) 11.5 pt
--       (d) Blue, Accent 5, Lighter 60% B4C6E7
--   Q3  thick (or medium) box border in Blue-Gray, Text 2, Darker 25% 323F4F round A25:J37 -- the column-A cells below
--       the header are not checked, as Q6's paste-formatting from A4:A15 (no border) removes their left border
--   Q5  A25:J25 (a) 16 pt (b) double underline (c) Orange, Accent 2, Lighter 40% F4B183
--   Q6  A26:A37 formatted like A4:A15, counted once Q2's formatting is on the table (before that, untouched cells
--       already look like A4:A15)
--   Q7  (a) A40:A44 cleared (no bold, underline or colour) (b) A40:I44 left indent 10
-- and re-marks every finished attempt of this version. Checked with a dry run: of 31 attempts 22 go up, 6 lose only
-- marks they had not earned (Q6 never done; one Q7 not cleared), 3 stay; ajai verma's Q1-Q8 attempt 14.70 -> 20.
begin;

delete from public.excel_efficiency_grading_rules
where version_id = '347e7895-cdea-4a0e-94a2-3947b83830c1'
  and question_id in (select id from public.excel_efficiency_questions where version_id = '347e7895-cdea-4a0e-94a2-3947b83830c1' and question_number in (2, 3, 5, 6, 7));

insert into public.excel_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select '347e7895-cdea-4a0e-94a2-3947b83830c1', q.id, 'sheet', 'rule-criteria', 'null'::jsonb, r.marks, null, r.criteria::jsonb, r.part_label
from (values
 (2, 'a', 0.63, '[{"rule":"cells","range":"B26:J37","props":{"align":["center"],"vAlign":["middle"]}}]'),
 (2, 'b', 0.63, '[{"rule":"cells","range":"B26:J37","props":{"fontColor":["BF9000"]}}]'),
 (2, 'c', 0.62, '[{"rule":"cells","range":"B26:J37","props":{"fontSize":[11.5]}}]'),
 (2, 'd', 0.62, '[{"rule":"cells","range":"B26:J37","props":{"fillColor":["B4C6E7"]}}]'),
 (3, 'a', 0.42, '[{"rule":"cells","range":"A25","props":{"border":["T!@323F4FL!@323F4F","T@323F4FL@323F4F"]}}]'),
 (3, 'b', 0.42, '[{"rule":"cells","range":"B25:I25","props":{"border":["T!@323F4F","T@323F4F"]}}]'),
 (3, 'c', 0.42, '[{"rule":"cells","range":"J25","props":{"border":["T!@323F4FR!@323F4F","T@323F4FR@323F4F"]}}]'),
 (3, 'd', 0.42, '[{"rule":"cells","range":"J26:J36","props":{"border":["R!@323F4F","R@323F4F"]}}]'),
 (3, 'e', 0.41, '[{"rule":"cells","range":"B37:I37","props":{"border":["B!@323F4F","B@323F4F"]}}]'),
 (3, 'f', 0.41, '[{"rule":"cells","range":"J37","props":{"border":["R!@323F4FB!@323F4F","R@323F4FB@323F4F"]}}]'),
 (5, 'a', 0.83, '[{"rule":"cells","range":"A25:J25","props":{"fontSize":[16]}}]'),
 (5, 'b', 0.83, '[{"rule":"cells","range":"A25:J25","props":{"underline":[true],"underlineStyle":["double","doubleAccounting"]}}]'),
 (5, 'c', 0.84, '[{"rule":"cells","range":"A25:J25","props":{"fillColor":["F4B183"]}}]'),
 (6, null, 2.5, '[{"rule":"allOf","criteria":[{"rule":"cells","range":"A26:A37","props":{"fillColor":[null],"fontColor":[null],"fontSize":[11],"bold":[false],"numberFormat":["Number"],"align":["center"],"vAlign":["middle"]}},{"rule":"cells","range":"B26","props":{"fillColor":["B4C6E7"]}}]}]'),
 (7, 'a', 1.25, '[{"rule":"cells","range":"A40:A44","props":{"bold":[false],"underline":[false],"fontColor":[null]}}]'),
 (7, 'b', 1.25, '[{"rule":"cells","range":"A40:I44","props":{"align":["left"],"indent":[10]}}]')
) as r(question_number, part_label, marks, criteria)
join public.excel_efficiency_questions q on q.version_id = '347e7895-cdea-4a0e-94a2-3947b83830c1' and q.question_number = r.question_number;

create temporary table remarked (student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare
  v_version constant uuid := '347e7895-cdea-4a0e-94a2-3947b83830c1';
  a record; q record; total numeric; maximum numeric; passing numeric;
begin
  select passing_marks into passing from public.excel_efficiency_versions where id = v_version;
  for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
           from public.excel_efficiency_attempts w left join public.profiles p on p.id = w.student_id
           where w.version_id = v_version and w.final_document_snapshot is not null loop
    for q in select s.id, s.question_id, s.maximum_marks from public.excel_efficiency_question_scores s
             where s.attempt_id = a.id and s.graded_by is null loop
      update public.excel_efficiency_question_scores
         set awarded_marks = coalesce(public.excel_efficiency_score_question(a.doc, v_version, q.question_id, q.maximum_marks), 0),
             grading_status = 'graded', updated_at = now()
       where id = q.id;
    end loop;
    select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum from public.excel_efficiency_question_scores where attempt_id = a.id;
    if a.result ? 'marks' then
      update public.excel_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
          'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end,
          'passed', case when passing is null then null else total >= passing end), updated_at = now()
        where id = a.id;
      update public.live_exam_section_attempts l set marks = least(total, ls.max_marks)
        from public.live_exam_sections ls where ls.id = l.section_id and l.attempt_id = a.id;
    end if;
    insert into remarked values (a.name, nullif(a.result->>'marks', '')::numeric, total);
  end loop;
end $$;

select student, old_marks, new_marks from remarked order by student;

commit;

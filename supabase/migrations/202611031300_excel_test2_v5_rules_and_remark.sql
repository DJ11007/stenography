-- English EXCEL EFFICIENCY TEST 2, version 5 (697c94a9, saved 3 Nov with a new Q1/Q3/Q6/Q7): its rules were again
-- built from the model answer, so Q2 checked no alignment and judged A26:A37 against values Q6 then changes, Q6's
-- rule had no criteria at all (nobody could ever score it), and Q3 copied the model's border, which has no colour.
-- Rewritten from the questions:
--   Q2  B26:J37 (Q6 reformats A26:A37): (a) Middle + Center (b) BF9000 (c) 11.5 pt (d) B4C6E7
--   Q3  every cell of A25:J37 bordered on all sides (a), in Blue-Gray, Text 2, Darker 25% 323F4F (b); the marking
--       engine compares case-insensitively, so thin and medium lines both count (thick "!" too)
--   Q6  A26:A37 (a) Tahoma (b) bold + italic (c) 15 pt (d) Double Accounting underline (e) Blue, Accent 1 font colour
--       (5B9BD5, or 4472C4 -- what newer Excel calls Blue, Accent 1, and what the model answer used) + strikethrough
-- and re-marks this version's attempts (dry run: the only attempt, ajai verma, 18.75 -> 23.75; the model answer now
-- 2.5 / 1.25 / 2.5 on Q2 / Q3 / Q6 -- its Q3 border has no colour).
-- The rules are marked exact_target 'hand-written', so the Model Answer page keeps them when a question is solved again.
begin;

delete from public.excel_efficiency_grading_rules
where version_id = '697c94a9-141f-4867-8bc4-fec53bab3035'
  and question_id in (select id from public.excel_efficiency_questions where version_id = '697c94a9-141f-4867-8bc4-fec53bab3035' and question_number in (2, 3, 6));

insert into public.excel_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select '697c94a9-141f-4867-8bc4-fec53bab3035', q.id, 'hand-written', 'rule-criteria', 'null'::jsonb, r.marks, null, r.criteria::jsonb, r.part_label
from (values
 (2, 'a', 0.63, '[{"rule":"cells","range":"B26:J37","props":{"align":["center"],"vAlign":["middle"]}}]'),
 (2, 'b', 0.63, '[{"rule":"cells","range":"B26:J37","props":{"fontColor":["BF9000"]}}]'),
 (2, 'c', 0.62, '[{"rule":"cells","range":"B26:J37","props":{"fontSize":[11.5]}}]'),
 (2, 'd', 0.62, '[{"rule":"cells","range":"B26:J37","props":{"fillColor":["B4C6E7"]}}]'),
 (3, 'a', 1.25, '[{"rule":"cells","range":"A25:J37","props":{"border":["TRBL","T!R!B!L!","T@323F4FR@323F4FB@323F4FL@323F4F","T!@323F4FR!@323F4FB!@323F4FL!@323F4F"]}}]'),
 (3, 'b', 1.25, '[{"rule":"cells","range":"A25:J37","props":{"border":["T@323F4FR@323F4FB@323F4FL@323F4F","T!@323F4FR!@323F4FB!@323F4FL!@323F4F"]}}]'),
 (6, 'a', 0.5, '[{"rule":"cells","range":"A26:A37","props":{"fontFamily":["Tahoma"]}}]'),
 (6, 'b', 0.5, '[{"rule":"cells","range":"A26:A37","props":{"bold":[true],"italic":[true]}}]'),
 (6, 'c', 0.5, '[{"rule":"cells","range":"A26:A37","props":{"fontSize":[15]}}]'),
 (6, 'd', 0.5, '[{"rule":"cells","range":"A26:A37","props":{"underline":[true],"underlineStyle":["doubleAccounting"]}}]'),
 (6, 'e', 0.5, '[{"rule":"cells","range":"A26:A37","props":{"fontColor":["5B9BD5","4472C4"],"strike":[true]}}]')
) as r(question_number, part_label, marks, criteria)
join public.excel_efficiency_questions q on q.version_id = '697c94a9-141f-4867-8bc4-fec53bab3035' and q.question_number = r.question_number;

create temporary table remarked (student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare
  v_version constant uuid := '697c94a9-141f-4867-8bc4-fec53bab3035';
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

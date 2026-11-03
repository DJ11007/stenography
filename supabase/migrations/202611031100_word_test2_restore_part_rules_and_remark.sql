-- English EFFICIENCY TEST 2 (version 4, 829c29b6): marks did not match what students did. A Model Answer save on
-- 2 Nov (08:10 UTC) replaced the paper's part-by-part rules -- each question is three parts (a) (b) (c), 1.67 +
-- 1.67 + 1.66 marks -- with one all-or-nothing rule per question built from the model answer, several of them on
-- one part only (Q1: just the A5 page size gave all 5 marks) or on the wrong thing (Q4: green font in paragraph 1
-- instead of the last paragraph's light green background).
--
-- Version 3 (d5e201a5) has exactly the same questions and working document and still has the part rules (the
-- model answer scores 25/25 with them). This copies them to version 4 by question number and re-marks the 32
-- attempts submitted since the rules were replaced (attempts before that were marked with these same rules).
-- Checked with a dry run: model answer 25/25; part marks now follow each part done; a part not done gives
-- nothing (e.g. Q5(b) "Top Centre" -- a row only centred, not top aligned, no longer gets the part).
begin;

delete from public.word_efficiency_grading_rules where version_id = '829c29b6-11be-4f4c-9922-c27aa948140b'
  and exists (select 1 from public.word_efficiency_grading_rules where version_id = 'd5e201a5-1ab8-40e1-beb0-393b40f1db0e');

insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select '829c29b6-11be-4f4c-9922-c27aa948140b', q4.id, r.exact_target, r.expected_operation, r.expected_value, r.allocated_marks, r.partial_marks, r.additional_criteria, r.part_label
from public.word_efficiency_grading_rules r
join public.word_efficiency_questions q3 on q3.id = r.question_id
join public.word_efficiency_questions q4 on q4.version_id = '829c29b6-11be-4f4c-9922-c27aa948140b' and q4.question_number = q3.question_number
  and btrim(q4.instruction) = btrim(q3.instruction) and q4.marks = q3.marks
where r.version_id = 'd5e201a5-1ab8-40e1-beb0-393b40f1db0e';

create temporary table remarked (student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare
  v_version constant uuid := '829c29b6-11be-4f4c-9922-c27aa948140b';
  a record; q record; earned numeric; parts jsonb; model jsonb; total numeric; maximum numeric; passing numeric;
begin
  select model_answer_snapshot, passing_marks into model, passing from public.word_efficiency_versions where id = v_version;
  for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
           from public.word_efficiency_attempts w left join public.profiles p on p.id = w.student_id
           where w.version_id = v_version and w.final_document_snapshot is not null
             and w.submitted_at > '2026-11-02 08:10:00+00' loop
    for q in select s.id, s.question_id, s.maximum_marks from public.word_efficiency_question_scores s
             where s.attempt_id = a.id and s.graded_by is null loop
      select scored.awarded, scored.parts into earned, parts
        from public.word_efficiency_score_question(a.doc, v_version, q.question_id, q.maximum_marks, model) as scored;
      update public.word_efficiency_question_scores set awarded_marks = coalesce(earned, 0), part_scores = parts, grading_status = 'graded',
        teacher_comment = case when coalesce(earned, 0) >= q.maximum_marks then 'Full marks: the required change was found in your document.'
                               when coalesce(earned, 0) <= 0 then 'No marks: the required change was not found in your document.'
                               else 'Partial marks: some parts of the question were done as asked, others were not.' end,
        updated_at = now()
      where id = q.id;
    end loop;
    select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum from public.word_efficiency_question_scores where attempt_id = a.id;
    if a.result ? 'marks' then
      update public.word_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
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

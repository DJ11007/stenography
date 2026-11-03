-- English EFFICIENCY TEST 3 (version 6ab8016d): Q8 (date and time in the footer) and Q9 (page number on the right)
-- gave no marks to correct answers. The Model Answer save of 2 Nov regenerated their rules as an exact match of the
-- model's footer text, "11/2/2026 10:36:42 PM\t\t1" -- the moment the model answer was made, which no attempt can
-- ever type again. This puts back the hand-written rules the test had (202610201210, version 1):
--   Q8  a: a date in the footer  b: M/d/yyyy h:mm:ss AM/PM (the paper's "10/13/1993 07:11:00 PM" format) and the
--       footer line left aligned
--   Q9  a: a page-number field in the footer  b: placed on the right (Plain Number 3, or Current Position after Tabs)
-- and re-marks Q8 and Q9 of every finished attempt of this version (scores are fixed at submission). Checked with a
-- dry run: 11 question scores go up, none go down, none were teacher-marked, none are in a live exam; 15 attempts
-- of 8 students get new totals (e.g. 13 -> 17), 5 of them still waiting for review keep no result.
begin;

delete from public.word_efficiency_grading_rules
where version_id = '6ab8016d-7852-4a2a-9f65-d2c30410c332'
  and question_id in ('7b2c3212-8948-473c-8abb-fed98a1479e3', '993b9ad4-4552-448c-b897-eacd4bddab6c');

insert into public.word_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select '6ab8016d-7852-4a2a-9f65-d2c30410c332'::uuid, rule.question_id::uuid, 'rule', 'model-answer-match-v2', 'null'::jsonb, rule.marks, null, rule.criteria::jsonb, rule.part_label
from (values
 ('7b2c3212-8948-473c-8abb-fed98a1479e3', 'a', 1, '[{"rule":"run","kind":"footer","props":{"text":{"regex":"[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}"}}}]'),
 ('7b2c3212-8948-473c-8abb-fed98a1479e3', 'b', 1, '[{"rule":"run","kind":"footer","props":{"text":{"regex":"^\\s*[0-9]{1,2}/[0-9]{1,2}/[0-9]{4} [0-9]{1,2}:[0-9]{2}:[0-9]{2} (AM|PM)\\s*$"}}},{"rule":"value","target":"blocks.0.alignment","kind":"footer","place":0,"spec":["left","justify"]}]'),
 ('993b9ad4-4552-448c-b897-eacd4bddab6c', 'a', 1, '[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|"}}}]'),
 ('993b9ad4-4552-448c-b897-eacd4bddab6c', 'b', 1, '[{"rule":"run","kind":"footer","props":{"field":{"regex":"^page-number\\|[a-z]+\\|right$"}}}]')
) as rule(question_id, part_label, marks, criteria)
where exists (select 1 from public.word_efficiency_versions where id = '6ab8016d-7852-4a2a-9f65-d2c30410c332');

create temporary table remarked (attempt uuid, student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare
  v_version constant uuid := '6ab8016d-7852-4a2a-9f65-d2c30410c332';
  a record; q record; earned numeric; parts jsonb; model jsonb; total numeric; maximum numeric; passing numeric; changed boolean;
begin
  select model_answer_snapshot, passing_marks into model, passing from public.word_efficiency_versions where id = v_version;
  for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
           from public.word_efficiency_attempts w left join public.profiles p on p.id = w.student_id
           where w.version_id = v_version and w.final_document_snapshot is not null loop
    changed := false;
    for q in select s.id, s.question_id, s.maximum_marks, s.awarded_marks from public.word_efficiency_question_scores s
             join public.word_efficiency_questions x on x.id = s.question_id
             where s.attempt_id = a.id and s.graded_by is null and x.question_number in (8, 9) loop
      select scored.awarded, scored.parts into earned, parts
        from public.word_efficiency_score_question(a.doc, v_version, q.question_id, q.maximum_marks, model) as scored;
      if coalesce(earned, 0) is distinct from q.awarded_marks then changed := true; end if;
      update public.word_efficiency_question_scores set awarded_marks = coalesce(earned, 0), part_scores = parts, grading_status = 'graded',
        teacher_comment = case when coalesce(earned, 0) >= q.maximum_marks then 'Full marks: the required change was found in your document.'
                               when coalesce(earned, 0) <= 0 then 'No marks: the required change was not found in your document.'
                               else 'Partial marks: you used the right tool, but the result is different from what was asked.' end,
        updated_at = now()
      where id = q.id;
    end loop;
    if changed then
      select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum from public.word_efficiency_question_scores where attempt_id = a.id;
      -- Attempts still waiting for review (submitted, no result yet) keep no result: only their question scores change.
      if a.result ? 'marks' then
      update public.word_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
          'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end,
          'passed', case when passing is null then null else total >= passing end), updated_at = now()
        where id = a.id;
      update public.live_exam_section_attempts l set marks = least(total, ls.max_marks)
        from public.live_exam_sections ls where ls.id = l.section_id and l.attempt_id = a.id;
      end if;
      insert into remarked values (a.id, a.name, nullif(a.result->>'marks', '')::numeric, total);
    end if;
  end loop;
end $$;

select student, old_marks, new_marks from remarked order by student;

commit;

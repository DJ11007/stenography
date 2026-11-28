-- Hindi Word EFFICIENCY TEST 11, Q10: "put the Registered sign ® right after "Classes" in "Samradhi Classes, Jaipur"".
-- The comma after "Classes" confused students about where the ® goes (several wrote "Classes,®"). Owner's decision,
-- 28 Nov 2026: our mistake, so
--   1. the comma is removed from the paper ("Samradhi Classes Jaipur"), in the practice document, the Model Answer
--      and the question text. Students who start the test from now on get the paper without the comma; attempts
--      already started keep the copy they opened.
--   2. "Classes,®" / "Classes, ®" are also accepted, for students still working on the old copy.
--   3. every student of RSMSSB LDC Live Exam 13's Word section (Hindi Test 11) gets Q10's full marks as a bonus,
--      whatever they wrote; the attempt's total and the live exam's section marks follow.
-- Safe to run again: run it once more after Live Exam 13 closes (29 Nov 2026, 13:13 IST) to give the bonus to the
-- students who submit after the first run. Before anything is saved, the Model Answer must still earn 25 and the
-- untouched paper 0.
begin;

do $$
declare
  v_version constant uuid := 'aa45d050-74ec-427f-b5a0-716d0bf179e1'; -- Hindi Test 11 (current version)
  v_question constant uuid := '11a10f75-7112-49cd-b8e9-137a19fe82d9'; -- Q10
  model_gets numeric; untouched_gets numeric;
begin
  update public.word_efficiency_versions
     set working_matter_snapshot = replace(working_matter_snapshot::text, 'Samradhi Classes, Jaipur', 'Samradhi Classes Jaipur')::jsonb,
         model_answer_snapshot = replace(model_answer_snapshot::text, 'Samradhi Classes®, Jaipur', 'Samradhi Classes® Jaipur')::jsonb
   where id = v_version;
  update public.word_efficiency_questions
     set instruction = replace(instruction, 'Samradhi Classes, Jaipur', 'Samradhi Classes Jaipur')
   where id = v_question;
  update public.word_efficiency_grading_rules
     set additional_criteria = '[{"rule":"anyOf","criteria":[
           {"rule":"text","kind":"body","place":9,"find":"Classes®"},
           {"rule":"text","kind":"body","place":9,"find":"Classes ®"},
           {"rule":"text","kind":"body","place":9,"find":"Classes,®"},
           {"rule":"text","kind":"body","place":9,"find":"Classes, ®"}]}]'::jsonb
   where question_id = v_question and version_id = v_version;

  select sum((public.word_efficiency_score_question(v.model_answer_snapshot, v.id, q.id, q.marks, v.model_answer_snapshot)).awarded),
         sum((public.word_efficiency_score_question(public.word_efficiency_initial_editor_document(v.working_matter_snapshot), v.id, q.id, q.marks, v.model_answer_snapshot)).awarded)
    into model_gets, untouched_gets
    from public.word_efficiency_versions v join public.word_efficiency_questions q on q.version_id = v.id
   where v.id = v_version;
  if model_gets <> 25 or untouched_gets <> 0 then
    raise exception 'Hindi Word Test 11 check failed: Model Answer gets %, untouched paper gets % (want 25 and 0)', model_gets, untouched_gets;
  end if;
end $$;

create temporary table bonus (student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare
  v_section constant uuid := 'e33b93ad-58e4-4c7c-9e3b-fde4375ec552'; -- RSMSSB LDC Live Exam 13, Word (Hindi Test 11)
  v_question constant uuid := '11a10f75-7112-49cd-b8e9-137a19fe82d9';
  a record; total numeric; maximum numeric; passing numeric; changed integer;
begin
  for a in select w.id, w.result, coalesce(p.full_name, w.student_id::text) name, sa.id section_attempt
           from public.live_exam_section_attempts sa
           join public.word_efficiency_attempts w on w.id = sa.attempt_id
           left join public.profiles p on p.id = w.student_id
           where sa.section_id = v_section and w.status = 'completed' loop
    update public.word_efficiency_question_scores set awarded_marks = maximum_marks, grading_status = 'graded', updated_at = now()
     where attempt_id = a.id and question_id = v_question and awarded_marks < maximum_marks;
    get diagnostics changed = row_count;
    continue when changed = 0;
    select coalesce(sum(awarded_marks), 0) into total from public.word_efficiency_question_scores where attempt_id = a.id;
    maximum := coalesce(nullif(a.result->>'maximum_marks', '')::numeric, 25);
    passing := coalesce(nullif(a.result->>'passing_marks', '')::numeric, 9);
    update public.word_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object(
        'marks', total, 'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end, 'passed', total >= passing),
      updated_at = now()
     where id = a.id;
    update public.live_exam_section_attempts set marks = total where id = a.section_attempt;
    insert into bonus values (a.name, nullif(a.result->>'marks', '')::numeric, total);
  end loop;
end $$;

select student, old_marks, new_marks from bonus order by student;

commit;

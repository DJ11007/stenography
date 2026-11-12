-- Hindi WORD EFFICIENCY TEST 2 (version 33a36886-41a9-4993-b167-dc10f2735630): question 1 asks for underline +
-- strikethrough on only the word "document" (4 occurrences) in paragraph 1. Its grading rule only checked that
-- those 4 occurrences HAD the formatting -- it never checked that the REST of the paragraph did NOT. A student who
-- selected the whole paragraph and applied underline+strikethrough to everything (instead of selecting just
-- "document") trivially satisfied "the word document has strike+underline" and got full marks for an answer that
-- does not follow the instruction. Found via a specific student's attempt (Lokesh Dhanawat), confirmed to affect
-- ~20 of 44 already-graded attempts on this version (dry-run verified before this migration: every genuinely
-- correct selective answer is unaffected, every over-broad one correctly drops to 0 for this question).
--
-- Fix: add a second criterion requiring every OTHER word in paragraph 1 (i.e. not "document") to NOT have both
-- strike and underline -- the word-efficiency grading engine's own "words" rule with an "except" list already
-- supports exactly this ("mask out the excepted word, require the given props on everything else").
--
-- Then re-marks every already-graded ("completed") attempt on this version: recomputes all 15 questions (only
-- question 1's rule changed, but every question is recomputed for consistency, same as the Excel test2 v4/v5
-- rule-fix migrations), updates excel-equivalent word_efficiency_question_scores, and recalculates each attempt's
-- published result (marks/percentage/passed) from the corrected scores. No attempt had a manual teacher override
-- (graded_by is null for all 44*15 score rows on this version) before this migration, so nothing here overwrites a
-- teacher's own judgment. "submitted" (not yet evaluated/published) attempts are left untouched -- they will be
-- graded against this corrected rule automatically whenever they are evaluated.
begin;

update public.word_efficiency_grading_rules
set additional_criteria = additional_criteria || '[{"kind":"body","rule":"words","place":0,"except":["document"],"props":{"strike":[false],"underline":[false]}}]'::jsonb
where question_id = 'd768ad75-585e-428a-a556-b2f3ac95d4ed'
  and version_id = '33a36886-41a9-4993-b167-dc10f2735630';

create temporary table remarked (student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare
  v_version constant uuid := '33a36886-41a9-4993-b167-dc10f2735630';
  v_maximum constant numeric := 25.00;
  v_passing constant numeric := 9.00;
  a record; q record; total numeric;
begin
  for a in select w.id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name
           from public.word_efficiency_attempts w left join public.profiles p on p.id = w.student_id
           where w.version_id = v_version and w.status = 'completed' and w.final_document_snapshot is not null loop
    for q in select s.id, s.question_id, s.maximum_marks from public.word_efficiency_question_scores s
             where s.attempt_id = a.id and s.graded_by is null loop
      update public.word_efficiency_question_scores
         set awarded_marks = coalesce((public.word_efficiency_score_question(
               a.doc, v_version, q.question_id, q.maximum_marks,
               (select model_answer_snapshot from public.word_efficiency_versions where id = v_version)
             )).awarded, 0),
             grading_status = 'graded', updated_at = now()
       where id = q.id;
    end loop;
    select coalesce(sum(awarded_marks), 0) into total from public.word_efficiency_question_scores where attempt_id = a.id;
    if a.result is not null then
      update public.word_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object(
          'marks', total, 'maximum_marks', v_maximum,
          'percentage', case when v_maximum > 0 then round(total * 100 / v_maximum, 2) else 0 end,
          'passed', total >= v_passing), updated_at = now()
        where id = a.id;
    end if;
    insert into remarked values (a.name, nullif(a.result->>'marks', '')::numeric, total);
  end loop;
end $$;

select student, old_marks, new_marks from remarked where old_marks is distinct from new_marks order by student;

commit;

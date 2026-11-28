-- English Excel EFFICIENCY TEST 25, given in RSMSSB LDC Live Exam 13 (28 Nov 2026). Owner's report: marks not right.
--
-- Q6 (Currency format with the ₹ symbol): on computers whose fonts lack the ₹ sign the button and the menu showed an
--   empty box, so students could not find the Rupee option. Owner's decision: Q6's full marks as a bonus to every
--   student of Live Exam 13's Excel section. (The editor now draws the ₹ on the button and writes "Rupee" in the
--   menus; that part needs a deploy.)
-- Q11 (Hyperlink to www.rbi.org.in): the question ended with a full stop ("...to www.rbi.org.in."), and 6 students
--   typed the address with that full stop ("www.rbi.org.in."). The address with a final full stop is now accepted,
--   and the question no longer ends right after the address. Q11 is marked again for Live Exam 13 (never lowered).
-- Checked the other questions on the students' answers: their zeros are real mistakes (Q10: chart title left as
--   "Accounts" instead of "Branch Accounts", 4 students typed it right; Q11: no link, or "www.rbi.rog.in.").
--
-- Safe to run again: run it once more after Live Exam 13 closes (29 Nov 2026, 13:13 IST) so the students who
-- submit later get the same. Before anything is saved, the Model Answer must still earn every mark of Q11.
begin;

do $$
declare
  v_version constant uuid := 'b507090f-2ae2-47da-95a4-2e55e9d34114'; -- English Excel Test 25
  v_q11 constant uuid := '514f5ed6-93d2-4afa-9239-23bb11fffeb3';
begin
  update public.excel_efficiency_grading_rules
     set additional_criteria = '[{"rule":"cells","range":"J4","props":{"link":[
           "www.rbi.org.in","www.rbi.org.in/","www.rbi.org.in.",
           "http://www.rbi.org.in","http://www.rbi.org.in/","http://www.rbi.org.in.",
           "https://www.rbi.org.in","https://www.rbi.org.in/","https://www.rbi.org.in.",
           "rbi.org.in","rbi.org.in/","rbi.org.in.",
           "http://rbi.org.in","http://rbi.org.in/","http://rbi.org.in.",
           "https://rbi.org.in","https://rbi.org.in/","https://rbi.org.in."]}}]'::jsonb
   where question_id = v_q11 and version_id = v_version;
  update public.excel_efficiency_questions
     set instruction = 'In cell J4 (Bank Website) INSERT a Hyperlink to the address www.rbi.org.in'
   where id = v_q11 and instruction = 'In cell J4 (Bank Website) INSERT a Hyperlink to www.rbi.org.in.';
  if (select public.excel_efficiency_score_question(v.model_answer_snapshot, v.id, v_q11, 2) from public.excel_efficiency_versions v where v.id = v_version) <> 2 then
    raise exception 'Excel Test 25 Q11 check failed: the Model Answer does not earn Q11';
  end if;
end $$;

create temporary table remarked (student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare
  v_section constant uuid := '38ba422b-cf88-45d2-8657-d586eb1ab512'; -- RSMSSB LDC Live Exam 13, Excel (English Test 25)
  v_q6 constant uuid := 'ccfc912b-9da7-461b-81b5-866dd54074e2';
  v_q11 constant uuid := '514f5ed6-93d2-4afa-9239-23bb11fffeb3';
  a record; s record; awarded numeric; total numeric; maximum numeric; passing numeric; changed boolean;
begin
  for a in select x.id, x.version_id, x.final_document_snapshot doc, x.result, coalesce(p.full_name, x.student_id::text) name, sa.id section_attempt
           from public.live_exam_section_attempts sa
           join public.excel_efficiency_attempts x on x.id = sa.attempt_id
           left join public.profiles p on p.id = x.student_id
           where sa.section_id = v_section and x.status = 'completed' loop
    changed := false;
    for s in select id, question_id, awarded_marks, maximum_marks from public.excel_efficiency_question_scores
             where attempt_id = a.id and question_id in (v_q6, v_q11) and graded_by is null loop
      awarded := case when s.question_id = v_q6 then s.maximum_marks
                      else greatest(s.awarded_marks, coalesce(public.excel_efficiency_score_question(a.doc, a.version_id, s.question_id, s.maximum_marks), 0)) end;
      continue when awarded <= s.awarded_marks;
      update public.excel_efficiency_question_scores set awarded_marks = awarded, grading_status = 'graded', updated_at = now() where id = s.id;
      changed := true;
    end loop;
    continue when not changed;
    select coalesce(sum(awarded_marks), 0) into total from public.excel_efficiency_question_scores where attempt_id = a.id;
    maximum := coalesce(nullif(a.result->>'maximum_marks', '')::numeric, 25);
    passing := coalesce(nullif(a.result->>'passing_marks', '')::numeric, 9);
    update public.excel_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object(
        'marks', total, 'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end, 'passed', total >= passing),
      updated_at = now()
     where id = a.id;
    update public.live_exam_section_attempts set marks = total where id = a.section_attempt;
    insert into remarked values (a.name, nullif(a.result->>'marks', '')::numeric, total);
  end loop;
end $$;

select student, old_marks, new_marks from remarked order by student;

commit;

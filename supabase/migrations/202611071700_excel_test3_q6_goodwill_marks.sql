-- EXCEL TEST 3, Q6 (font colour on A55:A59): 10 attempts lost the mark because the Format Cells dialog
-- (used later for Q9) copied the first cell's "Automatic" font colour onto every selected cell and wiped
-- the Q6 colour (fixed in the app in dfcbd52). The saved sheets no longer show the colour, so Q6 is given
-- by the admin's decision (7 Nov 2026) to every attempt that used Font Color and then Format Cells and got 0.
-- Recorded as teacher-given (graded_by = admin), so an automatic re-grade never takes it back.
-- Safe to run twice: only rows still at 0 are changed.
begin;

create temporary table q6_given (student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare a record; total numeric; maximum numeric; passing numeric;
begin
  select passing_marks into passing from public.excel_efficiency_versions where id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc';
  for a in select w.id, w.result, coalesce(p.full_name, w.student_id::text) name, s.id score_id
             from public.excel_efficiency_attempts w
             left join public.profiles p on p.id = w.student_id
             join public.excel_efficiency_question_scores s on s.attempt_id = w.id
             join public.excel_efficiency_questions x on x.id = s.question_id and x.question_number = 6
            where w.version_id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc'
              and w.id in ('a20ddc4a-02ea-4bc9-a65a-a0901bf6cb85', '595c9122-f9df-4b08-82d8-8dd1c13a50ed',
                           '9661bfeb-599e-4646-8788-7594dcb86f80', '4a9c5d21-3e45-4517-bb7a-560c1a41bb75',
                           'f55b03db-baeb-4165-b213-eacbe532aeff', 'a5ed209a-fd43-4b97-ad38-c0c143c82268',
                           '5e7892a4-9810-4856-89bd-608da91479b7', 'a16536cf-6593-489c-b970-97a7ef6d2eac',
                           '2df4cad2-aecc-407c-ab07-f5e6d2936e58', '769fd08e-4b24-4094-8ad2-1a7715d456db')
              and coalesce(s.awarded_marks, 0) = 0 loop
    update public.excel_efficiency_question_scores
       set awarded_marks = maximum_marks, grading_status = 'graded',
           teacher_comment = 'Full marks: your font colour was removed by a fault in the Format Cells box (now fixed), so this question is given.',
           graded_by = '1cbaa98b-7310-4d0b-b659-f2fabcbcf86d', graded_at = now(), updated_at = now()
     where id = a.score_id;
    select coalesce(sum(awarded_marks), 0), sum(maximum_marks) into total, maximum
      from public.excel_efficiency_question_scores where attempt_id = a.id;
    if a.result ? 'marks' then
      update public.excel_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('marks', total, 'maximum_marks', maximum,
          'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end,
          'passed', case when passing is null then null else total >= passing end), updated_at = now()
        where id = a.id;
      update public.live_exam_section_attempts l set marks = least(total, ls.max_marks)
        from public.live_exam_sections ls where ls.id = l.section_id and l.attempt_id = a.id;
    end if;
    insert into q6_given values (a.name, nullif(a.result->>'marks', '')::numeric, total);
  end loop;
end $$;

select student, old_marks, new_marks from q6_given order by student;

commit;

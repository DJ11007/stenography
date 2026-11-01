-- RSMSSB LDC Exam-2 (2026-11-01): recover the Word and Excel parts. Run AFTER the exam has ended (after 3:39 pm IST).
-- At each part's end the exam page removed the student's Word / Excel screen before it handed the answer in (fixed in
-- commit 1f06a44), so the attempts were left open ("active") and never linked to the exam. Each student's work was
-- autosaved; the normal submit, once the time is up, takes exactly that autosave. This hands each open attempt in as
-- its own student (the same submit a student's screen calls, so the usual marking runs) and links it to its exam part
-- with its marks. Attempts already handed in but not linked are linked too. Typing parts cannot be recovered: those
-- answers never reached the server. Safe to run twice: it only touches open or unlinked attempts of this exam.
begin;

create temporary table recovered (part text, student text, marks numeric, note text) on commit drop;

do $$
declare
  v_exam constant uuid := 'ad4d5ded-139d-408e-8879-194888533912';
  s record; a record; got numeric;
begin
  for s in select ls.id, ls.seq, ls.kind, ls.test_id, ls.max_marks, tl.starts_at, tl.ends_at from public.live_exam_sections ls
           join public.live_exam_timeline(v_exam) tl on tl.section_id = ls.id
           where ls.exam_id = v_exam and ls.kind in ('word', 'excel') order by seq loop
    for a in select x.id, x.student_id, x.status, coalesce(p.full_name, x.student_id::text) as name
             from (select id, student_id, status, prepared_at, test_id from public.word_efficiency_attempts where s.kind = 'word'
                   union all
                   select id, student_id, status, prepared_at, test_id from public.excel_efficiency_attempts where s.kind = 'excel') x
             left join public.profiles p on p.id = x.student_id
             where x.test_id = s.test_id and x.prepared_at >= s.starts_at - interval '1 minute' and x.prepared_at < s.ends_at
               and not exists (select 1 from public.live_exam_section_attempts l where l.section_id = s.id and l.student_id = x.student_id) loop
      begin
        if a.status = 'active' then
          -- Hand in as the student: past the time limit the submit uses the student's own last autosave.
          perform set_config('request.jwt.claims', json_build_object('sub', a.student_id, 'role', 'authenticated')::text, true);
          execute 'set local role authenticated';
          if s.kind = 'word' then perform public.submit_word_efficiency_document(a.id, '{}'::jsonb);
          else perform public.submit_excel_efficiency_document(a.id, '{}'::jsonb); end if;
          execute 'reset role';
        end if;
        if s.kind = 'word' then select nullif(result->>'marks', '')::numeric into got from public.word_efficiency_attempts where id = a.id;
        else select nullif(result->>'marks', '')::numeric into got from public.excel_efficiency_attempts where id = a.id; end if;
        insert into public.live_exam_section_attempts (exam_id, section_id, student_id, attempt_id, marks)
          values (v_exam, s.id, a.student_id, a.id, least(got, s.max_marks));
        insert into recovered values (initcap(s.kind), a.name, least(got, s.max_marks), case when a.status = 'active' then 'handed in from autosave' else 'linked' end);
      exception when others then
        execute 'reset role';
        insert into recovered values (initcap(s.kind), a.name, null, 'NOT recovered: ' || sqlerrm);
      end;
    end loop;
  end loop;
end $$;

select * from recovered order by part desc, student;

commit;

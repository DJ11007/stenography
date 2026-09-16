begin;

-- Scheduled free live Word Efficiency tests -- mirrors the Typing/
-- Stenography live-test system (202608190001_scheduled_live_tests.sql)
-- exactly: a start/end join window, a results-publish gate, one attempt
-- per student, and an anonymized results ticker. Word Efficiency's own
-- grading is manual per-attempt (evaluation_status draft->published), so
-- a live attempt's result additionally needs an admin to have actually
-- published grading -- results_publish_at only ever brings that reveal
-- FORWARD in time relative to when grading is published, it can't publish
-- an ungraded attempt's result early.
alter table public.word_efficiency_tests add column if not exists is_live boolean not null default false;
alter table public.word_efficiency_tests add column if not exists live_starts_at timestamptz;
alter table public.word_efficiency_tests add column if not exists live_ends_at timestamptz;
alter table public.word_efficiency_tests add column if not exists results_publish_at timestamptz;

alter table public.word_efficiency_tests drop constraint if exists word_efficiency_tests_live_schedule_valid;
alter table public.word_efficiency_tests add constraint word_efficiency_tests_live_schedule_valid check(
  (not is_live and live_starts_at is null and live_ends_at is null and results_publish_at is null)
  or
  (is_live and live_starts_at is not null and live_ends_at > live_starts_at and results_publish_at >= live_ends_at)
);
create index if not exists word_efficiency_tests_live_catalog on public.word_efficiency_tests(is_live,live_starts_at,live_ends_at,results_publish_at) where is_live;

alter table public.word_efficiency_attempts add column if not exists is_live_attempt boolean not null default false;
create unique index if not exists one_live_word_efficiency_attempt_per_student on public.word_efficiency_attempts(test_id,student_id) where is_live_attempt;

-- Admin-only schedule setter, kept separate from save_word_efficiency_test
-- (already one of the largest/most validated functions in this module) --
-- the admin form calls this as a second step right after saving/publishing
-- the test's content, exactly like it already calls
-- save_word_efficiency_grading_rules as its own separate step.
create or replace function public.set_word_efficiency_live_schedule(p_test_id uuid,p_is_live boolean,p_starts_at timestamptz,p_ends_at timestamptz,p_results_publish_at timestamptz)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if p_is_live and(p_starts_at is null or p_ends_at is null or p_results_publish_at is null or p_ends_at<=p_starts_at or p_results_publish_at<p_ends_at) then raise exception 'invalid live schedule'; end if;
 update public.word_efficiency_tests set is_live=coalesce(p_is_live,false),
  live_starts_at=case when p_is_live then p_starts_at else null end,
  live_ends_at=case when p_is_live then p_ends_at else null end,
  results_publish_at=case when p_is_live then p_results_publish_at else null end
 where id=p_test_id;
 if not found then raise exception 'test unavailable'; end if;
end $$;

-- Full redefinition (mirrors 202608290042's body exactly): adds the live
-- join-window check, a friendly one-attempt-per-live-test message (the
-- unique index above is the hard backstop against a race), and records
-- is_live_attempt on the created attempt.
create or replace function public.prepare_word_efficiency_attempt(p_test_id uuid,p_duration_seconds integer,p_delivery text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare test_record public.word_efficiency_tests%rowtype;version_record public.word_efficiency_versions%rowtype;new_attempt_id uuid;question_snapshot jsonb;question_total numeric;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;
 perform public.assert_student_access_allowed();
 select test_rows.* into test_record from public.word_efficiency_tests as test_rows where test_rows.id=p_test_id and test_rows.status='published';
 if not found then raise exception 'test unavailable';end if;
 if test_record.is_live then
  if now()<test_record.live_starts_at or now()>test_record.live_ends_at then raise exception 'This live test is not currently open.';end if;
  if exists(select 1 from public.word_efficiency_attempts where test_id=test_record.id and student_id=auth.uid() and is_live_attempt)then raise exception 'You have already attempted this live test.';end if;
 end if;
 select version_rows.* into version_record from public.word_efficiency_versions as version_rows where version_rows.id=test_record.current_version_id;
 if not found then raise exception 'published version unavailable';end if;
 if not p_duration_seconds=any(version_record.duration_options)then raise exception 'duration unavailable';end if;
 if p_delivery not in('onscreen','pdf','realfile')or(p_delivery='onscreen'and not version_record.delivery_onscreen)or(p_delivery='pdf'and not version_record.delivery_pdf)or(p_delivery='realfile'and not version_record.delivery_realfile)then raise exception 'delivery unavailable';end if;
 perform public.assert_word_efficiency_working_matter(version_record.working_matter_snapshot);
 perform public.assert_word_efficiency_editor_capabilities(version_record.editor_capabilities);
 select coalesce(jsonb_agg(jsonb_build_object('id',question_rows.id,'question_version_id',question_rows.id,'number',question_rows.question_number,'display_order',question_rows.display_order,'instruction',case when p_delivery in('onscreen','realfile')and question_rows.is_visible then question_rows.instruction end,'marks',question_rows.marks,'section',question_rows.section,'is_visible',question_rows.is_visible)order by question_rows.display_order),'[]'::jsonb),round(coalesce(sum(question_rows.marks),0),2)
 into question_snapshot,question_total from public.word_efficiency_questions as question_rows where question_rows.version_id=version_record.id;
 if jsonb_array_length(question_snapshot)<>version_record.question_count or question_total<>version_record.maximum_marks then raise exception 'published question allocation is inconsistent';end if;
 insert into public.word_efficiency_attempts(test_id,version_id,student_id,delivery_method,selected_duration_seconds,snapshot,is_live_attempt)
 values(test_record.id,version_record.id,auth.uid(),p_delivery,p_duration_seconds,jsonb_build_object('test_id',test_record.id,'test_version_id',version_record.id,'instructions_version_id',version_record.id,'question_version_id',version_record.id,'title',version_record.title,'language',version_record.language,'instructions_markdown',version_record.instructions_markdown,'delivery_method',p_delivery,'duration_seconds',p_duration_seconds,'question_count',version_record.question_count,'maximum_marks',question_total,'questions',question_snapshot,'editor_capabilities',version_record.editor_capabilities,'pdf_path',case when p_delivery='pdf'then version_record.pdf_path end,'pdf_file_name',case when p_delivery='pdf'then version_record.pdf_file_name end,'pdf_size_bytes',case when p_delivery='pdf'then version_record.pdf_size_bytes end,'pdf_page_count',case when p_delivery='pdf'then version_record.pdf_page_count end,'pdf_uploaded_at',case when p_delivery='pdf'then version_record.pdf_uploaded_at end),test_record.is_live)returning word_efficiency_attempts.id into new_attempt_id;
 insert into public.word_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks)select new_attempt_id,question_rows.id,question_rows.question_number,question_rows.marks from public.word_efficiency_questions as question_rows where question_rows.version_id=version_record.id;
 return new_attempt_id;
end $$;

-- Full redefinition (mirrors 202608250018's body exactly): a live
-- attempt's result additionally waits for results_publish_at, on top of
-- the existing evaluation_status='published' gate.
create or replace function public.get_word_efficiency_attempt_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;version_record public.word_efficiency_versions%rowtype;test_record public.word_efficiency_tests%rowtype;result_rows jsonb;is_published boolean;
begin
 if not public.is_active_word_efficiency_student()then raise exception'active student account required';end if;
 select attempt_rows.* into attempt_record from public.word_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid();if not found or attempt_record.status not in('submitted','completed')then raise exception'attempt result unavailable';end if;
 select version_rows.* into version_record from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;if not found then raise exception'test version unavailable';end if;
 select test_rows.* into test_record from public.word_efficiency_tests as test_rows where test_rows.id=attempt_record.test_id;
 is_published:=attempt_record.result is not null and(attempt_record.evaluation_status='published'or attempt_record.status='completed')and(not attempt_record.is_live_attempt or test_record.results_publish_at is null or now()>=test_record.results_publish_at);
 if is_published then select coalesce(jsonb_agg(jsonb_build_object('number',score_rows.question_number,'instruction',question_rows.instruction,'section',question_rows.section,'maximumMarks',score_rows.maximum_marks,'awardedMarks',score_rows.awarded_marks,'feedback',score_rows.teacher_comment,'gradingStatus',case when score_rows.awarded_marks is null then'not_graded'else'graded'end)order by question_rows.display_order),'[]'::jsonb)into result_rows from public.word_efficiency_question_scores as score_rows join public.word_efficiency_questions as question_rows on question_rows.id=score_rows.question_id where score_rows.attempt_id=p_attempt_id;else result_rows:='[]'::jsonb;end if;
 return jsonb_build_object('title',attempt_record.snapshot->>'title','language',attempt_record.snapshot->>'language','status',case when is_published then'published'else'pending'end,'submittedAt',attempt_record.submitted_at,'evaluatedAt',case when is_published then attempt_record.result_published_at end,'maximumMarks',version_record.maximum_marks,'marksObtained',case when is_published then attempt_record.result->'marks'else null end,'percentage',case when is_published then attempt_record.result->'percentage'else null end,'passingMarks',case when is_published then to_jsonb(version_record.passing_marks)else null end,'passed',case when is_published then attempt_record.result->'passed'else null end,'overallFeedback',case when is_published then attempt_record.overall_teacher_feedback end,'questions',result_rows);
end $$;

-- Anonymized public ticker, mirrors published_live_results exactly in
-- shape/intent -- marks/maximum_marks/passed instead of net_wpm/accuracy,
-- since Word Efficiency has no WPM concept at all.
create or replace function public.published_word_efficiency_live_results(p_limit integer default 30)
returns table(student_name text,test_title text,marks numeric,maximum_marks numeric,passed boolean,submitted_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public as $$
  select
    left(coalesce(nullif(p.full_name,''),'Student'),1) || '•••' as student_name,
    t.title as test_title,
    round(coalesce((a.result->>'marks')::numeric,0),2) as marks,
    round(coalesce((a.result->>'maximum_marks')::numeric,0),2) as maximum_marks,
    coalesce((a.result->>'passed')::boolean,false) as passed,
    a.submitted_at
  from public.word_efficiency_attempts a
  join public.word_efficiency_tests t on t.id=a.test_id
  left join public.profiles p on p.id=a.student_id
  where a.is_live_attempt and t.is_live and t.results_publish_at <= now() and a.evaluation_status='published'
  order by a.submitted_at desc
  limit least(greatest(coalesce(p_limit,30),1),100);
$$;

revoke all on function public.set_word_efficiency_live_schedule(uuid,boolean,timestamptz,timestamptz,timestamptz) from public,anon;
grant execute on function public.set_word_efficiency_live_schedule(uuid,boolean,timestamptz,timestamptz,timestamptz) to authenticated;
grant execute on function public.published_word_efficiency_live_results(integer) to anon,authenticated;

commit;

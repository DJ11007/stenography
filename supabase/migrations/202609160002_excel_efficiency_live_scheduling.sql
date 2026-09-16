begin;

-- Scheduled free live Excel Efficiency tests -- exact mirror of
-- 202609160001_word_efficiency_live_scheduling.sql for the parallel Excel
-- Efficiency module (own tables/RPCs, same shape).
alter table public.excel_efficiency_tests add column if not exists is_live boolean not null default false;
alter table public.excel_efficiency_tests add column if not exists live_starts_at timestamptz;
alter table public.excel_efficiency_tests add column if not exists live_ends_at timestamptz;
alter table public.excel_efficiency_tests add column if not exists results_publish_at timestamptz;

alter table public.excel_efficiency_tests drop constraint if exists excel_efficiency_tests_live_schedule_valid;
alter table public.excel_efficiency_tests add constraint excel_efficiency_tests_live_schedule_valid check(
  (not is_live and live_starts_at is null and live_ends_at is null and results_publish_at is null)
  or
  (is_live and live_starts_at is not null and live_ends_at > live_starts_at and results_publish_at >= live_ends_at)
);
create index if not exists excel_efficiency_tests_live_catalog on public.excel_efficiency_tests(is_live,live_starts_at,live_ends_at,results_publish_at) where is_live;

alter table public.excel_efficiency_attempts add column if not exists is_live_attempt boolean not null default false;
create unique index if not exists one_live_excel_efficiency_attempt_per_student on public.excel_efficiency_attempts(test_id,student_id) where is_live_attempt;

create or replace function public.set_excel_efficiency_live_schedule(p_test_id uuid,p_is_live boolean,p_starts_at timestamptz,p_ends_at timestamptz,p_results_publish_at timestamptz)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if p_is_live and(p_starts_at is null or p_ends_at is null or p_results_publish_at is null or p_ends_at<=p_starts_at or p_results_publish_at<p_ends_at) then raise exception 'invalid live schedule'; end if;
 update public.excel_efficiency_tests set is_live=coalesce(p_is_live,false),
  live_starts_at=case when p_is_live then p_starts_at else null end,
  live_ends_at=case when p_is_live then p_ends_at else null end,
  results_publish_at=case when p_is_live then p_results_publish_at else null end
 where id=p_test_id;
 if not found then raise exception 'test unavailable'; end if;
end $$;

-- Full redefinition (mirrors 202608270036's body exactly): adds the live
-- join-window check, a friendly one-attempt-per-live-test message (the
-- unique index above is the hard backstop against a race), and records
-- is_live_attempt on the created attempt.
create or replace function public.prepare_excel_efficiency_attempt(p_test_id uuid,p_duration_seconds integer,p_show_questions boolean)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.excel_efficiency_tests%rowtype;v public.excel_efficiency_versions%rowtype;aid uuid;questions jsonb;original jsonb;question_total numeric;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 perform public.assert_student_access_allowed();
 select * into t from public.excel_efficiency_tests where id=p_test_id and status='published'; if not found then raise exception 'test unavailable'; end if;
 if t.is_live then
  if now()<t.live_starts_at or now()>t.live_ends_at then raise exception 'This live test is not currently open.'; end if;
  if exists(select 1 from public.excel_efficiency_attempts where test_id=t.id and student_id=auth.uid() and is_live_attempt) then raise exception 'You have already attempted this live test.'; end if;
 end if;
 select * into v from public.excel_efficiency_versions where id=t.current_version_id;
 if not p_duration_seconds=any(v.duration_options) then raise exception 'duration unavailable'; end if;
 perform public.assert_excel_efficiency_working_matter(v.working_matter_snapshot);
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'number',q.question_number,'display_order',q.display_order,'instruction',case when q.is_visible then q.instruction end,'marks',q.marks,'section',q.section,'is_visible',q.is_visible) order by q.display_order),'[]'::jsonb),round(coalesce(sum(q.marks),0),2) into questions,question_total from public.excel_efficiency_questions q where q.version_id=v.id;
 original:=public.excel_efficiency_initial_editor_document(v.working_matter_snapshot);
 insert into public.excel_efficiency_attempts(test_id,version_id,student_id,selected_duration_seconds,snapshot,status,original_document_snapshot,started_at,is_live_attempt)
 values(t.id,v.id,auth.uid(),p_duration_seconds,jsonb_build_object('test_id',t.id,'test_version_id',v.id,'title',v.title,'language',v.language,'instructions_markdown',v.instructions_markdown,'duration_seconds',p_duration_seconds,'question_count',v.question_count,'maximum_marks',question_total,'questions',questions,'show_questions',coalesce(p_show_questions,false)),'active',original,now(),t.is_live)
 returning id into aid;
 insert into public.excel_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks,grading_status)
 select aid,q.id,q.question_number,q.marks,'ungraded' from public.excel_efficiency_questions q where q.version_id=v.id;
 return aid;
end $$;

-- Full redefinition (mirrors 202608260024's body exactly): a live
-- attempt's result additionally waits for results_publish_at, on top of
-- the existing evaluation_status='published' gate.
create or replace function public.get_excel_efficiency_attempt_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public as $$
declare attempt_record public.excel_efficiency_attempts%rowtype;version_record public.excel_efficiency_versions%rowtype;test_record public.excel_efficiency_tests%rowtype;result_rows jsonb;is_published boolean;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 select attempt_rows.* into attempt_record from public.excel_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid(); if not found or attempt_record.status not in('submitted','completed') then raise exception 'attempt result unavailable'; end if;
 select version_rows.* into version_record from public.excel_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id; if not found then raise exception 'test version unavailable'; end if;
 select test_rows.* into test_record from public.excel_efficiency_tests as test_rows where test_rows.id=attempt_record.test_id;
 is_published:=attempt_record.result is not null and(attempt_record.evaluation_status='published' or attempt_record.status='completed')and(not attempt_record.is_live_attempt or test_record.results_publish_at is null or now()>=test_record.results_publish_at);
 if is_published then select coalesce(jsonb_agg(jsonb_build_object('number',score_rows.question_number,'instruction',question_rows.instruction,'section',question_rows.section,'maximumMarks',score_rows.maximum_marks,'awardedMarks',score_rows.awarded_marks,'feedback',score_rows.teacher_comment,'gradingStatus',case when score_rows.awarded_marks is null then'not_graded' else'graded' end) order by question_rows.display_order),'[]'::jsonb) into result_rows from public.excel_efficiency_question_scores as score_rows join public.excel_efficiency_questions as question_rows on question_rows.id=score_rows.question_id where score_rows.attempt_id=p_attempt_id; else result_rows:='[]'::jsonb; end if;
 return jsonb_build_object('title',attempt_record.snapshot->>'title','language',attempt_record.snapshot->>'language','status',case when is_published then'published' else'pending' end,'submittedAt',attempt_record.submitted_at,'evaluatedAt',case when is_published then attempt_record.result_published_at end,'maximumMarks',version_record.maximum_marks,'marksObtained',case when is_published then attempt_record.result->'marks' else null end,'percentage',case when is_published then attempt_record.result->'percentage' else null end,'passingMarks',case when is_published then to_jsonb(version_record.passing_marks) else null end,'passed',case when is_published then attempt_record.result->'passed' else null end,'overallFeedback',case when is_published then attempt_record.overall_teacher_feedback end,'questions',result_rows);
end $$;

create or replace function public.published_excel_efficiency_live_results(p_limit integer default 30)
returns table(student_name text,test_title text,marks numeric,maximum_marks numeric,passed boolean,submitted_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public as $$
  select
    left(coalesce(nullif(p.full_name,''),'Student'),1) || '•••' as student_name,
    t.title as test_title,
    round(coalesce((a.result->>'marks')::numeric,0),2) as marks,
    round(coalesce((a.result->>'maximum_marks')::numeric,0),2) as maximum_marks,
    coalesce((a.result->>'passed')::boolean,false) as passed,
    a.submitted_at
  from public.excel_efficiency_attempts a
  join public.excel_efficiency_tests t on t.id=a.test_id
  left join public.profiles p on p.id=a.student_id
  where a.is_live_attempt and t.is_live and t.results_publish_at <= now() and a.evaluation_status='published'
  order by a.submitted_at desc
  limit least(greatest(coalesce(p_limit,30),1),100);
$$;

revoke all on function public.set_excel_efficiency_live_schedule(uuid,boolean,timestamptz,timestamptz,timestamptz) from public,anon;
grant execute on function public.set_excel_efficiency_live_schedule(uuid,boolean,timestamptz,timestamptz,timestamptz) to authenticated;
grant execute on function public.published_excel_efficiency_live_results(integer) to anon,authenticated;

commit;

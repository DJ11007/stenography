begin;

-- Excel Efficiency was launched (202608260023/24) without ever being wired into
-- the admin-managed test-limit/expiry/lock system built for the rest of the
-- platform in 202608260028/29 -- a locked or over-limit student could still
-- start an Excel Efficiency attempt. This closes that gap the same way Word
-- Efficiency was closed: gate the "start an attempt" RPC, and count Excel
-- attempts in the shared usage/status calculations so limits, "tests used",
-- and the admin Track dashboard stay accurate across every test surface.

create or replace function public.prepare_excel_efficiency_attempt(p_test_id uuid,p_duration_seconds integer,p_show_questions boolean)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.excel_efficiency_tests%rowtype;v public.excel_efficiency_versions%rowtype;aid uuid;questions jsonb;original jsonb;question_total numeric;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 perform public.assert_student_access_allowed();
 select * into t from public.excel_efficiency_tests where id=p_test_id and status='published'; if not found then raise exception 'test unavailable'; end if;
 select * into v from public.excel_efficiency_versions where id=t.current_version_id;
 if not p_duration_seconds=any(v.duration_options) then raise exception 'duration unavailable'; end if;
 perform public.assert_excel_efficiency_working_matter(v.working_matter_snapshot);
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'number',q.question_number,'display_order',q.display_order,'instruction',case when q.is_visible then q.instruction end,'marks',q.marks,'section',q.section,'is_visible',q.is_visible) order by q.display_order),'[]'::jsonb),round(coalesce(sum(q.marks),0),2) into questions,question_total from public.excel_efficiency_questions q where q.version_id=v.id;
 original:=public.excel_efficiency_initial_editor_document(v.working_matter_snapshot);
 insert into public.excel_efficiency_attempts(test_id,version_id,student_id,selected_duration_seconds,snapshot,status,original_document_snapshot,started_at)
 values(t.id,v.id,auth.uid(),p_duration_seconds,jsonb_build_object('test_id',t.id,'test_version_id',v.id,'title',v.title,'language',v.language,'instructions_markdown',v.instructions_markdown,'duration_seconds',p_duration_seconds,'question_count',v.question_count,'maximum_marks',question_total,'questions',questions,'show_questions',coalesce(p_show_questions,false)),'active',original,now())
 returning id into aid;
 insert into public.excel_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks,grading_status)
 select aid,q.id,q.question_number,q.marks,'ungraded' from public.excel_efficiency_questions q where q.version_id=v.id;
 return aid;
end $$;

create or replace function public.student_access_status(p_student_id uuid default auth.uid())
returns table(student_id uuid,status text,tests_today bigint,tests_total bigint,tests_used_in_window bigint,test_limit integer,tests_remaining integer,validity_expires_at timestamptz,grace_days integer,access_locked boolean)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare prof record;used_window bigint;today_count bigint;total_count bigint;
begin
 if p_student_id<>auth.uid() and not public.is_aal2_admin() then raise exception 'not authorized';end if;
 select p.test_limit,p.validity_expires_at,p.grace_days,p.access_locked,p.access_granted_at into prof from public.profiles p where p.id=p_student_id and p.role='student';
 if not found then raise exception 'student not found';end if;
 select count(*) filter(where a.started_at>=prof.access_granted_at),count(*),count(*) filter(where(a.started_at at time zone 'Asia/Kolkata')::date=(now() at time zone 'Asia/Kolkata')::date)
  into used_window,total_count,today_count
  from(select ta.started_at from public.test_attempts ta where ta.student_id=p_student_id union all select wa.started_at from public.word_efficiency_attempts wa where wa.student_id=p_student_id union all select ea.started_at from public.excel_efficiency_attempts ea where ea.student_id=p_student_id)a;
 return query select p_student_id,public.derive_student_access_status(prof.test_limit,used_window,prof.validity_expires_at,prof.grace_days,prof.access_locked),today_count,total_count,used_window,prof.test_limit,case when prof.test_limit is null then null else greatest(0,prof.test_limit-used_window::integer)end,prof.validity_expires_at,prof.grace_days,prof.access_locked;
end $$;

create or replace function public.admin_list_student_access()
returns table(student_id uuid,full_name text,email text,tests_today bigint,tests_total bigint,avg_score numeric,test_limit integer,tests_used_in_window bigint,tests_remaining integer,validity_expires_at timestamptz,grace_days integer,access_locked boolean,access_granted_at timestamptz,status text)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_aal2_admin() then raise exception 'not authorized';end if;
 return query
 with attempts as(
  select ta.student_id,ta.started_at,nullif(ta.result->>'accuracy','')::numeric as score_pct from public.test_attempts ta
  union all
  select wa.student_id,wa.started_at,nullif(wa.result->>'percentage','')::numeric from public.word_efficiency_attempts wa
  union all
  select ea.student_id,ea.started_at,nullif((ea.result->>'percentage'),'')::numeric from public.excel_efficiency_attempts ea
 ),
 agg as(
  select p.id,p.full_name,p.email,p.test_limit,p.validity_expires_at,p.grace_days,p.access_locked,p.access_granted_at,
   count(a.*)filter(where(a.started_at at time zone 'Asia/Kolkata')::date=(now() at time zone 'Asia/Kolkata')::date)as tests_today,
   count(a.*)as tests_total,
   count(a.*)filter(where a.started_at>=p.access_granted_at)as tests_used_in_window,
   avg(a.score_pct)as avg_score
  from public.profiles p left join attempts a on a.student_id=p.id
  where p.role='student'
  group by p.id
 )
 select agg.id,agg.full_name,agg.email,agg.tests_today,agg.tests_total,round(agg.avg_score,2),agg.test_limit,agg.tests_used_in_window,
  case when agg.test_limit is null then null else greatest(0,agg.test_limit-agg.tests_used_in_window::integer)end,
  agg.validity_expires_at,agg.grace_days,agg.access_locked,agg.access_granted_at,
  public.derive_student_access_status(agg.test_limit,agg.tests_used_in_window,agg.validity_expires_at,agg.grace_days,agg.access_locked)
 from agg;
end $$;

commit;

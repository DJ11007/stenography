-- Repair environments whose migration history was reconciled before the live-test DDL ran.
alter table public.tests add column if not exists is_live boolean not null default false;
alter table public.tests add column if not exists live_starts_at timestamptz;
alter table public.tests add column if not exists live_ends_at timestamptz;
alter table public.tests add column if not exists results_publish_at timestamptz;
alter table public.test_attempts add column if not exists is_live_attempt boolean not null default false;

alter table public.tests drop constraint if exists tests_live_schedule_valid;
alter table public.tests add constraint tests_live_schedule_valid check (
  (not is_live and live_starts_at is null and live_ends_at is null and results_publish_at is null)
  or (is_live and visibility = 'public' and live_starts_at is not null and live_ends_at > live_starts_at and results_publish_at >= live_ends_at)
);
create index if not exists tests_live_catalog on public.tests(is_live, live_starts_at, live_ends_at, results_publish_at) where is_live;
create unique index if not exists one_live_attempt_per_student on public.test_attempts(test_id, student_id) where is_live_attempt;

drop policy if exists "Students insert own attempts" on public.test_attempts;
create policy "Students insert own attempts" on public.test_attempts for insert to authenticated with check (
  public.test_attempts.student_id = auth.uid() and exists (
    select 1 from public.tests t where t.id = public.test_attempts.test_id
      and t.current_version_id = public.test_attempts.test_version_id and t.status = 'published' and t.visibility = 'public'
      and ((not public.test_attempts.is_live_attempt and not t.is_live) or (public.test_attempts.is_live_attempt and t.is_live and now() between t.live_starts_at and t.live_ends_at))
  )
);
drop policy if exists "Students read own attempts" on public.test_attempts;
create policy "Students read own attempts" on public.test_attempts for select to authenticated using (
  public.is_aal2_admin() or (public.test_attempts.student_id = auth.uid() and (not public.test_attempts.is_live_attempt or exists (
    select 1 from public.tests t where t.id = public.test_attempts.test_id and now() >= t.results_publish_at
  )))
);

create or replace function public.save_scheduled_managed_test(p_test_id uuid, p_payload jsonb, p_publish boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_test_id uuid; v_is_live boolean; v_start timestamptz; v_end timestamptz; v_results timestamptz;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  v_is_live := coalesce((p_payload->>'is_live')::boolean, false);
  v_start := nullif(p_payload->>'live_starts_at','')::timestamptz;
  v_end := nullif(p_payload->>'live_ends_at','')::timestamptz;
  v_results := nullif(p_payload->>'results_publish_at','')::timestamptz;
  if v_is_live and (v_start is null or v_end <= v_start or v_results < v_end) then raise exception 'invalid live schedule'; end if;
  if v_is_live and p_payload->>'visibility' <> 'public' then raise exception 'live tests must be public'; end if;
  v_test_id := public.save_managed_test(p_test_id, p_payload, p_publish);
  update public.tests set is_live=v_is_live, live_starts_at=case when v_is_live then v_start end,
    live_ends_at=case when v_is_live then v_end end, results_publish_at=case when v_is_live then v_results end where id=v_test_id;
  insert into public.admin_test_audit_log(actor_user_id,test_id,action,metadata)
    values(auth.uid(),v_test_id,'live_schedule_saved',jsonb_build_object('is_live',v_is_live,'starts_at',v_start,'ends_at',v_end,'results_publish_at',v_results));
  return v_test_id;
end; $$;

create or replace function public.published_live_results(p_limit integer default 30)
returns table(student_name text, test_title text, net_wpm numeric, accuracy numeric, submitted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select left(coalesce(nullif(p.full_name,''),'Student'),1) || '•••', t.title,
    round(coalesce((a.result->>'netWpm')::numeric,0),2), round(coalesce((a.result->>'accuracy')::numeric,0),2), a.submitted_at
  from public.test_attempts a join public.tests t on t.id=a.test_id left join public.profiles p on p.id=a.student_id
  where a.is_live_attempt and t.is_live and t.results_publish_at <= now()
  order by a.submitted_at desc limit least(greatest(coalesce(p_limit,30),1),100);
$$;
revoke all on function public.save_scheduled_managed_test(uuid,jsonb,boolean) from public,anon;
grant execute on function public.save_scheduled_managed_test(uuid,jsonb,boolean) to authenticated;
grant execute on function public.published_live_results(integer) to anon,authenticated;

-- "One day" live tests: a live typing/stenography test can have a start/end window (e.g. 24 hours) AND
-- unlock each student's result results_delay_minutes after their own submission. Until now a delay meant
-- "anytime" (no window at all). One attempt per student is unchanged (unique live attempt).
-- Live efficiency tests: results_publish_at is optional in the schedule RPC (their results unlock
-- results_delay_minutes after each submission, migration 202610251200); it defaults to the end time.
begin;

alter table public.tests drop constraint if exists tests_live_schedule_valid;
alter table public.tests add constraint tests_live_schedule_valid check (
  ((not is_live) and live_starts_at is null and live_ends_at is null and results_publish_at is null and results_delay_minutes is null)
  or (is_live and results_delay_minutes is null and visibility='public'::test_visibility and live_starts_at is not null and live_ends_at > live_starts_at and results_publish_at >= live_ends_at)
  or (is_live and results_delay_minutes is not null and results_delay_minutes > 0 and results_delay_minutes <= 1440 and visibility='public'::test_visibility and results_publish_at is null
      and ((live_starts_at is null and live_ends_at is null) or (live_starts_at is not null and live_ends_at > live_starts_at)))
);

-- A student can only insert a live attempt inside the window, when the test has one.
drop policy if exists "Students insert own attempts" on public.test_attempts;
create policy "Students insert own attempts" on public.test_attempts for insert to authenticated with check (
  student_id = auth.uid() and exists (
    select 1 from public.tests t
    where t.id = test_attempts.test_id and t.current_version_id = test_attempts.test_version_id
      and t.status = 'published'::test_status and t.visibility = 'public'::test_visibility
      and (
        ((not test_attempts.is_live_attempt) and (not t.is_live))
        or (test_attempts.is_live_attempt and t.is_live and t.results_delay_minutes is null and now() >= t.live_starts_at and now() <= t.live_ends_at)
        or (test_attempts.is_live_attempt and t.is_live and t.results_delay_minutes is not null
            and (t.live_starts_at is null or now() >= t.live_starts_at) and (t.live_ends_at is null or now() <= t.live_ends_at))
      )
  )
);

create or replace function public.save_scheduled_managed_test(p_test_id uuid, p_payload jsonb, p_publish boolean default false)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_test_id uuid; v_is_live boolean; v_start timestamptz; v_end timestamptz; v_results timestamptz; v_delay integer;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  v_is_live := coalesce((p_payload->>'is_live')::boolean, false);
  v_start := nullif(p_payload->>'live_starts_at','')::timestamptz;
  v_end := nullif(p_payload->>'live_ends_at','')::timestamptz;
  v_results := nullif(p_payload->>'results_publish_at','')::timestamptz;
  v_delay := nullif(p_payload->>'results_delay_minutes','')::integer;
  if v_is_live and v_delay is not null then
    if v_delay <= 0 or v_delay > 1440 then raise exception 'invalid live schedule'; end if;
    -- "One day": a window with per-student results; "Anytime": no window.
    if (v_start is null) <> (v_end is null) or v_end <= v_start then raise exception 'invalid live schedule'; end if;
  elsif v_is_live then
    if (v_start is null or v_end <= v_start or v_results < v_end) then raise exception 'invalid live schedule'; end if;
  end if;
  if v_is_live and p_payload->>'visibility' <> 'public' then raise exception 'live tests must be public'; end if;
  v_test_id := public.save_managed_test(p_test_id, p_payload, p_publish);
  update public.tests set is_live=v_is_live,
    live_starts_at=case when v_is_live then v_start else null end,
    live_ends_at=case when v_is_live then v_end else null end,
    results_publish_at=case when v_is_live and v_delay is null then v_results else null end,
    results_delay_minutes=case when v_is_live then v_delay else null end
  where id=v_test_id;
  insert into public.admin_test_audit_log(actor_user_id,test_id,action,metadata)
    values(auth.uid(),v_test_id,'live_schedule_saved',jsonb_build_object('is_live',v_is_live,'starts_at',v_start,'ends_at',v_end,'results_publish_at',v_results,'results_delay_minutes',v_delay));
  return v_test_id;
end; $function$;

create or replace function public.set_word_efficiency_live_schedule(p_test_id uuid, p_is_live boolean, p_starts_at timestamptz, p_ends_at timestamptz, p_results_publish_at timestamptz)
returns void language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare v_results timestamptz := coalesce(p_results_publish_at, p_ends_at);
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if p_is_live and(p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at or v_results<p_ends_at) then raise exception 'invalid live schedule'; end if;
 update public.word_efficiency_tests set is_live=coalesce(p_is_live,false),
  live_starts_at=case when p_is_live then p_starts_at else null end,
  live_ends_at=case when p_is_live then p_ends_at else null end,
  results_publish_at=case when p_is_live then v_results else null end
 where id=p_test_id;
 if not found then raise exception 'test unavailable'; end if;
end $function$;

create or replace function public.set_excel_efficiency_live_schedule(p_test_id uuid, p_is_live boolean, p_starts_at timestamptz, p_ends_at timestamptz, p_results_publish_at timestamptz)
returns void language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare v_results timestamptz := coalesce(p_results_publish_at, p_ends_at);
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if p_is_live and(p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at or v_results<p_ends_at) then raise exception 'invalid live schedule'; end if;
 update public.excel_efficiency_tests set is_live=coalesce(p_is_live,false),
  live_starts_at=case when p_is_live then p_starts_at else null end,
  live_ends_at=case when p_is_live then p_ends_at else null end,
  results_publish_at=case when p_is_live then v_results else null end
 where id=p_test_id;
 if not found then raise exception 'test unavailable'; end if;
end $function$;

commit;

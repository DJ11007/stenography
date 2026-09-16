-- "Anytime" live tests: real requested feature. A student can attempt the
-- test on any day, at any time (no fixed live_starts_at/live_ends_at
-- window), one attempt each -- but instead of one shared results_publish_at
-- for everyone, THEIR OWN result unlocks a fixed delay (admin-configured,
-- e.g. 10 minutes) after THEIR OWN submission. Selected per test alongside
-- the existing scheduled-window shape, which is completely untouched: every
-- pre-existing live test has results_delay_minutes null and keeps working
-- exactly as before.
alter table public.tests add column if not exists results_delay_minutes integer;

alter table public.tests drop constraint if exists tests_live_schedule_valid;
alter table public.tests add constraint tests_live_schedule_valid check (
  (not is_live and live_starts_at is null and live_ends_at is null and results_publish_at is null and results_delay_minutes is null)
  or
  (is_live and results_delay_minutes is null and visibility = 'public' and live_starts_at is not null and live_ends_at > live_starts_at and results_publish_at >= live_ends_at)
  or
  (is_live and results_delay_minutes is not null and results_delay_minutes > 0 and results_delay_minutes <= 1440 and visibility = 'public' and live_starts_at is null and live_ends_at is null and results_publish_at is null)
);

-- Anytime attempts skip the scheduled-window check entirely (there is no
-- window); the existing one-attempt-per-student unique index
-- (one_live_attempt_per_student, from 202608190001) already covers both
-- shapes unmodified.
drop policy if exists "Students insert own attempts" on public.test_attempts;
create policy "Students insert own attempts" on public.test_attempts for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.tests t
      where t.id = test_id
        and t.current_version_id = test_version_id
        and t.status = 'published'
        and t.visibility = 'public'
        and (
          (not is_live_attempt and not t.is_live)
          or
          (is_live_attempt and t.is_live and t.results_delay_minutes is null and now() between t.live_starts_at and t.live_ends_at)
          or
          (is_live_attempt and t.is_live and t.results_delay_minutes is not null)
        )
    )
  );

-- The per-attempt gate for anytime mode: now() >= this row's OWN
-- submitted_at + the test's configured delay, instead of the scheduled
-- shape's shared "now() >= t.results_publish_at" test-level gate. A row
-- with submitted_at null (a live attempt somehow read before its own
-- insert completes) never satisfies this, same as it never satisfied the
-- scheduled shape's gate either.
drop policy if exists "Students read own attempts" on public.test_attempts;
create policy "Students read own attempts" on public.test_attempts for select to authenticated
  using (
    public.is_aal2_admin()
    or (
      student_id = auth.uid()
      and (
        not is_live_attempt
        or exists (
          select 1 from public.tests t
          where t.id = test_id
            and (
              (t.results_delay_minutes is null and now() >= t.results_publish_at)
              or
              (t.results_delay_minutes is not null and submitted_at is not null and now() >= submitted_at + (t.results_delay_minutes || ' minutes')::interval)
            )
        )
      )
    )
  );

create or replace function public.save_scheduled_managed_test(p_test_id uuid, p_payload jsonb, p_publish boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
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
  elsif v_is_live then
    if (v_start is null or v_end <= v_start or v_results < v_end) then raise exception 'invalid live schedule'; end if;
  end if;
  if v_is_live and p_payload->>'visibility' <> 'public' then raise exception 'live tests must be public'; end if;
  v_test_id := public.save_managed_test(p_test_id, p_payload, p_publish);
  update public.tests set is_live=v_is_live,
    live_starts_at=case when v_is_live and v_delay is null then v_start else null end,
    live_ends_at=case when v_is_live and v_delay is null then v_end else null end,
    results_publish_at=case when v_is_live and v_delay is null then v_results else null end,
    results_delay_minutes=case when v_is_live then v_delay else null end
  where id=v_test_id;
  insert into public.admin_test_audit_log(actor_user_id,test_id,action,metadata)
    values(auth.uid(),v_test_id,'live_schedule_saved',jsonb_build_object('is_live',v_is_live,'starts_at',v_start,'ends_at',v_end,'results_publish_at',v_results,'results_delay_minutes',v_delay));
  return v_test_id;
end; $$;

-- Anytime-mode attempts join the same anonymized public ticker once their
-- OWN individual delay has elapsed -- by definition that student already
-- knows their own result at that point, and the entry is anonymized the
-- same way a scheduled test's entries always have been, so this reveals
-- nothing to anyone who hasn't attempted yet.
create or replace function public.published_live_results(p_limit integer default 30)
returns table(student_name text, test_title text, net_wpm numeric, accuracy numeric, submitted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    left(coalesce(nullif(p.full_name,''),'Student'),1) || '•••' as student_name,
    t.title as test_title,
    round(coalesce((a.result->>'netWpm')::numeric,0),2) as net_wpm,
    round(coalesce((a.result->>'accuracy')::numeric,0),2) as accuracy,
    a.submitted_at
  from public.test_attempts a
  join public.tests t on t.id=a.test_id
  left join public.profiles p on p.id=a.student_id
  where a.is_live_attempt and t.is_live and (
    (t.results_delay_minutes is null and t.results_publish_at <= now())
    or
    (t.results_delay_minutes is not null and a.submitted_at + (t.results_delay_minutes || ' minutes')::interval <= now())
  )
  order by a.submitted_at desc
  limit least(greatest(coalesce(p_limit,30),1),100);
$$;

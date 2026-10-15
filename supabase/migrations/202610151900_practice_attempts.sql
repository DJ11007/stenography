-- Records attempts of the built-in typing tests (each exam category's
-- "Start Official Pattern", the stenography sample, the RSSB demo pages and
-- the student's own uploaded matters). Before this they were never saved, so
-- they appeared in neither the student's results nor the admin's records.
-- Admin-managed tests keep using test_attempts. Idempotent; safe to run again.
begin;

create table if not exists public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete restrict,
  preset_id text not null check (length(preset_id) between 1 and 200),
  title text not null check (length(title) between 1 and 300),
  mode text not null check (mode in ('practice', 'exam')),
  -- The test as the student took it (preset, input system), for the review page.
  snapshot jsonb not null check (pg_column_size(snapshot) <= 262144),
  -- Same shape as test_attempts.result (score frozen at submission).
  result jsonb not null check (pg_column_size(result) <= 524288),
  started_at timestamptz not null,
  submitted_at timestamptz not null default now()
);

create index if not exists practice_attempts_student_submitted_idx on public.practice_attempts (student_id, submitted_at desc);

alter table public.practice_attempts enable row level security;

drop policy if exists "Students insert own practice attempts" on public.practice_attempts;
create policy "Students insert own practice attempts" on public.practice_attempts
  for insert to authenticated with check (student_id = auth.uid());

drop policy if exists "Students and admins read practice attempts" on public.practice_attempts;
create policy "Students and admins read practice attempts" on public.practice_attempts
  for select to authenticated using (student_id = auth.uid() or public.is_aal2_admin());

grant select, insert on public.practice_attempts to authenticated;

commit;

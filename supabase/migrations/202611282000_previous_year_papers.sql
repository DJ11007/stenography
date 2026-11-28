-- Previous-year exam papers (28 Nov 2026, owner's request): any published test of any section (Typing exam,
-- Stenography, Word Efficiency, Excel Efficiency) can be marked as a paper that appeared in a real exam, with the
-- exam's name, its date and a description the admin writes. Students then see the test in a light highlighted
-- card with a "Previous Year" badge, and every such test is listed by year on the Old Exam Papers page
-- (/old-exam-papers). One row per test; tests without a row are normal tests and look exactly as before.
create table if not exists public.previous_year_papers (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('typing', 'stenography', 'word', 'excel')),
  test_id uuid not null,
  exam_name text not null check (length(btrim(exam_name)) between 1 and 200),
  exam_date date,
  exam_year integer not null check (exam_year between 1990 and 2100),
  description text check (description is null or length(description) <= 2000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section, test_id)
);
create index if not exists previous_year_papers_year on public.previous_year_papers (exam_year desc, exam_date desc);

alter table public.previous_year_papers enable row level security;

-- Everyone may read the labels (the tests themselves stay protected by their own tables' rules).
drop policy if exists "Anyone can read previous year papers" on public.previous_year_papers;
create policy "Anyone can read previous year papers" on public.previous_year_papers for select using (true);

drop policy if exists "Admins manage previous year papers" on public.previous_year_papers;
create policy "Admins manage previous year papers" on public.previous_year_papers for all to authenticated
  using (public.is_aal2_admin()) with check (public.is_aal2_admin());

grant select on public.previous_year_papers to anon, authenticated;
grant insert, update, delete on public.previous_year_papers to authenticated;

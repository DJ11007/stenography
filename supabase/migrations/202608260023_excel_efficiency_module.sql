begin;

-- Excel Efficiency: a spreadsheet counterpart to Word Efficiency, scoped to
-- data entry, basic formatting, a small formula set, and sorting (matching
-- the "20 curated exercises" scope the competing product advertises for the
-- same exam pattern, not a full spreadsheet application). Deliberately
-- simpler than Word Efficiency in two ways, both confirmed with the user:
-- (1) no per-test admin capability checklist -- every command is always
-- enabled, avoiding the entire class of bugs that system caused for Word;
-- (2) on-screen delivery only for this first version -- no PDF question
-- paper path yet. Auto-grading is wired in from day one this time, unlike
-- Word Efficiency where it shipped as a separate later fix.

create table public.excel_efficiency_tests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  language text not null check (language in ('English','Hindi')),
  status text not null default 'draft' check (status in ('draft','published','unpublished','archived')),
  current_version_id uuid,
  current_version_number integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.excel_efficiency_versions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.excel_efficiency_tests(id) on delete restrict,
  version_number integer not null check (version_number>0),
  title text not null,
  language text not null check (language in ('English','Hindi')),
  description text not null default '',
  instructions_markdown text not null check (char_length(btrim(instructions_markdown)) between 10 and 20000),
  question_count integer not null check (question_count between 1 and 100),
  maximum_marks numeric(8,2) not null check (maximum_marks>0 and maximum_marks<=10000),
  duration_options integer[] not null check (cardinality(duration_options) between 1 and 12),
  passing_marks numeric(8,2),
  working_matter_snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(test_id,version_number),
  check (passing_marks is null or (passing_marks>=0 and passing_marks<=maximum_marks))
);

alter table public.excel_efficiency_tests add constraint excel_efficiency_current_version_fk foreign key(current_version_id) references public.excel_efficiency_versions(id) on delete restrict;

create table public.excel_efficiency_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.excel_efficiency_versions(id) on delete restrict,
  question_number integer not null check(question_number>0),
  instruction text not null check(char_length(btrim(instruction)) between 1 and 10000),
  marks numeric(8,2) not null check(marks>0),
  section text,
  display_order integer not null,
  is_visible boolean not null default true,
  unique(version_id,question_number)
);

create table public.excel_efficiency_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.excel_efficiency_tests(id) on delete restrict,
  version_id uuid not null references public.excel_efficiency_versions(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  selected_duration_seconds integer not null check(selected_duration_seconds between 60 and 14400),
  snapshot jsonb not null,
  status text not null default 'prepared' check(status in ('prepared','active','submitted','completed')),
  original_document_snapshot jsonb,
  document_autosave jsonb,
  final_document_snapshot jsonb,
  result jsonb,
  evaluation_status text check(evaluation_status is null or evaluation_status in('draft','published')),
  overall_teacher_feedback text check(overall_teacher_feedback is null or char_length(overall_teacher_feedback)<=10000),
  private_teacher_note text check(private_teacher_note is null or char_length(private_teacher_note)<=10000),
  evaluated_by uuid references public.profiles(id) on delete restrict,
  evaluated_at timestamptz,
  result_published_at timestamptz,
  prepared_at timestamptz not null default now(),
  started_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.excel_efficiency_question_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.excel_efficiency_attempts(id) on delete restrict,
  question_id uuid not null references public.excel_efficiency_questions(id) on delete restrict,
  question_number integer not null check(question_number>0),
  maximum_marks numeric(8,2) not null check(0<maximum_marks and maximum_marks<=1000),
  awarded_marks numeric(8,2) check(awarded_marks is null or(0<=awarded_marks and awarded_marks<=maximum_marks)),
  teacher_comment text,
  grading_status text not null default 'ungraded' check(grading_status in('ungraded','in_progress','graded')),
  graded_by uuid references public.profiles(id) on delete restrict,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(attempt_id,question_id)
);

create table public.excel_efficiency_grading_rules (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.excel_efficiency_versions(id) on delete cascade,
  question_id uuid not null references public.excel_efficiency_questions(id) on delete cascade,
  exact_target text not null check(char_length(btrim(exact_target)) between 1 and 300),
  expected_operation text not null check(char_length(btrim(expected_operation)) between 1 and 100),
  expected_value jsonb not null,
  allocated_marks numeric(10,2) not null check(allocated_marks>0),
  partial_marks numeric(10,2) check(partial_marks is null or partial_marks between 0 and allocated_marks),
  created_at timestamptz not null default now(),
  unique(version_id,question_id),
  unique(id,version_id)
);

create index excel_efficiency_catalogue on public.excel_efficiency_tests(language,status,published_at desc,id);
create index excel_efficiency_attempt_student on public.excel_efficiency_attempts(student_id,prepared_at desc);
create index excel_efficiency_attempt_test on public.excel_efficiency_attempts(test_id,prepared_at desc);
create index excel_efficiency_question_version on public.excel_efficiency_questions(version_id,question_number);

alter table public.excel_efficiency_tests enable row level security;
alter table public.excel_efficiency_versions enable row level security;
alter table public.excel_efficiency_questions enable row level security;
alter table public.excel_efficiency_attempts enable row level security;
alter table public.excel_efficiency_question_scores enable row level security;
alter table public.excel_efficiency_grading_rules enable row level security;

create policy "Published Excel tests are student readable" on public.excel_efficiency_tests for select to authenticated using((status='published' and current_version_id is not null) or public.is_aal2_admin());
create policy "AAL2 admins manage Excel tests" on public.excel_efficiency_tests for all to authenticated using(public.is_aal2_admin()) with check(public.is_aal2_admin());
create policy "Published Excel versions are student readable" on public.excel_efficiency_versions for select to authenticated using(public.is_aal2_admin() or exists(select 1 from public.excel_efficiency_tests t where t.id=excel_efficiency_versions.test_id and t.current_version_id=excel_efficiency_versions.id and t.status='published'));
create policy "AAL2 admins insert Excel versions" on public.excel_efficiency_versions for insert to authenticated with check(public.is_aal2_admin() and created_by=auth.uid());
create policy "Published Excel questions are student readable" on public.excel_efficiency_questions for select to authenticated using(public.is_aal2_admin() or exists(select 1 from public.excel_efficiency_tests t join public.excel_efficiency_versions v on v.id=t.current_version_id where v.id=excel_efficiency_questions.version_id and t.status='published'));
create policy "AAL2 admins insert Excel questions" on public.excel_efficiency_questions for insert to authenticated with check(public.is_aal2_admin());
create policy "Students read own Excel attempts" on public.excel_efficiency_attempts for select to authenticated using(student_id=auth.uid() or public.is_aal2_admin());
create policy "Students create own Excel attempts" on public.excel_efficiency_attempts for insert to authenticated with check(student_id=auth.uid());
create policy "AAL2 admins read Excel attempts" on public.excel_efficiency_attempts for select to authenticated using(public.is_aal2_admin());
create policy "AAL2 admins manage Excel scores" on public.excel_efficiency_question_scores for all to authenticated using(public.is_aal2_admin()) with check(public.is_aal2_admin());
create policy "AAL2 admins manage Excel grading rules" on public.excel_efficiency_grading_rules for all to authenticated using(public.is_aal2_admin()) with check(public.is_aal2_admin());

revoke update,delete on public.excel_efficiency_versions,public.excel_efficiency_questions from authenticated;
revoke update,delete on public.excel_efficiency_attempts from authenticated;
revoke all on public.excel_efficiency_question_scores,public.excel_efficiency_grading_rules from authenticated;

commit;

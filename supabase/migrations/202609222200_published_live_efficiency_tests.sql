begin;

-- Real requested feature: /live-test should group Typing, Stenography, and
-- Efficiency live tests into separate categories, in that order. Typing and
-- Stenography are both rows in public.tests (distinguished by mode), which
-- already has a genuinely public "Anyone can view published tests" RLS
-- policy (see 202608160003_admin_test_management.sql:139) -- that's why
-- /live-test already works for logged-out visitors today.
--
-- Word/Excel Efficiency tests live in entirely separate tables
-- (word_efficiency_tests / excel_efficiency_tests) whose own select
-- policies are ALL "for select to authenticated" only (see
-- 202608230010_word_efficiency_module.sql:84,86,88 and
-- 202608260023_excel_efficiency_module.sql:128,130,132). A plain
-- client-side query against those tables would silently return zero rows
-- for anonymous visitors while still working for logged-in students -- the
-- same public-RPC pattern already used for published_live_results is
-- needed here so anonymous visitors can see live efficiency tests too.
--
-- This RPC returns every published, live efficiency test regardless of its
-- scheduling window; the page applies liveTestState() client-side to each
-- row exactly like it already does for typing/stenography, so this
-- function's only job is making the rows anon-readable, not scheduling.
create or replace function public.published_live_efficiency_tests()
returns table(
  id uuid,
  subject text,
  slug text,
  title text,
  language text,
  is_live boolean,
  live_starts_at timestamptz,
  live_ends_at timestamptz,
  results_publish_at timestamptz,
  duration_options integer[]
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, 'word'::text as subject, t.slug, t.title, t.language, t.is_live, t.live_starts_at, t.live_ends_at, t.results_publish_at, v.duration_options
  from public.word_efficiency_tests t
  join public.word_efficiency_versions v on v.id = t.current_version_id
  where t.status = 'published' and t.is_live
  union all
  select t.id, 'excel'::text as subject, t.slug, t.title, t.language, t.is_live, t.live_starts_at, t.live_ends_at, t.results_publish_at, v.duration_options
  from public.excel_efficiency_tests t
  join public.excel_efficiency_versions v on v.id = t.current_version_id
  where t.status = 'published' and t.is_live;
$$;

grant execute on function public.published_live_efficiency_tests() to anon, authenticated;

commit;

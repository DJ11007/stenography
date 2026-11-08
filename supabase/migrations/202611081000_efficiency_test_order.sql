-- Word / Excel Efficiency: the admin arranges the tests by dragging them on the admin page (8 Nov 2026). The order is
-- kept per test (`sequence`, per subject and language) and the student catalogues follow it. Tests start in the order
-- of the number in their title (TEST 1, TEST 2 ... TEST 10). Safe to run twice.
begin;

alter table public.word_efficiency_tests add column if not exists sequence integer;
alter table public.excel_efficiency_tests add column if not exists sequence integer;

with ranked as (
  select id, row_number() over (partition by language order by coalesce(nullif(substring(title from '([0-9]+)'), '')::integer, 2147483647), title, created_at) as n
    from public.word_efficiency_tests)
update public.word_efficiency_tests t set sequence = ranked.n from ranked where ranked.id = t.id and t.sequence is null;

with ranked as (
  select id, row_number() over (partition by language order by coalesce(nullif(substring(title from '([0-9]+)'), '')::integer, 2147483647), title, created_at) as n
    from public.excel_efficiency_tests)
update public.excel_efficiency_tests t set sequence = ranked.n from ranked where ranked.id = t.id and t.sequence is null;

-- p_ids: the tests of one list (one subject and language) in their new order, first to last.
create or replace function public.set_efficiency_test_order(p_subject text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_subject = 'word' then
    update public.word_efficiency_tests t set sequence = o.n from unnest(p_ids) with ordinality as o(id, n) where t.id = o.id;
  elsif p_subject = 'excel' then
    update public.excel_efficiency_tests t set sequence = o.n from unnest(p_ids) with ordinality as o(id, n) where t.id = o.id;
  else
    raise exception 'unknown subject';
  end if;
end $function$;

revoke all on function public.set_efficiency_test_order(text, uuid[]) from public, anon;
grant execute on function public.set_efficiency_test_order(text, uuid[]) to authenticated;

commit;

-- Typing tests delivered to the offline SCTyping app (admin: /admin/app-control/typing).
-- A test is either COPIED from a website test (source_test_id set, so it can't be added twice) or created
-- directly for the app. Hindi tests copied from the website keep their Kruti Dev text (encoding 'krutidev');
-- Hindi tests typed in the admin form are Unicode and the app converts them to Kruti Dev itself.
-- public_app_control() now also returns the published tests. RLS on, no policies: only the SECURITY DEFINER
-- functions below touch the table, and every admin function requires an AAL2 admin.
-- Safe to run twice. (Applied to production as migration "app_tests".)

create table if not exists public.app_tests (
  id uuid primary key default gen_random_uuid(),
  source_test_id uuid unique,
  title text not null,
  language text not null check (language in ('English', 'Hindi')),
  mode text not null check (mode in ('exam', 'practice')),
  board text,
  duration_seconds integer not null default 600 check (duration_seconds between 30 and 7200),
  required_wpm numeric,
  required_accuracy numeric,
  backspace_mode text not null default 'full' check (backspace_mode in ('full', 'word', 'disabled')),
  encoding text not null default 'unicode' check (encoding in ('unicode', 'krutidev')),
  passage text not null,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.app_tests enable row level security;

create or replace function public.public_app_control()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'rules', coalesce((select jsonb_object_agg(key, jsonb_build_object('visible', visible, 'access', access)) from public.app_control_rules), '{}'::jsonb),
    'settings', coalesce((select jsonb_object_agg(key, value) from public.app_control_settings), '{}'::jsonb),
    'tests', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'language', language, 'mode', mode, 'board', board,
        'durationSeconds', duration_seconds, 'wpm', required_wpm, 'accuracy', required_accuracy, 'backspace', backspace_mode,
        'encoding', encoding, 'passage', passage) order by created_at) from public.app_tests where published), '[]'::jsonb)
  );
$function$;
grant execute on function public.public_app_control() to anon, authenticated;

create or replace function public.admin_list_app_tests()
 returns table(id uuid, source_test_id uuid, title text, language text, mode text, board text, duration_seconds integer, required_wpm numeric, required_accuracy numeric, backspace_mode text, encoding text, published boolean, words integer, created_at timestamptz)
 language plpgsql stable security definer set search_path to 'pg_catalog', 'public'
as $function$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  return query select a.id, a.source_test_id, a.title, a.language, a.mode, a.board, a.duration_seconds, a.required_wpm, a.required_accuracy, a.backspace_mode, a.encoding, a.published,
    coalesce(array_length(regexp_split_to_array(btrim(a.passage), '\s+'), 1), 0), a.created_at
  from public.app_tests a order by a.created_at desc;
end;
$function$;
revoke all on function public.admin_list_app_tests() from public, anon;
grant execute on function public.admin_list_app_tests() to authenticated;

create or replace function public.admin_add_website_tests_to_app(p_ids uuid[])
 returns integer
 language plpgsql security definer set search_path to 'pg_catalog', 'public'
as $function$
declare added integer;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  with ins as (
    insert into public.app_tests (source_test_id, title, language, mode, board, duration_seconds, required_wpm, required_accuracy, backspace_mode, encoding, passage)
    select t.id, t.title, t.language, t.mode::text, nullif(t.settings->>'exam_category', ''), coalesce(t.duration_seconds, 600),
      nullif(t.settings->>'required_wpm', '')::numeric, nullif(t.settings->>'required_accuracy', '')::numeric,
      case when t.settings->>'backspace_mode' in ('full', 'word', 'disabled') then t.settings->>'backspace_mode' else 'full' end,
      case when t.input_system_id like '%krutidev%' then 'krutidev' else 'unicode' end,
      coalesce(t.settings->>'passage', t.content->>'passage')
    from public.tests t
    where t.id = any(p_ids) and t.status::text = 'published' and t.test_type::text = 'typing' and t.mode::text in ('exam', 'practice')
      and coalesce(t.settings->>'passage', t.content->>'passage') is not null
    on conflict (source_test_id) do nothing
    returning 1)
  select count(*) into added from ins;
  return added;
end;
$function$;
revoke all on function public.admin_add_website_tests_to_app(uuid[]) from public, anon;
grant execute on function public.admin_add_website_tests_to_app(uuid[]) to authenticated;

create or replace function public.admin_save_app_test(p_id uuid, p_title text, p_language text, p_mode text, p_duration integer, p_wpm numeric, p_accuracy numeric, p_backspace text, p_passage text)
 returns uuid
 language plpgsql security definer set search_path to 'pg_catalog', 'public'
as $function$
declare saved uuid;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if btrim(coalesce(p_title, '')) = '' then raise exception 'Title is required.'; end if;
  if btrim(coalesce(p_passage, '')) = '' then raise exception 'The passage cannot be empty.'; end if;
  if p_id is null then
    insert into public.app_tests (title, language, mode, duration_seconds, required_wpm, required_accuracy, backspace_mode, encoding, passage)
    values (btrim(p_title), p_language, p_mode, p_duration, p_wpm, p_accuracy, p_backspace, 'unicode', p_passage) returning id into saved;
  else
    update public.app_tests set title = btrim(p_title), language = p_language, mode = p_mode, duration_seconds = p_duration, required_wpm = p_wpm,
      required_accuracy = p_accuracy, backspace_mode = p_backspace, passage = p_passage where id = p_id returning id into saved;
  end if;
  return saved;
end;
$function$;
revoke all on function public.admin_save_app_test(uuid, text, text, text, integer, numeric, numeric, text, text) from public, anon;
grant execute on function public.admin_save_app_test(uuid, text, text, text, integer, numeric, numeric, text, text) to authenticated;

create or replace function public.admin_update_app_tests(p_ids uuid[], p_action text)
 returns void
 language plpgsql security definer set search_path to 'pg_catalog', 'public'
as $function$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_action = 'delete' then delete from public.app_tests where id = any(p_ids);
  elsif p_action = 'hide' then update public.app_tests set published = false where id = any(p_ids);
  elsif p_action = 'show' then update public.app_tests set published = true where id = any(p_ids);
  else raise exception 'bad action'; end if;
end;
$function$;
revoke all on function public.admin_update_app_tests(uuid[], text) from public, anon;
grant execute on function public.admin_update_app_tests(uuid[], text) to authenticated;

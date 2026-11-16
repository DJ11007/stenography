-- Stenography tests for the offline SCTyping app (admin: /admin/app-control/steno).
-- Extends app_tests (202611161000_app_tests.sql) with mode 'steno' and the dictation audio's storage path.
-- The audio lives in the PRIVATE stenography-audio bucket; the app asks /offline-app/steno-audio/<id>
-- for a short-lived signed URL. To let that route (anonymous, no service key) sign ONLY those files, one
-- storage policy allows select on exactly the objects an admin has published to the app.
-- Safe to run twice. (Applied to production as migration "app_tests_steno".)

alter table public.app_tests add column if not exists audio_path text;
alter table public.app_tests drop constraint if exists app_tests_mode_check;
alter table public.app_tests add constraint app_tests_mode_check check (mode in ('exam', 'practice', 'steno'));

drop policy if exists "Published app steno audio is readable" on storage.objects;
-- The check is a SECURITY DEFINER function because app_tests itself is not readable by anon (RLS, no policies).
create or replace function public.is_published_app_steno_audio(p_name text)
 returns boolean
 language sql stable security definer set search_path to 'pg_catalog', 'public'
as $function$
  select exists (select 1 from public.app_tests a where a.published and a.mode = 'steno' and a.audio_path = p_name);
$function$;
grant execute on function public.is_published_app_steno_audio(text) to anon, authenticated;
create policy "Published app steno audio is readable" on storage.objects for select to anon, authenticated
  using (bucket_id = 'stenography-audio' and public.is_published_app_steno_audio(name));

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
        'encoding', encoding, 'passage', passage, 'hasAudio', audio_path is not null) order by created_at) from public.app_tests where published), '[]'::jsonb)
  );
$function$;
grant execute on function public.public_app_control() to anon, authenticated;

drop function if exists public.admin_list_app_tests();
create or replace function public.admin_list_app_tests()
 returns table(id uuid, source_test_id uuid, title text, language text, mode text, board text, duration_seconds integer, required_wpm numeric, required_accuracy numeric, backspace_mode text, encoding text, published boolean, words integer, has_audio boolean, created_at timestamptz)
 language plpgsql stable security definer set search_path to 'pg_catalog', 'public'
as $function$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  return query select a.id, a.source_test_id, a.title, a.language, a.mode, a.board, a.duration_seconds, a.required_wpm, a.required_accuracy, a.backspace_mode, a.encoding, a.published,
    coalesce(array_length(regexp_split_to_array(btrim(a.passage), '\s+'), 1), 0), a.audio_path is not null, a.created_at
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
    insert into public.app_tests (source_test_id, title, language, mode, board, duration_seconds, required_wpm, required_accuracy, backspace_mode, encoding, passage, audio_path)
    select t.id, t.title, t.language,
      case when t.test_type::text = 'stenography' then 'steno' else t.mode::text end,
      nullif(case when t.test_type::text = 'stenography' then t.settings->>'steno_category' else t.settings->>'exam_category' end, ''),
      coalesce(t.duration_seconds, 600),
      nullif(t.settings->>'required_wpm', '')::numeric, nullif(t.settings->>'required_accuracy', '')::numeric,
      case when t.settings->>'backspace_mode' in ('full', 'word', 'disabled') then t.settings->>'backspace_mode' else 'full' end,
      case when t.input_system_id like '%krutidev%' then 'krutidev' else 'unicode' end,
      coalesce(t.settings->>'passage', t.content->>'passage'),
      case when t.test_type::text = 'stenography' then nullif(t.settings->>'audio_path', '') else null end
    from public.tests t
    where t.id = any(p_ids) and t.status::text = 'published'
      and ((t.test_type::text = 'typing' and t.mode::text in ('exam', 'practice')) or t.test_type::text = 'stenography')
      and coalesce(t.settings->>'passage', t.content->>'passage') is not null
    on conflict (source_test_id) do nothing
    returning 1)
  select count(*) into added from ins;
  return added;
end;
$function$;
revoke all on function public.admin_add_website_tests_to_app(uuid[]) from public, anon;
grant execute on function public.admin_add_website_tests_to_app(uuid[]) to authenticated;

-- Lets /offline-app/steno-audio/<id> find the storage path of one published steno test (nothing else).
create or replace function public.public_app_steno_audio_path(p_id uuid)
 returns text
 language sql stable security definer set search_path to 'pg_catalog', 'public'
as $function$
  select audio_path from public.app_tests where id = p_id and published and mode = 'steno' and audio_path is not null;
$function$;
grant execute on function public.public_app_steno_audio_path(uuid) to anon, authenticated;

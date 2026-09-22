begin;

-- Speed Race: admin-authored passage library (/typing/games/speed-race),
-- editable at /admin/speedrace-passages. Same shape as
-- wordtris_word_banks/krutidev_tutor_exercises: a plain table reachable
-- only through security-definer RPCs (RLS on, no policies),
-- is_aal2_admin()-gated writes.
--
-- Real reported request: Speed Race's passage was always silently
-- auto-built from the chosen WordTris category's word bank, with no way
-- for an admin to author a real passage or offer students a choice of
-- several. Scoped by language only (not category) -- unlike word banks,
-- a passage is freeform prose, not a themed vocabulary list, so forcing
-- it under animals/cars/etc. labels would be an awkward fit. When no
-- published passage exists for a language, the game falls back to the
-- existing auto-generated-from-word-bank passage unchanged, so nothing
-- breaks for a language the admin hasn't touched yet.
create table if not exists public.speedrace_passages(
  id uuid primary key default gen_random_uuid(),
  language text not null check (language in ('hindi','english')),
  title text not null,
  passage text not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.speedrace_passages enable row level security;
create index if not exists speedrace_passages_listing
  on public.speedrace_passages(is_published, language);

-- Oldest first, matching this app's other student-facing catalogue
-- conventions (e.g. stenography's real-test list) -- a newly added
-- passage doesn't jump ahead of ones already in rotation.
create or replace function public.list_published_speedrace_passages(p_language text)
returns setof public.speedrace_passages
language sql stable security definer set search_path=public as $fn$
  select * from public.speedrace_passages
  where is_published and language=p_language
  order by created_at;
$fn$;

create or replace function public.admin_list_speedrace_passages()
returns setof public.speedrace_passages
language plpgsql stable security definer set search_path=public as $fn$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  return query select * from public.speedrace_passages order by language, created_at;
end $fn$;

create or replace function public.admin_save_speedrace_passage(
  p_id uuid, p_language text, p_title text, p_passage text, p_is_published boolean
) returns public.speedrace_passages
language plpgsql security definer set search_path=public as $fn$
declare saved_row public.speedrace_passages;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_language not in ('hindi','english') then raise exception 'Invalid language.'; end if;
  if trim(coalesce(p_title,'')) = '' then raise exception 'Title is required.'; end if;
  if trim(coalesce(p_passage,'')) = '' then raise exception 'Passage is required.'; end if;
  if p_id is null then
    insert into public.speedrace_passages(language,title,passage,is_published,created_by)
    values(p_language, trim(p_title), p_passage, coalesce(p_is_published,true), auth.uid())
    returning * into saved_row;
  else
    update public.speedrace_passages set
      language=p_language, title=trim(p_title), passage=p_passage,
      is_published=coalesce(p_is_published,true), updated_at=now()
    where id=p_id returning * into saved_row;
    if saved_row.id is null then raise exception 'Passage not found.'; end if;
  end if;
  return saved_row;
end $fn$;

create or replace function public.admin_delete_speedrace_passage(p_id uuid) returns void
language plpgsql security definer set search_path=public as $fn$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  delete from public.speedrace_passages where id=p_id;
end $fn$;

grant execute on function public.list_published_speedrace_passages(text) to authenticated;
revoke all on function public.admin_list_speedrace_passages(),
  public.admin_save_speedrace_passage(uuid,text,text,text,boolean),
  public.admin_delete_speedrace_passage(uuid) from public, anon;
grant execute on function public.admin_list_speedrace_passages(),
  public.admin_save_speedrace_passage(uuid,text,text,text,boolean),
  public.admin_delete_speedrace_passage(uuid) to authenticated;

commit;

begin;

-- Real requested feature: WordTris's Character mode and Key Hunter both
-- unconditionally drill every plain key on the Kruti Dev / English tutor
-- keyboards (lib/krutidev-tutor-content.ts / lib/english-tutor-content.ts's
-- GLYPH_KEYS), with no admin control over which keys are actually
-- practiced. This is a per-language enabled-key whitelist: no row (or an
-- empty array) means "every key", exactly matching both games' hardcoded
-- behavior before this table existed, so an admin who never touches
-- /admin/character-pool sees zero change. Content here is literal
-- keyboard bytes (what a student physically presses), not Unicode text
-- -- unlike wordtris_word_banks, there is nothing to author beyond
-- choosing a subset of the fixed, already-real keys, so this is a
-- toggle list, not a free-text word bank.
create table if not exists public.character_pool_config(
  language text primary key check (language in ('hindi','english')),
  enabled_keys text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.character_pool_config enable row level security;

-- Returns null (not an empty array) when unconfigured or emptied, so a
-- caller's own "use the default full keyboard" fallback triggers on
-- either "no row yet" and "admin cleared it back to everything" alike.
create or replace function public.get_character_pool_config(p_language text)
returns text[]
language sql stable security definer set search_path=public as $fn$
  select enabled_keys from public.character_pool_config
  where language=p_language and array_length(enabled_keys,1) > 0;
$fn$;

create or replace function public.admin_list_character_pool_config()
returns setof public.character_pool_config
language plpgsql stable security definer set search_path=public as $fn$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  return query select * from public.character_pool_config order by language;
end $fn$;

create or replace function public.admin_save_character_pool_config(p_language text, p_enabled_keys text[])
returns public.character_pool_config
language plpgsql security definer set search_path=public as $fn$
declare row public.character_pool_config;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_language not in ('hindi','english') then raise exception 'Invalid language.'; end if;
  insert into public.character_pool_config(language, enabled_keys, updated_by)
  values (p_language, coalesce(p_enabled_keys, '{}'), auth.uid())
  on conflict (language) do update set enabled_keys=excluded.enabled_keys, updated_at=now(), updated_by=excluded.updated_by
  returning * into row;
  return row;
end $fn$;

revoke all on function
  public.get_character_pool_config(text),
  public.admin_list_character_pool_config(),
  public.admin_save_character_pool_config(text,text[])
from public, anon;
grant execute on function public.get_character_pool_config(text) to anon, authenticated;
grant execute on function
  public.admin_list_character_pool_config(),
  public.admin_save_character_pool_config(text,text[])
to authenticated;

commit;

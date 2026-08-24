begin;

create or replace function public.normalize_practice_version_settings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.mode = 'practice'::public.test_mode
     and not coalesce((new.configuration->>'is_live')::boolean, false) then
    new.backspace_mode := 'full';
    new.word_method := 'characters';
    new.highlight_mode := 'character';
    new.configuration := coalesce(new.configuration, '{}'::jsonb) || jsonb_build_object(
      'backspace_mode', 'full',
      'word_method', 'characters',
      'highlight_mode', 'character',
      'settings_locks', '{}'::jsonb
    );
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_practice_version_settings_before_insert on public.test_versions;
create trigger normalize_practice_version_settings_before_insert
before insert on public.test_versions
for each row execute function public.normalize_practice_version_settings();

comment on function public.normalize_practice_version_settings() is
  'Neutralizes stale or forged rule settings for new non-live practice versions; immutable historical versions are not rewritten.';

commit;

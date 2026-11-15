-- Admin control for the offline SCTyping app.
--
-- One rule per item the app shows, keyed like "section:exam", "exam:ssc-cgl", "steno:<slug>",
-- "word:<slug>", "excel:<slug>", "learn:krutidev". An item with NO row behaves exactly as before
-- (visible, default access), so the app keeps working unchanged until the admin sets something.
--   visible : false hides the item in the app.
--   access  : 'default' = normal trial rules, 'free' = open to unactivated (trial) users with no
--             trial limits, 'activated' = locked until the app is activated.
-- app_control_settings holds the few global values (notice banner, trial limits) as key/value text.
--
-- Both tables have RLS enabled and no policies: nothing reads or writes them directly. The app reads
-- public_app_control() (anon-callable, returns only this config); the admin page saves through
-- admin_save_app_control(), which requires an AAL2 admin like the other admin RPCs.
-- Safe to run twice.

create table if not exists public.app_control_rules (
  key text primary key,
  visible boolean not null default true,
  access text not null default 'default' check (access in ('default', 'free', 'activated')),
  updated_at timestamptz not null default now()
);
alter table public.app_control_rules enable row level security;

create table if not exists public.app_control_settings (
  key text primary key,
  value text not null default ''
);
alter table public.app_control_settings enable row level security;

create or replace function public.public_app_control()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'rules', coalesce((select jsonb_object_agg(key, jsonb_build_object('visible', visible, 'access', access)) from public.app_control_rules), '{}'::jsonb),
    'settings', coalesce((select jsonb_object_agg(key, value) from public.app_control_settings), '{}'::jsonb)
  );
$function$;
grant execute on function public.public_app_control() to anon, authenticated;

create or replace function public.admin_save_app_control(p_rules jsonb, p_settings jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  item jsonb;
  setting record;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if jsonb_typeof(p_rules) <> 'array' or jsonb_typeof(p_settings) <> 'object' then raise exception 'bad payload'; end if;

  -- Replace the whole rule set: rows that went back to "visible + default" are simply removed.
  delete from public.app_control_rules where true;
  for item in select * from jsonb_array_elements(p_rules) loop
    if coalesce((item->>'visible')::boolean, true) = false or coalesce(item->>'access', 'default') <> 'default' then
      insert into public.app_control_rules (key, visible, access)
      values (item->>'key', coalesce((item->>'visible')::boolean, true), coalesce(item->>'access', 'default'));
    end if;
  end loop;

  delete from public.app_control_settings where true;
  for setting in select key, value from jsonb_each_text(p_settings) loop
    if btrim(setting.value) <> '' then
      insert into public.app_control_settings (key, value) values (setting.key, left(setting.value, 500));
    end if;
  end loop;
end;
$function$;
revoke all on function public.admin_save_app_control(jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_app_control(jsonb, jsonb) to authenticated;

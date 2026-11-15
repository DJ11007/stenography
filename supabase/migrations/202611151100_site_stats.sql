-- Public homepage stats: registered students and offline-app (SCTyping) downloads.
--
-- Downloads were never counted before -- the installer was a plain static file anyone could fetch
-- directly. app/offline-app/download/route.ts now records one download via
-- record_offline_app_download() and then redirects to the file, so the count starts from the day
-- this ships; earlier downloads can't be recovered.
--
-- site_counters has RLS enabled and no policies: nothing can read or write it directly, only
-- through the two SECURITY DEFINER functions below, which expose exactly one increment and two
-- totals (never individual profiles).
-- Safe to run twice.

create table if not exists public.site_counters (
  key text primary key,
  value bigint not null default 0
);
alter table public.site_counters enable row level security;
insert into public.site_counters (key, value) values ('offline_app_downloads', 0) on conflict (key) do nothing;

create or replace function public.record_offline_app_download()
 returns void
 language sql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  update public.site_counters set value = value + 1 where key = 'offline_app_downloads';
$function$;
grant execute on function public.record_offline_app_download() to anon, authenticated;

create or replace function public.public_site_stats()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student'),
    'downloads', coalesce((select value from public.site_counters where key = 'offline_app_downloads'), 0)
  );
$function$;
grant execute on function public.public_site_stats() to anon, authenticated;

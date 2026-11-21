-- 21 Nov 2026 (owner's request): joining Telegram is no longer required. New students only see a
-- "Join Telegram -- SAMRADHI CLASSES" link; no account is locked for not joining.
create or replace function public.is_telegram_locked(p_telegram_joined boolean, p_telegram_exempt boolean, p_created_at timestamp with time zone)
 returns boolean
 language sql
 stable
 set search_path to 'pg_catalog', 'public'
as $function$
  select false
$function$;

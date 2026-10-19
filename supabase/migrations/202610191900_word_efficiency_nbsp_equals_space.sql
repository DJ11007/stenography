-- Text criteria compared strings byte for byte. The editor sometimes stores a non-breaking space
-- (U+00A0) where a run boundary was -- EFFICIENCY TEST 1's Q3 model text has one after "Results" --
-- while a student's document has an ordinary space there (or the other way round). The two look
-- identical, but the check failed: Q3 was 0 for correctly capitalised red text. A non-breaking space
-- now counts as an ordinary space when two strings are compared. Only adds matches.
begin;

create or replace function public.word_efficiency_values_equivalent(actual jsonb, expected jsonb, ignore_case boolean)
 returns boolean
 language sql
 immutable
 set search_path to 'pg_catalog', 'public'
as $function$
 select actual is not distinct from expected
  or (public.word_efficiency_zeroish(actual) and public.word_efficiency_zeroish(expected))
  or (jsonb_typeof(actual)='string' and jsonb_typeof(expected)='string' and (
       replace(actual#>>'{}', chr(160), ' ') = replace(expected#>>'{}', chr(160), ' ')
       or (coalesce(ignore_case,false) and lower(replace(actual#>>'{}', chr(160), ' ')) = lower(replace(expected#>>'{}', chr(160), ' ')))))
$function$;

commit;

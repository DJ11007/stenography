-- Word 2013 allows font sizes from 1 to 1638 pt in half points; tests stopped
-- at 72 pt (table cells at 400). Builds on 202610151600 (min 1 pt).
-- Idempotent; safe to run again.
begin;

-- New tests start with 1-1638 pt.
do $$
declare d text := pg_get_functiondef('public.word_efficiency_default_editor_capabilities()'::regprocedure);
begin
  if position('''fontSizeMax'',72' in d) > 0 then execute replace(d, '''fontSizeMax'',72', '''fontSizeMax'',1638'); end if;
end $$;

-- Table cell sizes up to 1638 pt.
do $$
declare d text := pg_get_functiondef('public.word_efficiency_valid_cell_format(jsonb)'::regprocedure);
begin
  if position('between 1 and 400' in d) > 0 then execute replace(d, 'between 1 and 400', 'between 1 and 1638'); end if;
end $$;

-- Range check 1-1638 here; the older check (min >= 8, max <= 72) gets a fixed
-- range it accepts, as it only needs a valid one.
create or replace function public.assert_word_efficiency_editor_capabilities(c jsonb)
returns void language plpgsql immutable set search_path to 'pg_catalog', 'public' as $function$
declare font_value jsonb;legacy_caps jsonb;size_min numeric;size_max numeric;
begin
 if c->>'schemaVersion'='2'then
  if jsonb_typeof(c->'fonts')<>'array'or jsonb_array_length(c->'fonts')not between 1 and array_length(public.word_efficiency_approved_fonts(),1)or jsonb_array_length(c->'fonts')<>(select count(distinct value#>>'{}')from jsonb_array_elements(c->'fonts'))then raise exception'Unknown or duplicate editor font';end if;
  for font_value in select value from jsonb_array_elements(c->'fonts')loop if jsonb_typeof(font_value)<>'string'or not((font_value#>>'{}')=any(public.word_efficiency_approved_fonts()))then raise exception'Unknown or duplicate editor font';end if;end loop;
  if jsonb_typeof(c->'fontSizeMin')<>'number'or jsonb_typeof(c->'fontSizeMax')<>'number'then raise exception'Editor font-size range is invalid';end if;
  size_min:=(c->>'fontSizeMin')::numeric;size_max:=(c->>'fontSizeMax')::numeric;
  if size_min<>trunc(size_min)or size_max<>trunc(size_max)or size_min<1 or size_max>1638 or size_min>size_max then raise exception'Editor font-size range is invalid';end if;
  legacy_caps:=jsonb_set(jsonb_set(jsonb_set(c,'{fonts}','["Calibri"]'::jsonb),'{fontSizeMin}','8'::jsonb),'{fontSizeMax}','72'::jsonb);
 else legacy_caps:=c;end if;
 perform public.assert_word_efficiency_editor_capabilities_before_font_expansion(legacy_caps);
end $function$;

-- Existing tests: allow up to 1638 pt.
update public.word_efficiency_versions
set editor_capabilities = jsonb_set(editor_capabilities, '{fontSizeMax}', '1638'::jsonb)
where editor_capabilities->>'schemaVersion' = '2' and (editor_capabilities->>'fontSizeMax')::numeric < 1638;

commit;

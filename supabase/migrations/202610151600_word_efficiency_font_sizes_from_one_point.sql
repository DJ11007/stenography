-- Word allows any font size in half points down to 1 pt (1.5, 12.5, 18.5 ...).
-- Tests were limited to 8-72 pt, so a 1.5 pt answer could not even be saved.
-- Document font sizes were already stored as numbers (half points pass), only
-- the allowed range needs widening. Idempotent; safe to run again.
begin;

-- New tests start with 1-72 pt.
do $$
declare d text := pg_get_functiondef('public.word_efficiency_default_editor_capabilities()'::regprocedure);
begin
  if position('''fontSizeMin'',8' in d) > 0 then execute replace(d, '''fontSizeMin'',8', '''fontSizeMin'',1'); end if;
end $$;

-- The older capability check (assert_..._before_font_expansion, kept as is)
-- requires a minimum of at least 8; check the range here and hand it a value
-- it accepts.
create or replace function public.assert_word_efficiency_editor_capabilities(c jsonb)
returns void language plpgsql immutable set search_path to 'pg_catalog', 'public' as $function$
declare font_value jsonb;legacy_caps jsonb;size_min numeric;size_max numeric;
begin
 if c->>'schemaVersion'='2'then
  if jsonb_typeof(c->'fonts')<>'array'or jsonb_array_length(c->'fonts')not between 1 and array_length(public.word_efficiency_approved_fonts(),1)or jsonb_array_length(c->'fonts')<>(select count(distinct value#>>'{}')from jsonb_array_elements(c->'fonts'))then raise exception'Unknown or duplicate editor font';end if;
  for font_value in select value from jsonb_array_elements(c->'fonts')loop if jsonb_typeof(font_value)<>'string'or not((font_value#>>'{}')=any(public.word_efficiency_approved_fonts()))then raise exception'Unknown or duplicate editor font';end if;end loop;
  if jsonb_typeof(c->'fontSizeMin')<>'number'or jsonb_typeof(c->'fontSizeMax')<>'number'then raise exception'Editor font-size range is invalid';end if;
  size_min:=(c->>'fontSizeMin')::numeric;size_max:=(c->>'fontSizeMax')::numeric;
  if size_min<>trunc(size_min)or size_max<>trunc(size_max)or size_min<1 or size_max>72 or size_min>size_max then raise exception'Editor font-size range is invalid';end if;
  legacy_caps:=jsonb_set(jsonb_set(jsonb_set(c,'{fonts}','["Calibri"]'::jsonb),'{fontSizeMin}',to_jsonb(greatest(8,size_min))),'{fontSizeMax}',to_jsonb(greatest(8,size_max)));
 else legacy_caps:=c;end if;
 perform public.assert_word_efficiency_editor_capabilities_before_font_expansion(legacy_caps);
end $function$;

-- Existing tests: allow 1 pt and up too.
update public.word_efficiency_versions
set editor_capabilities = jsonb_set(editor_capabilities, '{fontSizeMin}', '1'::jsonb)
where editor_capabilities->>'schemaVersion' = '2' and (editor_capabilities->>'fontSizeMin')::numeric > 1;

commit;

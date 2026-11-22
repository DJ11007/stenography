-- Excel Efficiency marking: read each cell straight from the sheet (p_doc #> '{cells,A1}') instead of first
-- copying the whole cells object (p_doc->'cells'->'A1') for every single check. A 500-row paper such as
-- Excel Efficiency Test 7 has ~3,500 cell checks per sheet, each of which copied all ~8,000 cells: marking
-- one sheet took 11.5 s (4.4 s for Test 8), close to the 30 s request limit when a whole live-exam batch
-- submits at once. Now 4.7 s (1.3 s for Test 8). The result is identical: re-marking 1,034 saved question
-- scores across Excel Tests 1-10 gave the same marks (the only difference was one mark given by hand).
CREATE OR REPLACE FUNCTION public.excel_efficiency_criterion_matches(p_doc jsonb, p_c jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare kind text := p_c->>'rule'; ref text; cell jsonb; prop record; item jsonb; actual jsonb; source jsonb; keys text[]; k text; first boolean;
 sheet jsonb := coalesce(p_doc->'sheet', '{}'::jsonb); merges jsonb := coalesce(p_doc->'merges', '[]'::jsonb);
begin
 if kind = 'anyOf' then
  for item in select value from jsonb_array_elements(coalesce(p_c->'criteria','[]'::jsonb)) loop if public.excel_efficiency_criterion_matches(p_doc, item) then return true; end if; end loop;
  return false;
 elsif kind = 'allOf' then
  for item in select value from jsonb_array_elements(coalesce(p_c->'criteria','[]'::jsonb)) loop if not public.excel_efficiency_criterion_matches(p_doc, item) then return false; end if; end loop;
  return true;
 elsif kind = 'cells' then
  first := true;
  for ref in select public.excel_efficiency_range_cells(p_c->>'range') loop
   cell := coalesce(p_doc #> array['cells', ref], '{}'::jsonb);
   for prop in select key, value from jsonb_each(coalesce(p_c->'props','{}'::jsonb)) loop
    if not public.excel_efficiency_prop_matches(public.excel_efficiency_cell_prop(cell, prop.key), prop.value) then return false; end if;
   end loop;
   if coalesce((p_c->>'anchor')::boolean, false) then return true; end if;
   first := false;
  end loop;
  return not first;
 elsif kind = 'merged' then
  for item in select value from jsonb_array_elements(coalesce(p_c->'ranges','[]'::jsonb)) loop
   if not exists (select 1 from jsonb_array_elements_text(merges) m where upper(m) = upper(item#>>'{}')) then return false; end if;
  end loop;
  return true;
 elsif kind = 'value' then
  cell := coalesce(p_doc #> array['cells', upper(p_c->>'cell')], '{}'::jsonb);
  -- the answer is judged by its value; how it was made (formula, Flash Fill, typing) does not matter
  actual := cell->'value';
  if jsonb_typeof(actual) = 'string' and actual#>>'{}' ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then actual := to_jsonb((actual#>>'{}')::numeric); end if;
  if coalesce((p_c->>'caseSensitive')::boolean, false) then
   return jsonb_typeof(actual) = 'string' and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_c->'equals') = 'array' then p_c->'equals' else jsonb_build_array(p_c->'equals') end) e where e #>> '{}' = actual #>> '{}');
  end if;
  return public.excel_efficiency_prop_matches(actual, p_c->'equals');
 elsif kind = 'sheet' then
  actual := sheet #> string_to_array(p_c->>'path', '.');
  if actual is null then actual := case p_c->>'path' when 'gridlines' then 'true' when 'headings' then 'true' when 'orientation' then '"portrait"' when 'paperSize' then '"Letter"' when 'name' then '"Sheet1"' when 'protected' then 'false' else 'null' end::jsonb; end if;
  if p_c ? 'equals' then return public.excel_efficiency_prop_matches(actual, p_c->'equals'); end if;
  if p_c ? 'in' then return public.excel_efficiency_prop_matches(case when jsonb_typeof(actual) = 'string' then to_jsonb(replace(actual#>>'{}','$','')) else actual end, p_c->'in'); end if;
  if p_c ? 'includesAll' then return jsonb_typeof(actual) = 'array' and jsonb_typeof(p_c->'includesAll') = 'array' and actual @> (p_c->'includesAll'); end if;
  if p_c ? 'includes' then return jsonb_typeof(actual) = 'array' and actual @> jsonb_build_array(p_c->'includes'); end if;
  if p_c ? 'contains' then return jsonb_typeof(actual) = 'string' and position(lower(p_c->>'contains') in lower(actual#>>'{}')) > 0; end if;
  return false;
 elsif kind = 'sameFormat' then
  source := coalesce(p_doc #> array['cells', upper(p_c->>'source')], '{}'::jsonb);
  keys := coalesce((select array_agg(value) from jsonb_array_elements_text(p_c->'keys')), array['bold','italic','underline','fontColor','fillColor','fontSize','fontFamily','border','align','vAlign']);
  for item in select value from jsonb_array_elements(coalesce(p_c->'targets','[]'::jsonb)) loop
   cell := coalesce(p_doc #> array['cells', upper(item#>>'{}')], '{}'::jsonb);
   foreach k in array keys loop
    if public.excel_efficiency_cell_prop(cell, k) is distinct from public.excel_efficiency_cell_prop(source, k) then return false; end if;
   end loop;
  end loop;
  return true;
 end if;
 return false;
end $function$;

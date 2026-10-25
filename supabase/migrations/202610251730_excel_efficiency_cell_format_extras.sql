-- Excel Efficiency: the Format Cells extras the workspace now has -- text orientation (rotate: -90..90
-- degrees, 255 = vertical text), indent level, strikethrough and decimal places -- are valid in a saved sheet.
begin;

do $mig$
declare def text;
begin
 def := pg_get_functiondef('public.assert_excel_efficiency_cells(jsonb)'::regprocedure);
 if position('''rotate''' in def) > 0 then return; end if;
 if position('''fontSize'',''fontFamily'',''vAlign'',''wrap''])' in def) = 0 then raise exception 'expected cell field list not found'; end if;
 def := replace(def, '''fontSize'',''fontFamily'',''vAlign'',''wrap''])', '''fontSize'',''fontFamily'',''vAlign'',''wrap'',''rotate'',''indent'',''strike'',''decimals''])');
 def := replace(def, '  if cell_value ? ''wrap'' and jsonb_typeof(cell_value->''wrap'') not in (''boolean'',''null'') then raise exception ''Invalid wrap text at %'', cell_ref; end if;',
  '  if cell_value ? ''wrap'' and jsonb_typeof(cell_value->''wrap'') not in (''boolean'',''null'') then raise exception ''Invalid wrap text at %'', cell_ref; end if;
  if cell_value ? ''rotate'' and (jsonb_typeof(cell_value->''rotate'') not in (''number'',''null'') or (jsonb_typeof(cell_value->''rotate'') = ''number'' and not ((cell_value->>''rotate'')::numeric between -90 and 90 or (cell_value->>''rotate'')::numeric = 255))) then raise exception ''Invalid text orientation at %'', cell_ref; end if;
  if cell_value ? ''indent'' and (jsonb_typeof(cell_value->''indent'') not in (''number'',''null'') or (jsonb_typeof(cell_value->''indent'') = ''number'' and (cell_value->>''indent'')::numeric not between 0 and 15)) then raise exception ''Invalid indent at %'', cell_ref; end if;
  if cell_value ? ''strike'' and jsonb_typeof(cell_value->''strike'') not in (''boolean'',''null'') then raise exception ''Invalid strikethrough at %'', cell_ref; end if;
  if cell_value ? ''decimals'' and (jsonb_typeof(cell_value->''decimals'') not in (''number'',''null'') or (jsonb_typeof(cell_value->''decimals'') = ''number'' and (cell_value->>''decimals'')::numeric not between 0 and 10)) then raise exception ''Invalid decimal places at %'', cell_ref; end if;');
 if position('Invalid text orientation' in def) = 0 then raise exception 'wrap check text not found'; end if;
 execute def;
end $mig$;

-- Cell properties the marking can check: the new ones default like a never-touched cell.
create or replace function public.excel_efficiency_cell_prop(p_cell jsonb, p_key text)
returns jsonb language sql immutable set search_path to 'pg_catalog', 'public' as $function$
 select case
  when p_key in ('bold','italic','underline','wrap','strike') then coalesce(case when jsonb_typeof(p_cell->p_key) = 'boolean' then p_cell->p_key end, 'false'::jsonb)
  when p_key = 'fontSize' then coalesce(case when jsonb_typeof(p_cell->'fontSize') = 'number' then p_cell->'fontSize' end, '11'::jsonb)
  when p_key = 'fontFamily' then coalesce(case when jsonb_typeof(p_cell->'fontFamily') = 'string' then p_cell->'fontFamily' end, '"Calibri"'::jsonb)
  when p_key = 'vAlign' then coalesce(case when jsonb_typeof(p_cell->'vAlign') = 'string' then p_cell->'vAlign' end, '"bottom"'::jsonb)
  when p_key in ('rotate','indent') then coalesce(case when jsonb_typeof(p_cell->p_key) = 'number' then p_cell->p_key end, '0'::jsonb)
  when p_key in ('fontColor','fillColor') then case when jsonb_typeof(p_cell->p_key) = 'string' then to_jsonb(upper(p_cell->>p_key)) else 'null'::jsonb end
  else coalesce(p_cell->p_key, 'null'::jsonb) end
$function$;

commit;

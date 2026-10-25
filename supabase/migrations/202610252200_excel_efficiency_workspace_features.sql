-- Excel Efficiency: what the fuller Excel 2013 workspace saves is valid in a sheet, and the marking can check it.
--   cells   comment (Review > New Comment); number formats Accounting, Short Date, Long Date, Time, Text;
--           formulas may use ^ (power) and ? (COUNTIF wildcard)
--   sheet   name (renamed sheet tab), freeze (Freeze Panes: the top-left unfrozen cell), filter (AutoFilter range)
--           and filterHidden (values hidden per column), protected (Protect Sheet), printTitleRows/printTitleCols
--           (Print Titles), conditionalFormats, charts, hiddenRows/hiddenCols, colWidths/rowHeights
-- Marking: a sheet criterion defaults name to "Sheet1" and protected to false, and "includes" checks that a list
-- (charts, conditionalFormats) has an item with the given fields.
begin;

do $mig$
declare def text;
begin
 -- ---------- cells ----------
 def := pg_get_functiondef('public.assert_excel_efficiency_cells(jsonb)'::regprocedure);
 if position('Invalid comment' in def) = 0 then
  if position('''rotate'',''indent'',''strike'',''decimals''])' in def) = 0 then raise exception 'cell field list not found'; end if;
  def := replace(def, '''rotate'',''indent'',''strike'',''decimals''])', '''rotate'',''indent'',''strike'',''decimals'',''comment''])');
  if position('not in (''General'',''Number'',''Currency'',''Percentage'')' in def) = 0 then raise exception 'number format list not found'; end if;
  def := replace(def, 'not in (''General'',''Number'',''Currency'',''Percentage'')', 'not in (''General'',''Number'',''Currency'',''Accounting'',''ShortDate'',''LongDate'',''Time'',''Percentage'',''Text'')');
  if position('&%]{0,200}' in def) = 0 then raise exception 'formula pattern not found'; end if;
  def := replace(def, '&%]{0,200}', '&%^?]{0,200}');
  if position(E' end loop;\nend $function$' in def) = 0 then raise exception 'cell loop end not found'; end if;
  def := replace(def, E' end loop;\nend $function$', E'  if cell_value ? ''comment'' and (jsonb_typeof(cell_value->''comment'') not in (''string'',''null'') or length(coalesce(cell_value->>''comment'','''')) > 500) then raise exception ''Invalid comment at %'', cell_ref; end if;\n end loop;\nend $function$');
  execute def;
 end if;

 -- ---------- sheet settings ----------
 def := pg_get_functiondef('public.assert_excel_efficiency_document_schema(jsonb)'::regprocedure);
 if position('Invalid sheet name' in def) = 0 then
  if position('length(s::text) > 4000' in def) = 0 then raise exception 'sheet size check not found'; end if;
  def := replace(def, 'length(s::text) > 4000', 'length(s::text) > 20000');
  if position('''header'',''footer'',''zoom''])' in def) = 0 then raise exception 'sheet key list not found'; end if;
  def := replace(def, '''header'',''footer'',''zoom''])', '''header'',''footer'',''zoom'',''name'',''freeze'',''filter'',''filterHidden'',''protected'',''printTitleRows'',''printTitleCols'',''conditionalFormats'',''charts'',''hiddenRows'',''hiddenCols'',''colWidths'',''rowHeights''])');
  if position('  for item in select value from jsonb_each(s) e where e.key in (''header'',''footer'') loop' in def) = 0 then raise exception 'header loop not found'; end if;
  def := replace(def, '  for item in select value from jsonb_each(s) e where e.key in (''header'',''footer'') loop', $chk$  if s ? 'name' and (jsonb_typeof(s->'name') <> 'string' or length(s->>'name') not between 1 and 31 or s->>'name' ~ '[]*?/:\\[]') then raise exception 'Invalid sheet name'; end if;
  if s ? 'freeze' and jsonb_typeof(s->'freeze') <> 'null' and (jsonb_typeof(s->'freeze') <> 'string' or s->>'freeze' !~ '^[A-Z]{1,2}[0-9]{1,3}$') then raise exception 'Invalid freeze panes'; end if;
  if s ? 'filter' and jsonb_typeof(s->'filter') <> 'null' and (jsonb_typeof(s->'filter') <> 'string' or s->>'filter' !~ '^[A-Z]{1,2}[0-9]{1,3}:[A-Z]{1,2}[0-9]{1,3}$') then raise exception 'Invalid filter range'; end if;
  if s ? 'filterHidden' and (jsonb_typeof(s->'filterHidden') <> 'object' or exists (select 1 from jsonb_each(s->'filterHidden') f where f.key !~ '^[A-Z]{1,2}$' or jsonb_typeof(f.value) <> 'array' or jsonb_array_length(f.value) > 200)) then raise exception 'Invalid filter'; end if;
  if s ? 'protected' and jsonb_typeof(s->'protected') <> 'boolean' then raise exception 'Invalid sheet protection'; end if;
  if s ? 'printTitleRows' and jsonb_typeof(s->'printTitleRows') <> 'null' and (jsonb_typeof(s->'printTitleRows') <> 'string' or s->>'printTitleRows' !~ '^\$?[0-9]{1,3}:\$?[0-9]{1,3}$') then raise exception 'Invalid print titles'; end if;
  if s ? 'printTitleCols' and jsonb_typeof(s->'printTitleCols') <> 'null' and (jsonb_typeof(s->'printTitleCols') <> 'string' or s->>'printTitleCols' !~ '^\$?[A-Z]{1,2}:\$?[A-Z]{1,2}$') then raise exception 'Invalid print titles'; end if;
  if s ? 'conditionalFormats' and (jsonb_typeof(s->'conditionalFormats') <> 'array' or jsonb_array_length(s->'conditionalFormats') > 50 or exists (select 1 from jsonb_array_elements(s->'conditionalFormats') c where jsonb_typeof(c) <> 'object'
     or exists (select 1 from jsonb_object_keys(c) k where k not in ('range','type','value','value2','style'))
     or c->>'range' !~ '^[A-Z]{1,2}[0-9]{1,3}(:[A-Z]{1,2}[0-9]{1,3})?$'
     or c->>'type' not in ('greaterThan','lessThan','between','equalTo','textContains','duplicate','unique')
     or c->>'style' not in ('lightRedDarkRed','yellowDarkYellow','greenDarkGreen','lightRed','redText','redBorder')
     or (c ? 'value' and jsonb_typeof(c->'value') not in ('string','number')) or (c ? 'value2' and jsonb_typeof(c->'value2') not in ('string','number'))
     or length(coalesce(c->>'value','')) > 255 or length(coalesce(c->>'value2','')) > 255)) then raise exception 'Invalid conditional formatting'; end if;
  if s ? 'charts' and (jsonb_typeof(s->'charts') <> 'array' or jsonb_array_length(s->'charts') > 10 or exists (select 1 from jsonb_array_elements(s->'charts') c where jsonb_typeof(c) <> 'object'
     or exists (select 1 from jsonb_object_keys(c) k where k not in ('id','type','range','title','anchor'))
     or c->>'type' not in ('column','bar','line','pie') or c->>'range' !~ '^[A-Z]{1,2}[0-9]{1,3}:[A-Z]{1,2}[0-9]{1,3}$'
     or c->>'anchor' !~ '^[A-Z]{1,2}[0-9]{1,3}$' or jsonb_typeof(c->'title') <> 'string' or length(c->>'title') > 255 or length(coalesce(c->>'id','')) > 40)) then raise exception 'Invalid chart'; end if;
  if s ? 'hiddenRows' and (jsonb_typeof(s->'hiddenRows') <> 'array' or jsonb_array_length(s->'hiddenRows') > 200 or exists (select 1 from jsonb_array_elements(s->'hiddenRows') r where jsonb_typeof(r) <> 'number' or (r#>>'{}')::numeric not between 1 and 200)) then raise exception 'Invalid hidden rows'; end if;
  if s ? 'hiddenCols' and (jsonb_typeof(s->'hiddenCols') <> 'array' or jsonb_array_length(s->'hiddenCols') > 26 or exists (select 1 from jsonb_array_elements(s->'hiddenCols') r where jsonb_typeof(r) <> 'number' or (r#>>'{}')::numeric not between 0 and 25)) then raise exception 'Invalid hidden columns'; end if;
  if s ? 'colWidths' and (jsonb_typeof(s->'colWidths') <> 'object' or exists (select 1 from jsonb_each(s->'colWidths') w where w.key !~ '^[A-Z]{1,2}$' or jsonb_typeof(w.value) <> 'number' or (w.value#>>'{}')::numeric not between 0 and 255)) then raise exception 'Invalid column widths'; end if;
  if s ? 'rowHeights' and (jsonb_typeof(s->'rowHeights') <> 'object' or exists (select 1 from jsonb_each(s->'rowHeights') h where h.key !~ '^[0-9]{1,3}$' or jsonb_typeof(h.value) <> 'number' or (h.value#>>'{}')::numeric not between 0 and 409)) then raise exception 'Invalid row heights'; end if;
  for item in select value from jsonb_each(s) e where e.key in ('header','footer') loop$chk$);
  execute def;
 end if;

 -- ---------- marking ----------
 def := pg_get_functiondef('public.excel_efficiency_criterion_matches(jsonb,jsonb)'::regprocedure);
 if position('''includes''' in def) = 0 then
  if position('when ''paperSize'' then ''"Letter"'' else' in def) = 0 then raise exception 'sheet defaults not found'; end if;
  def := replace(def, 'when ''paperSize'' then ''"Letter"'' else', 'when ''paperSize'' then ''"Letter"'' when ''name'' then ''"Sheet1"'' when ''protected'' then ''false'' else');
  if position('  if p_c ? ''contains'' then return jsonb_typeof(actual) = ''string''' in def) = 0 then raise exception 'contains check not found'; end if;
  def := replace(def, '  if p_c ? ''contains'' then return jsonb_typeof(actual) = ''string''', '  if p_c ? ''includes'' then return jsonb_typeof(actual) = ''array'' and actual @> jsonb_build_array(p_c->''includes''); end if;
  if p_c ? ''contains'' then return jsonb_typeof(actual) = ''string''');
  execute def;
 end if;
end $mig$;

commit;

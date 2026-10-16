begin;

-- Word Efficiency: Word 2013 Table Properties, Table Options and Cell Options.
--
-- A table now also saves: preferred width (tableWidth + tableWidthUnit cm|pct),
-- indent from left (tableIndent), text wrapping Around (tableWrap), spacing
-- between cells (cellSpacing), "Row height is: Exactly" per row
-- (rowHeightRules) and "Allow row to break across pages" off per row
-- (rowCantSplit), and Alt Text (tableTitle, tableDescription). A cell can save its own margins (padTop/padBottom/padLeft/
-- padRight), Wrap text off (noWrap) and Fit text (fitText). Each is a separate
-- gradable field. See lib/word-table-model.ts.
--
-- Same layering as 202610152100: the new table settings are checked here,
-- removed, and the document is handed to the previous check. The cell-format
-- check gains the new cell keys. Safe to run more than once.

do $$
begin
 if not exists(select 1 from pg_proc where proname='assert_word_efficiency_document_schema_before_table_props' and pronamespace='public'::regnamespace) then
  alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_table_props;
 end if;
end $$;

create or replace function public.word_efficiency_valid_cell_format(cell jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
declare key_name text;item jsonb;
begin
 if cell is null or cell='null'::jsonb then return true;end if;
 if jsonb_typeof(cell)<>'object' then return false;end if;
 for key_name,item in select key,value from jsonb_each(cell) loop
  if key_name not in('fontSize','fontFamily','bold','italic','underline','strike','doubleStrike','color','highlight','align','valign','rowspan','colspan','merged','shading','borderTop','borderRight','borderBottom','borderLeft','borderDiagonal','textDirection','padTop','padBottom','padLeft','padRight','noWrap','fitText') then return false;end if;
  if key_name='fontSize' and(jsonb_typeof(item)<>'number' or(item#>>'{}')::numeric not between 1 and 1638) then return false;end if;
  if key_name='fontFamily' and(jsonb_typeof(item)<>'string' or char_length(item#>>'{}')>100) then return false;end if;
  if key_name in('color','highlight','shading') and(jsonb_typeof(item)<>'string' or(item#>>'{}')!~'^[0-9A-Fa-f]{6}$') then return false;end if;
  if key_name='align' and(jsonb_typeof(item)<>'string' or(item#>>'{}')not in('left','center','right','justify')) then return false;end if;
  if key_name='valign' and(jsonb_typeof(item)<>'string' or(item#>>'{}')not in('top','middle','bottom')) then return false;end if;
  if key_name in('bold','italic','underline','strike','doubleStrike','merged','noWrap','fitText') and jsonb_typeof(item)<>'boolean' then return false;end if;
  if key_name='rowspan' and(jsonb_typeof(item)<>'number' or(item#>>'{}')::numeric<>trunc((item#>>'{}')::numeric) or(item#>>'{}')::numeric not between 1 and 50) then return false;end if;
  if key_name='colspan' and(jsonb_typeof(item)<>'number' or(item#>>'{}')::numeric<>trunc((item#>>'{}')::numeric) or(item#>>'{}')::numeric not between 1 and 20) then return false;end if;
  if key_name in('borderTop','borderRight','borderBottom','borderLeft') and(jsonb_typeof(item)<>'string' or(item#>>'{}')!~*'^(none|(solid|double|dotted|dashed) (0\.25|0\.5|0\.75|1|1\.5|2\.25|3|4\.5|6) [0-9A-F]{6})$') then return false;end if;
  if key_name='borderDiagonal' and(jsonb_typeof(item)<>'string' or(item#>>'{}')!~*'^(down|up) (solid|double|dotted|dashed) (0\.25|0\.5|0\.75|1|1\.5|2\.25|3|4\.5|6) [0-9A-F]{6}$') then return false;end if;
  if key_name='textDirection' and(jsonb_typeof(item)<>'string' or(item#>>'{}')not in('down','up')) then return false;end if;
  if key_name in('padTop','padBottom','padLeft','padRight') and(jsonb_typeof(item)<>'number' or(item#>>'{}')::numeric not between 0 and 10) then return false;end if;
 end loop;
 return true;
end $$;

create or replace function public.word_efficiency_valid_row_flags(list jsonb,max_length integer,allowed jsonb)
returns boolean language sql immutable set search_path=pg_catalog,public as $$
 select jsonb_typeof(list)='array' and jsonb_array_length(list)<=max_length and not exists(
  select 1 from jsonb_array_elements(list) as items(item) where not(items.item='null'::jsonb or items.item=allowed))
$$;

create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare block_value jsonb;settings jsonb;safe_document jsonb;row_count integer;
begin
 if document_snapshot->>'schemaVersion'<>'2' or jsonb_typeof(document_snapshot->'blocks')<>'array' then
  perform public.assert_word_efficiency_document_schema_before_table_props(document_snapshot,editor_capabilities);return;
 end if;
 for block_value in select value from jsonb_array_elements(document_snapshot->'blocks') loop
  if block_value->>'type'='table' and jsonb_typeof(block_value->'attrs')='object' then
   settings:=block_value->'attrs';
   if settings?'tableWidthUnit' and(settings->>'tableWidthUnit')not in('cm','pct') then raise exception'Invalid table width unit';end if;
   if settings?'tableWidth' and(jsonb_typeof(settings->'tableWidth')<>'number' or(settings->>'tableWidth')::numeric<0.1 or(settings->>'tableWidth')::numeric>case when settings->>'tableWidthUnit'='pct' then 100 else 60 end) then raise exception'Invalid table width';end if;
   if settings?'tableIndent' and(jsonb_typeof(settings->'tableIndent')<>'number' or(settings->>'tableIndent')::numeric not between -20 and 20) then raise exception'Invalid table indent';end if;
   if settings?'tableWrap' and settings->'tableWrap'<>'"around"'::jsonb then raise exception'Invalid table text wrapping';end if;
   if settings?'cellSpacing' and(jsonb_typeof(settings->'cellSpacing')<>'number' or(settings->>'cellSpacing')::numeric not between 0 and 5) then raise exception'Invalid cell spacing';end if;
   row_count:=case when jsonb_typeof(settings->'rows')='array' then jsonb_array_length(settings->'rows') else 0 end;
   if settings?'rowHeightRules' and not public.word_efficiency_valid_row_flags(settings->'rowHeightRules',row_count,'"exactly"'::jsonb) then raise exception'Invalid row height rules';end if;
   if settings?'rowCantSplit' and not public.word_efficiency_valid_row_flags(settings->'rowCantSplit',row_count,'true'::jsonb) then raise exception'Invalid row break settings';end if;
   if settings?'tableTitle' and(jsonb_typeof(settings->'tableTitle')<>'string' or char_length(settings->>'tableTitle')>255) then raise exception'Invalid table alt text title';end if;
   if settings?'tableDescription' and(jsonb_typeof(settings->'tableDescription')<>'string' or char_length(settings->>'tableDescription')>2000) then raise exception'Invalid table alt text description';end if;
  end if;
 end loop;
 -- Hand the document on without these settings (coalesce: jsonb_agg over zero blocks is NULL, not []).
 select jsonb_set(document_snapshot,'{blocks}',coalesce(jsonb_agg(case when blocks.block_item->>'type'='table' and jsonb_typeof(blocks.block_item->'attrs')='object' then jsonb_set(blocks.block_item,'{attrs}',(blocks.block_item->'attrs')-array['tableWidth','tableWidthUnit','tableIndent','tableWrap','cellSpacing','rowHeightRules','rowCantSplit','tableTitle','tableDescription']) else blocks.block_item end order by blocks.block_ordinality),'[]'::jsonb))
  into safe_document from jsonb_array_elements(document_snapshot->'blocks') with ordinality as blocks(block_item,block_ordinality);
 perform public.assert_word_efficiency_document_schema_before_table_props(safe_document,editor_capabilities);
end $$;

revoke all on function public.assert_word_efficiency_document_schema_before_table_props(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb),public.word_efficiency_valid_cell_format(jsonb),public.word_efficiency_valid_row_flags(jsonb,integer,jsonb) from public,anon,authenticated;

commit;

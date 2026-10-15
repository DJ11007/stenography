begin;

-- Word Efficiency: Word 2013 Table Tools (Design + Layout tabs).
--
-- A table now also saves its Table Tools settings (style, style options,
-- repeat header rows, alignment, cell margins, row heights, column widths) as
-- flat attrs, and each cell's merge (rowspan/colspan, merged), shading,
-- borders, diagonal border and text direction in attrs.cellFormats -- each a
-- separate field the Model Answer page can grade. See lib/word-table-model.ts.
--
-- Same layering as every earlier document-schema extension: the new table
-- settings are checked here, removed, and the document is handed to the
-- previous check (which still checks rows and cellFormats). The cell-format
-- check function gains the new keys. Safe to run more than once.

do $$
begin
 if not exists(select 1 from pg_proc where proname='assert_word_efficiency_document_schema_before_table_tools' and pronamespace='public'::regnamespace) then
  alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_table_tools;
 end if;
end $$;

create or replace function public.word_efficiency_valid_cell_format(cell jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
declare key_name text;item jsonb;
begin
 if cell is null or cell='null'::jsonb then return true;end if;
 if jsonb_typeof(cell)<>'object' then return false;end if;
 for key_name,item in select key,value from jsonb_each(cell) loop
  if key_name not in('fontSize','fontFamily','bold','italic','underline','strike','doubleStrike','color','highlight','align','valign','rowspan','colspan','merged','shading','borderTop','borderRight','borderBottom','borderLeft','borderDiagonal','textDirection') then return false;end if;
  if key_name='fontSize' and(jsonb_typeof(item)<>'number' or(item#>>'{}')::numeric not between 1 and 1638) then return false;end if;
  if key_name='fontFamily' and(jsonb_typeof(item)<>'string' or char_length(item#>>'{}')>100) then return false;end if;
  if key_name in('color','highlight','shading') and(jsonb_typeof(item)<>'string' or(item#>>'{}')!~'^[0-9A-Fa-f]{6}$') then return false;end if;
  if key_name='align' and(jsonb_typeof(item)<>'string' or(item#>>'{}')not in('left','center','right','justify')) then return false;end if;
  if key_name='valign' and(jsonb_typeof(item)<>'string' or(item#>>'{}')not in('top','middle','bottom')) then return false;end if;
  if key_name in('bold','italic','underline','strike','doubleStrike','merged') and jsonb_typeof(item)<>'boolean' then return false;end if;
  if key_name='rowspan' and(jsonb_typeof(item)<>'number' or(item#>>'{}')::numeric<>trunc((item#>>'{}')::numeric) or(item#>>'{}')::numeric not between 1 and 50) then return false;end if;
  if key_name='colspan' and(jsonb_typeof(item)<>'number' or(item#>>'{}')::numeric<>trunc((item#>>'{}')::numeric) or(item#>>'{}')::numeric not between 1 and 20) then return false;end if;
  if key_name in('borderTop','borderRight','borderBottom','borderLeft') and(jsonb_typeof(item)<>'string' or(item#>>'{}')!~*'^(none|(solid|double|dotted|dashed) (0\.25|0\.5|0\.75|1|1\.5|2\.25|3|4\.5|6) [0-9A-F]{6})$') then return false;end if;
  if key_name='borderDiagonal' and(jsonb_typeof(item)<>'string' or(item#>>'{}')!~*'^(down|up) (solid|double|dotted|dashed) (0\.25|0\.5|0\.75|1|1\.5|2\.25|3|4\.5|6) [0-9A-F]{6}$') then return false;end if;
  if key_name='textDirection' and(jsonb_typeof(item)<>'string' or(item#>>'{}')not in('down','up')) then return false;end if;
 end loop;
 return true;
end $$;

create or replace function public.word_efficiency_valid_table_sizes(list jsonb,max_length integer,max_value numeric)
returns boolean language sql immutable set search_path=pg_catalog,public as $$
 select jsonb_typeof(list)='array' and jsonb_array_length(list)<=max_length and not exists(
  select 1 from jsonb_array_elements(list) as items(item)
  where not(items.item='null'::jsonb or(jsonb_typeof(items.item)='number' and(items.item#>>'{}')::numeric between 0.1 and max_value)))
$$;

create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare block_value jsonb;settings jsonb;safe_document jsonb;key_name text;row_count integer;col_count integer;
begin
 if document_snapshot->>'schemaVersion'<>'2' or jsonb_typeof(document_snapshot->'blocks')<>'array' then
  perform public.assert_word_efficiency_document_schema_before_table_tools(document_snapshot,editor_capabilities);return;
 end if;
 for block_value in select value from jsonb_array_elements(document_snapshot->'blocks') loop
  if block_value->>'type'='table' and jsonb_typeof(block_value->'attrs')='object' then
   settings:=block_value->'attrs';
   if settings?'tableStyle' and(settings->>'tableStyle')not in('table-grid','plain-1','plain-2','plain-3','plain-4','plain-5','grid-1-light','grid-4-accent-1','grid-5-dark-accent-1','grid-6-colorful-accent-1','list-3-accent-1','list-4-accent-2') then raise exception'Invalid table style';end if;
   foreach key_name in array array['headerRow','totalRow','bandedRows','firstColumn','lastColumn','bandedColumns','repeatHeader'] loop
    if settings?key_name and jsonb_typeof(settings->key_name)<>'boolean' then raise exception'Invalid table setting %',key_name;end if;
   end loop;
   if settings?'tableAlign' and(settings->>'tableAlign')not in('left','center','right') then raise exception'Invalid table alignment';end if;
   foreach key_name in array array['cellMarginTop','cellMarginBottom','cellMarginLeft','cellMarginRight'] loop
    if settings?key_name and(jsonb_typeof(settings->key_name)<>'number' or(settings->>key_name)::numeric not between 0 and 10) then raise exception'Invalid table cell margin';end if;
   end loop;
   row_count:=case when jsonb_typeof(settings->'rows')='array' then jsonb_array_length(settings->'rows') else 0 end;
   col_count:=coalesce((select max(case when jsonb_typeof(row_item)='array' then jsonb_array_length(row_item) else 0 end) from jsonb_array_elements(case when jsonb_typeof(settings->'rows')='array' then settings->'rows' else '[]'::jsonb end) as table_rows(row_item)),0);
   if settings?'rowHeights' and not public.word_efficiency_valid_table_sizes(settings->'rowHeights',row_count,50) then raise exception'Invalid table row heights';end if;
   if settings?'colWidths' and not public.word_efficiency_valid_table_sizes(settings->'colWidths',col_count,60) then raise exception'Invalid table column widths';end if;
  end if;
 end loop;
 -- Hand the document on without the Table Tools settings (coalesce: jsonb_agg over zero blocks is NULL, not []).
 select jsonb_set(document_snapshot,'{blocks}',coalesce(jsonb_agg(case when blocks.block_item->>'type'='table' and jsonb_typeof(blocks.block_item->'attrs')='object' then jsonb_set(blocks.block_item,'{attrs}',(blocks.block_item->'attrs')-array['tableStyle','headerRow','totalRow','bandedRows','firstColumn','lastColumn','bandedColumns','repeatHeader','tableAlign','cellMarginTop','cellMarginBottom','cellMarginLeft','cellMarginRight','rowHeights','colWidths']) else blocks.block_item end order by blocks.block_ordinality),'[]'::jsonb))
  into safe_document from jsonb_array_elements(document_snapshot->'blocks') with ordinality as blocks(block_item,block_ordinality);
 perform public.assert_word_efficiency_document_schema_before_table_tools(safe_document,editor_capabilities);
end $$;

revoke all on function public.assert_word_efficiency_document_schema_before_table_tools(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb),public.word_efficiency_valid_cell_format(jsonb),public.word_efficiency_valid_table_sizes(jsonb,integer,numeric) from public,anon,authenticated;

commit;

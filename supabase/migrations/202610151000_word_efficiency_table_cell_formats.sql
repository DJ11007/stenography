begin;

-- Word Efficiency: table cells keep their formatting.
--
-- EFFICIENCY TEST 2's Q5 asks students to format a table (font size of the
-- first column, Top Centre alignment of a row, double strikethrough on a row).
-- A saved table kept only each cell's text (attrs.rows), so table formatting
-- was lost on submit and could never be graded. The editor now also saves
-- attrs.cellFormats -- one entry per cell, the same shape as attrs.rows -- and
-- the Model Answer page builds grading rules from it
-- (blocks.<n>.attrs.cellFormats.<row>.<col>.<field>).
--
-- Same layering as every earlier document-schema extension: the new field is
-- checked here, removed, and the document is handed to the previous check.
-- Safe to run more than once.

do $$
begin
 if not exists(select 1 from pg_proc where proname='assert_word_efficiency_document_schema_before_cell_formats' and pronamespace='public'::regnamespace) then
  alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_cell_formats;
 end if;
end $$;

create or replace function public.word_efficiency_valid_cell_format(cell jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
declare key_name text;item jsonb;
begin
 if cell is null or cell='null'::jsonb then return true;end if;
 if jsonb_typeof(cell)<>'object' then return false;end if;
 for key_name,item in select key,value from jsonb_each(cell) loop
  if key_name not in('fontSize','fontFamily','bold','italic','underline','strike','doubleStrike','color','highlight','align','valign') then return false;end if;
  if key_name='fontSize' and(jsonb_typeof(item)<>'number' or(item#>>'{}')::numeric not between 1 and 400) then return false;end if;
  if key_name='fontFamily' and(jsonb_typeof(item)<>'string' or char_length(item#>>'{}')>100) then return false;end if;
  if key_name in('color','highlight') and(jsonb_typeof(item)<>'string' or(item#>>'{}')!~'^[0-9A-Fa-f]{6}$') then return false;end if;
  if key_name='align' and(jsonb_typeof(item)<>'string' or(item#>>'{}')not in('left','center','right','justify')) then return false;end if;
  if key_name='valign' and(jsonb_typeof(item)<>'string' or(item#>>'{}')not in('top','middle','bottom')) then return false;end if;
  if key_name in('bold','italic','underline','strike','doubleStrike') and jsonb_typeof(item)<>'boolean' then return false;end if;
 end loop;
 return true;
end $$;

create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare block_value jsonb;formats jsonb;row_index integer;safe_document jsonb;
begin
 if document_snapshot->>'schemaVersion'<>'2' or jsonb_typeof(document_snapshot->'blocks')<>'array' then
  perform public.assert_word_efficiency_document_schema_before_cell_formats(document_snapshot,editor_capabilities);return;
 end if;
 for block_value in select value from jsonb_array_elements(document_snapshot->'blocks') loop
  if block_value->>'type'='table' and block_value->'attrs'?'cellFormats' then
   formats:=block_value#>'{attrs,cellFormats}';
   if jsonb_typeof(formats)<>'array' or jsonb_typeof(block_value#>'{attrs,rows}')<>'array' or jsonb_array_length(formats)<>jsonb_array_length(block_value#>'{attrs,rows}') then raise exception'Invalid table cell formatting';end if;
   for row_index in 0..jsonb_array_length(formats)-1 loop
    if jsonb_typeof(formats->row_index)<>'array' or jsonb_array_length(formats->row_index)<>jsonb_array_length(block_value#>array['attrs','rows',row_index::text]) then raise exception'Invalid table cell formatting';end if;
    if exists(select 1 from jsonb_array_elements(formats->row_index) as cells(cell) where not public.word_efficiency_valid_cell_format(cells.cell)) then raise exception'Invalid table cell formatting';end if;
   end loop;
  end if;
 end loop;
 -- Hand the document on without cellFormats (coalesce: jsonb_agg over zero blocks is NULL, not []).
 select jsonb_set(document_snapshot,'{blocks}',coalesce(jsonb_agg(case when blocks.block_item->>'type'='table' and jsonb_typeof(blocks.block_item->'attrs')='object' then jsonb_set(blocks.block_item,'{attrs}',(blocks.block_item->'attrs')-'cellFormats') else blocks.block_item end order by blocks.block_ordinality),'[]'::jsonb))
  into safe_document from jsonb_array_elements(document_snapshot->'blocks') with ordinality as blocks(block_item,block_ordinality);
 perform public.assert_word_efficiency_document_schema_before_cell_formats(safe_document,editor_capabilities);
end $$;

revoke all on function public.assert_word_efficiency_document_schema_before_cell_formats(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb),public.word_efficiency_valid_cell_format(jsonb) from public,anon,authenticated;

commit;

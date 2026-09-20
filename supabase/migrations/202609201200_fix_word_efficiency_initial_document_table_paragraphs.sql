begin;

-- Real reported bug: starting a Word Efficiency test whose Working Matter
-- contains a table paragraph ("cannot extract elements from a scalar")
-- failed at Start Test, before a student could even reach the workspace --
-- word_efficiency_initial_editor_document (202608240008) never special-
-- cased type='table' working-matter paragraphs (which only ever carry
-- 'rows', never 'runs'): it built EVERY paragraph as if it were a plain
-- 'paragraph'/'list-item', so a table's missing 'runs' key silently became
-- a JSON null in the converted block. assert_word_efficiency_document_schema
-- only skips its runs check for blocks whose type is genuinely 'table' --
-- since this bogus block was mislabeled 'paragraph', it fell into the
-- non-table branch and called jsonb_array_elements() on that null 'runs',
-- which is exactly what that Postgres error means. Table blocks now get
-- type='table' (so the schema validator's own table branch handles them,
-- which never inspects 'runs' at all) and attrs.rows carries the actual
-- cell grid, matching exactly what a real student-edited table block
-- looks like (see rich-document-editor.tsx's makeBlock/enrichBlock).
-- 'runs' carries one real run (the table's own cell text, flattened --
-- same approach lib/word-docx.ts's convertWorkingMatterToEditorDocument
-- already uses for the realfile-upload path) rather than an empty array.
-- Confirmed live (reproduced against a real test's stored Working Matter):
-- an empty runs array reaches assert_word_efficiency_document_schema's own
-- outline/emboss cleanup pass, which rebuilds 'runs' via
-- jsonb_agg(...)-over-jsonb_array_elements(old runs) -- jsonb_agg over
-- ZERO input rows returns SQL NULL, not '[]', which jsonb_set then writes
-- into the block as a genuine JSON null, and the very next validation
-- pass's jsonb_set on that now-null "block" is exactly what throws
-- "cannot set path in scalar". A non-empty runs array (built with
-- jsonb_build_array, never an aggregate) can never trigger that collapse.
create or replace function public.word_efficiency_initial_editor_document(m jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare editor_blocks jsonb;
begin
 if jsonb_typeof(m->'paragraphs')<>'array'then
  if m->>'schemaVersion'='2'and jsonb_typeof(m->'blocks')='array'then return m;end if;
  raise exception'Attempt original document cannot be converted';
 end if;
 select jsonb_agg(
  case when paragraph_entries.paragraph_value->>'type'='table' then jsonb_build_object(
   'id','block-'||(paragraph_entries.ordinality-1),
   'type','table',
   'alignment','left',
   'runs',jsonb_build_array(jsonb_build_object(
    'text',coalesce((select string_agg(cell_entries.cell_value#>>'{}',' 'order by row_entries.row_ordinality,cell_entries.cell_ordinality)from jsonb_array_elements(coalesce(paragraph_entries.paragraph_value->'rows','[]'::jsonb))with ordinality as row_entries(row_value,row_ordinality),jsonb_array_elements(row_entries.row_value)with ordinality as cell_entries(cell_value,cell_ordinality)),''),
    'bold',false,'italic',false,'underline',false,'strike',false,'superscript',false,'subscript',false,'fontFamily',null,'fontSize',null,'color',null,'highlight',null,'doubleStrike',false,'href',null,'bookmark',null,'field',null
   )),
   'attrs',jsonb_build_object('rows',coalesce(paragraph_entries.paragraph_value->'rows','[]'::jsonb))
  ) else jsonb_build_object(
   'id','block-'||(paragraph_entries.ordinality-1),
   'type',case when paragraph_entries.paragraph_value->>'type'='list-item'then'list-item'else'paragraph'end,
   'alignment',coalesce(paragraph_entries.paragraph_value->>'alignment','left'),
   'runs',(select jsonb_agg(jsonb_build_object(
    'text',run_entries.run_value->>'text','bold',coalesce((run_entries.run_value->>'bold')::boolean,false),'italic',coalesce((run_entries.run_value->>'italic')::boolean,false),'underline',coalesce((run_entries.run_value->>'underline')::boolean,false),'strike',coalesce((run_entries.run_value->>'strike')::boolean,false),'superscript',false,'subscript',false,'fontFamily',run_entries.run_value->'fontFamily','fontSize',run_entries.run_value->'fontSize','color',run_entries.run_value->'color','highlight',run_entries.run_value->'highlight','doubleStrike',false,'href',null,'bookmark',null,'field',null
   )order by run_entries.ordinality)from jsonb_array_elements(paragraph_entries.paragraph_value->'runs')with ordinality as run_entries(run_value,ordinality)),
   'attrs',case when paragraph_entries.paragraph_value->>'type'='list-item'then jsonb_build_object('listStyle','bullet')else jsonb_build_object(
    'marginLeft',coalesce(paragraph_entries.paragraph_value->>'leftIndent','0')||'in','marginRight',coalesce(paragraph_entries.paragraph_value->>'rightIndent','0')||'in','lineHeight',coalesce(paragraph_entries.paragraph_value->>'lineSpacing','1'),'marginTop',coalesce(paragraph_entries.paragraph_value->>'spaceBefore','0')||'pt','marginBottom',coalesce(paragraph_entries.paragraph_value->>'spaceAfter','0')||'pt','lineNumbers',false,'dropCap',false
   )end
  )end
 order by paragraph_entries.ordinality)into editor_blocks from jsonb_array_elements(m->'paragraphs')with ordinality as paragraph_entries(paragraph_value,ordinality);
 return jsonb_build_object('schemaVersion','2','blocks',editor_blocks,'pageLayout',jsonb_build_object('padding',null,'maxWidth',null,'aspectRatio',null,'columnCount',null,'backgroundColor',null,'border',null,'watermark',null),'operations','[]'::jsonb,'savedAt','1970-01-01T00:00:00.000Z');
end $$;

commit;

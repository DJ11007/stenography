begin;

-- Word Efficiency: Drop Cap on a numbered or bulleted paragraph.
--
-- The editor saves a drop cap as the paragraph's dropCap / dropCapLines / dropCapDistance / dropCapMargin
-- attributes, for a plain paragraph and for a list item alike (lib/word-editor-document.ts allows both).
-- The database only knew them on a plain paragraph: the drop-cap layer (202608310045) checks and strips
-- them there, and the base check refuses any of them on a list item ("Unknown block attribute"). So a drop
-- cap on a numbered paragraph -- Hindi EFFICIENCY TEST 4 Q15, paragraph 4 after Q2 numbers every
-- paragraph -- made every save and the final submit fail with "Save failed".
--
-- Same layering as the earlier expansions: a list item's drop cap attributes are checked here, then
-- removed before the previous check runs; the document is stored as sent. Safe to run more than once.

do $$
begin
 if not exists(select 1 from pg_proc where proname='assert_word_efficiency_document_schema_before_list_drop_cap' and pronamespace='public'::regnamespace) then
  alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_list_drop_cap;
 end if;
end $$;

create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare blocks jsonb:='[]'::jsonb;block jsonb;attrs jsonb;
begin
 if jsonb_typeof(document_snapshot->'blocks')='array' then
  for block in select value from jsonb_array_elements(document_snapshot->'blocks') loop
   attrs:=block->'attrs';
   if block->>'type'='list-item' and jsonb_typeof(attrs)='object' then
    if attrs?'dropCap' and jsonb_typeof(attrs->'dropCap')<>'boolean' then raise exception'Invalid dropCap attribute';end if;
    if attrs?'dropCapMargin' and jsonb_typeof(attrs->'dropCapMargin')<>'boolean' then raise exception'Invalid drop cap margin flag';end if;
    if attrs?'dropCapLines' and not(jsonb_typeof(attrs->'dropCapLines')='number' and (attrs->>'dropCapLines')::numeric between 1 and 10) then raise exception'Invalid drop cap lines';end if;
    if attrs?'dropCapDistance' and not(jsonb_typeof(attrs->'dropCapDistance')='number' and (attrs->>'dropCapDistance')::numeric between 0 and 2) then raise exception'Invalid drop cap distance';end if;
    block:=jsonb_set(block,'{attrs}',attrs-'dropCap'-'dropCapLines'-'dropCapDistance'-'dropCapMargin');
   end if;
   blocks:=blocks||jsonb_build_array(block);
  end loop;
  document_snapshot:=jsonb_set(document_snapshot,'{blocks}',blocks);
 end if;
 perform public.assert_word_efficiency_document_schema_before_list_drop_cap(document_snapshot,editor_capabilities);
end $$;

revoke all on function public.assert_word_efficiency_document_schema_before_list_drop_cap(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb) from public,anon,authenticated;

commit;

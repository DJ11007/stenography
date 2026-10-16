begin;

-- Word Efficiency: Word 2013 Page Setup dialog -- the gutter.
--
-- pageLayout may now also carry gutter ("12.7mm", 0-99.99 mm) and
-- gutterPosition ('left'|'top'). Both are optional, so older answers stay
-- valid. pageLayout.padding is still the margins only (the gutter is never
-- folded into it), so margin grading is unchanged.
--
-- Same layering as 202610161000: the new fields are checked here, removed,
-- and the document is handed to the previous check. Safe to run more than once.

do $$
begin
 if not exists(select 1 from pg_proc where proname='assert_word_efficiency_document_schema_before_page_setup' and pronamespace='public'::regnamespace) then
  alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_page_setup;
 end if;
end $$;

create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare layout jsonb:=document_snapshot->'pageLayout';
begin
 if jsonb_typeof(layout)='object' then
  if layout?'gutter' and not(layout->'gutter'='null'::jsonb or(jsonb_typeof(layout->'gutter')='string' and(layout->>'gutter')~'^\d{1,2}(\.\d{1,2})?mm$')) then raise exception'Invalid page gutter';end if;
  if layout?'gutterPosition' and not(layout->'gutterPosition'='null'::jsonb or(layout->>'gutterPosition')in('left','top')) then raise exception'Invalid page gutter position';end if;
  document_snapshot:=jsonb_set(document_snapshot,'{pageLayout}',layout-array['gutter','gutterPosition']);
 end if;
 perform public.assert_word_efficiency_document_schema_before_page_setup(document_snapshot,editor_capabilities);
end $$;

revoke all on function public.assert_word_efficiency_document_schema_before_page_setup(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb) from public,anon,authenticated;

commit;

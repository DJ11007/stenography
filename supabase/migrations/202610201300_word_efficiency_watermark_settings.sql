begin;

-- Word Efficiency: Word 2013's Custom Watermark (DESIGN > Watermark > Custom Watermark…).
--
-- pageLayout.watermark is still the watermark text. With a watermark the editor now also saves:
--   watermarkFont            font name (e.g. "Kruti Dev 010" for a Hindi watermark)
--   watermarkSize            "auto" or a point size
--   watermarkColor           "FF0000"
--   watermarkSemitransparent "true" | "false"
--   watermarkLayout          "diagonal" | "horizontal"
-- All optional, so older answers stay valid. EFFICIENCY TEST 4 Q4b asks for a red, not
-- semitransparent watermark, which needs these settings to be gradable.
--
-- Same layering as 202610161400: the new fields are checked here, removed, and the document is
-- handed to the previous check. Safe to run more than once.

do $$
begin
 if not exists(select 1 from pg_proc where proname='assert_word_efficiency_document_schema_before_watermark' and pronamespace='public'::regnamespace) then
  alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_watermark;
 end if;
end $$;

create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare layout jsonb:=document_snapshot->'pageLayout';
begin
 if jsonb_typeof(layout)='object' then
  if layout?'watermarkFont' and not(layout->'watermarkFont'='null'::jsonb or(jsonb_typeof(layout->'watermarkFont')='string' and length(layout->>'watermarkFont') between 1 and 100)) then raise exception'Invalid watermark font';end if;
  if layout?'watermarkSize' and not(layout->'watermarkSize'='null'::jsonb or(layout->>'watermarkSize')~'^(auto|\d{1,3})$') then raise exception'Invalid watermark size';end if;
  if layout?'watermarkColor' and not(layout->'watermarkColor'='null'::jsonb or(layout->>'watermarkColor')~'^[0-9A-F]{6}$') then raise exception'Invalid watermark color';end if;
  if layout?'watermarkSemitransparent' and not(layout->'watermarkSemitransparent'='null'::jsonb or(layout->>'watermarkSemitransparent')in('true','false')) then raise exception'Invalid watermark transparency';end if;
  if layout?'watermarkLayout' and not(layout->'watermarkLayout'='null'::jsonb or(layout->>'watermarkLayout')in('diagonal','horizontal')) then raise exception'Invalid watermark layout';end if;
  document_snapshot:=jsonb_set(document_snapshot,'{pageLayout}',layout-array['watermarkFont','watermarkSize','watermarkColor','watermarkSemitransparent','watermarkLayout']);
 end if;
 perform public.assert_word_efficiency_document_schema_before_watermark(document_snapshot,editor_capabilities);
end $$;

revoke all on function public.assert_word_efficiency_document_schema_before_watermark(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb) from public,anon,authenticated;

commit;

begin;

-- The margins ribbon command now supports independent top/right/bottom/left
-- values (a CSS 4-value padding shorthand) instead of one uniform value.
-- Validate the extended format here, then substitute a dummy single-value
-- margin before delegating to the prior validator so its narrower regex
-- keeps accepting every other field unchanged. No stored document is rewritten.
alter function public.assert_word_efficiency_document_schema(jsonb,jsonb)
 rename to assert_word_efficiency_document_schema_before_margin_expansion;

create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare padding_value text;safe_document jsonb;
begin
 safe_document:=document_snapshot;
 if document_snapshot->>'schemaVersion'='2'then
  padding_value:=document_snapshot#>>'{pageLayout,padding}';
  if padding_value is not null and padding_value!~'^\d{1,2}(\.\d{1,2})?mm$'and padding_value!~'^(?:\d{1,2}(\.\d{1,2})?mm ){3}\d{1,2}(\.\d{1,2})?mm$'then raise exception'Invalid page margins';end if;
  if padding_value is not null then safe_document:=jsonb_set(document_snapshot,'{pageLayout,padding}','"0mm"'::jsonb);end if;
 end if;
 perform public.assert_word_efficiency_document_schema_before_margin_expansion(safe_document,editor_capabilities);
end $$;

revoke all on function public.assert_word_efficiency_document_schema_before_margin_expansion(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb)from public,anon,authenticated;

commit;

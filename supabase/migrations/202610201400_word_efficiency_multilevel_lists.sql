begin;

-- Word Efficiency: Word 2013's Multilevel List (HOME > Multilevel List).
--
-- A list item may now have listStyle "multilevel-decimal" (1. / 1.1. / 1.1.1.), "multilevel-paren"
-- (1) / a) / i)), "multilevel-outline" (I. / A. / 1.) or "multilevel-bullet" (• / o / ▪), with
-- listLevel "1".."9" (Tab / Increase Indent moves an item a level down). EFFICIENCY TEST 4 Q4c asks
-- for a multilevel list, which needs the levels to be saved and gradable.
--
-- Same layering as 202610161400: the new values are checked here, the item is handed to the previous
-- check as an ordinary numbered item (listStyle "decimal", no listLevel), and stored as sent.
-- Older answers are unchanged. Safe to run more than once.

-- The approved list styles stay equal to the editor's WORD_LIST_STYLES (lib/word-editor-document.ts).
create or replace function public.word_efficiency_approved_list_styles()
returns text[] language sql immutable set search_path=pg_catalog,public as $$select array[
 'bullet','bullet-disc','bullet-circle','bullet-square','bullet-diamond','bullet-arrow','bullet-check',
 'decimal','decimal-paren','upper-roman','upper-alpha','lower-alpha-paren','lower-alpha','lower-roman',
 'multilevel-decimal','multilevel-paren','multilevel-outline','multilevel-bullet']::text[]$$;

do $$
begin
 if not exists(select 1 from pg_proc where proname='assert_word_efficiency_document_schema_before_multilevel' and pronamespace='public'::regnamespace) then
  alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_multilevel;
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
    if attrs?'listLevel' and not((attrs->>'listLevel')~'^[1-9]$' and coalesce(attrs->>'listStyle','')~'^multilevel-(decimal|paren|outline|bullet)$') then raise exception'Invalid list level';end if;
    if coalesce(attrs->>'listStyle','') like 'multilevel-%' then
     if (attrs->>'listStyle') !~ '^multilevel-(decimal|paren|outline|bullet)$' then raise exception'Invalid multilevel list style';end if;
     block:=jsonb_set(block,'{attrs}',(attrs-'listLevel')||jsonb_build_object('listStyle','decimal'));
    end if;
   end if;
   blocks:=blocks||jsonb_build_array(block);
  end loop;
  document_snapshot:=jsonb_set(document_snapshot,'{blocks}',blocks);
 end if;
 perform public.assert_word_efficiency_document_schema_before_multilevel(document_snapshot,editor_capabilities);
end $$;

revoke all on function public.assert_word_efficiency_document_schema_before_multilevel(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb) from public,anon,authenticated;

commit;

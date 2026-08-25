begin;

-- Migration 011 wrapped the schema validator. Re-deploy the canonical feature
-- helper after that wrapper so every RPC compares browser CSS zero values with
-- the same rules introduced by migration 009. No stored document is rewritten.
create or replace function public.word_efficiency_document_feature(d jsonb,f text)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare feature_name alias for $2;feature_result jsonb;
begin
 if feature_name like'page:%'then return coalesce(d#>array['pageLayout',substr(feature_name,6)],'null'::jsonb);end if;
 if feature_name like'alignment:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb((block_entries.block_value->>'alignment')=substr(feature_name,11))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name like'list:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb((block_entries.block_value#>>'{attrs,listStyle}')=substr(feature_name,6))order by block_entries.block_value->>'id')filter(where block_entries.block_value->>'type'='list-item'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name like'type:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb(block_entries.block_value->>'type')order by block_entries.block_value->>'id')filter(where block_entries.block_value->>'type'=substr(feature_name,6)),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name in('marginLeft','marginRight','marginTop','marginBottom','lineHeight')then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb(public.word_efficiency_canonical_measurement(block_entries.block_value#>array['attrs',feature_name],case when feature_name='lineHeight'then'lineHeight'else'length'end))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name in('alignment','attrs','border','backgroundColor','hyphens','lineNumbers','dropCap','listStyle','rows','src','kind')then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',case when feature_name='alignment'then block_entries.block_value->'alignment'when feature_name='attrs'then block_entries.block_value->'attrs'else coalesce(block_entries.block_value#>array['attrs',feature_name],'null'::jsonb)end order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 select coalesce(jsonb_object_agg(block_entries.block_value->>'id',(select jsonb_agg(case feature_name when'bold'then coalesce(run_entries.run_value->'bold','false'::jsonb)when'italic'then coalesce(run_entries.run_value->'italic','false'::jsonb)when'underline'then coalesce(run_entries.run_value->'underline','false'::jsonb)when'strike'then coalesce(run_entries.run_value->'strike','false'::jsonb)when'doubleStrike'then coalesce(run_entries.run_value->'doubleStrike','false'::jsonb)when'superscript'then coalesce(run_entries.run_value->'superscript','false'::jsonb)when'subscript'then coalesce(run_entries.run_value->'subscript','false'::jsonb)when'href:external'then case when coalesce(run_entries.run_value->>'href','')~'^(https?://|mailto:)'then run_entries.run_value->'href'else'null'::jsonb end when'href:internal'then case when coalesce(run_entries.run_value->>'href','')~'^#bookmark-'then run_entries.run_value->'href'else'null'::jsonb end else coalesce(run_entries.run_value->feature_name,'null'::jsonb)end order by run_entries.ordinality)from jsonb_array_elements(block_entries.block_value->'runs')with ordinality as run_entries(run_value,ordinality))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;
end $$;

create or replace function public.word_efficiency_approved_fonts()
returns text[] language sql immutable set search_path=pg_catalog,public as $$select array[
 'Calibri Light (Headings)','Calibri (Body)','Calibri','Calibri Light','Calibri Semibold','Arial','Arial Black','Arial Narrow','Arial Rounded MT Bold','Arial Unicode MS',
 'Bahnschrift','Bahnschrift Condensed','Bahnschrift Light','Bahnschrift Light Condensed','Bahnschrift Light SemiCondensed','Bahnschrift SemiBold','Bahnschrift SemiBold Condensed','Bahnschrift SemiBold SemiCondensed','Bahnschrift SemiCondensed','Bahnschrift SemiLight','Bahnschrift SemiLight Condensed','Bahnschrift SemiLight SemiCondensed',
 'Bookman Old Style','Cambria','Cambria Math','Candara','Century','Century Gothic','Comic Sans MS','Consolas','Constantia','Corbel','Courier New','Franklin Gothic Medium','Garamond','Georgia','Gill Sans MT','Lucida Console','Lucida Sans Unicode','Microsoft Sans Serif','Palatino Linotype','Segoe UI','Tahoma','Times New Roman','Trebuchet MS','Verdana',
 'Aparajita','Kokila','Kruti Dev 010','Mangal','Nirmala UI','Sanskrit Text','Utsaah','Noto Sans Devanagari','Noto Serif Devanagari']::text[]$$;

alter function public.assert_word_efficiency_editor_capabilities(jsonb) rename to assert_word_efficiency_editor_capabilities_before_font_expansion;
create or replace function public.assert_word_efficiency_editor_capabilities(c jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare font_value jsonb;legacy_caps jsonb;
begin
 if c->>'schemaVersion'='2'then
  if jsonb_typeof(c->'fonts')<>'array'or jsonb_array_length(c->'fonts')not between 1 and array_length(public.word_efficiency_approved_fonts(),1)or jsonb_array_length(c->'fonts')<>(select count(distinct value#>>'{}')from jsonb_array_elements(c->'fonts'))then raise exception'Unknown or duplicate editor font';end if;
  for font_value in select value from jsonb_array_elements(c->'fonts')loop if jsonb_typeof(font_value)<>'string'or not((font_value#>>'{}')=any(public.word_efficiency_approved_fonts()))then raise exception'Unknown or duplicate editor font';end if;end loop;
  legacy_caps:=jsonb_set(c,'{fonts}','["Calibri"]'::jsonb);
 else legacy_caps:=c;end if;
 perform public.assert_word_efficiency_editor_capabilities_before_font_expansion(legacy_caps);
end $$;

alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_font_expansion;
create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare block_value jsonb;run_value jsonb;font_name text;safe_document jsonb;safe_capabilities jsonb;
begin
 perform public.assert_word_efficiency_editor_capabilities(editor_capabilities);
 for block_value in select value from jsonb_array_elements(document_snapshot->'blocks')loop
  for run_value in select value from jsonb_array_elements(block_value->'runs')loop
   if jsonb_typeof(run_value->'fontFamily')='string'then font_name:=run_value->>'fontFamily';if not(font_name=any(public.word_efficiency_approved_fonts()))or not((editor_capabilities->'fonts')?font_name)then raise exception'Disabled or unknown document font';end if;end if;
  end loop;
 end loop;
 select jsonb_set(document_snapshot,'{blocks}',jsonb_agg(jsonb_set(blocks.block_item,'{runs}',(select jsonb_agg(case when jsonb_typeof(runs.run_item->'fontFamily')='string'then jsonb_set(runs.run_item,'{fontFamily}','"Calibri"'::jsonb)else runs.run_item end order by runs.run_ordinality)from jsonb_array_elements(blocks.block_item->'runs')with ordinality as runs(run_item,run_ordinality)))order by blocks.block_ordinality))into safe_document from jsonb_array_elements(document_snapshot->'blocks')with ordinality as blocks(block_item,block_ordinality);
 safe_capabilities:=jsonb_set(editor_capabilities,'{fonts}','["Calibri"]'::jsonb);
 perform public.assert_word_efficiency_document_schema_before_font_expansion(safe_document,safe_capabilities);
end $$;

revoke all on function public.word_efficiency_document_feature(jsonb,text),public.word_efficiency_approved_fonts(),public.assert_word_efficiency_editor_capabilities_before_font_expansion(jsonb),public.assert_word_efficiency_editor_capabilities(jsonb),public.assert_word_efficiency_document_schema_before_font_expansion(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb)from public,anon,authenticated;

commit;

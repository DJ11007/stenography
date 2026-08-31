begin;

-- Two independent, small fixes the admin asked for after reviewing real
-- Word 2013 screenshots:
--
-- 1. Drop Cap gained a real gallery (None/Dropped/In margin) and a "Drop
--    Cap Options..." dialog (font, lines to drop, distance from text) --
--    previously it was a silent no-op unless text happened to already be
--    selected, and always hardcoded 3 lines with no configurable position/
--    distance/font. Lines/distance/position are stored as three new,
--    narrowly-typed optional paragraph attrs (dropCapLines, dropCapDistance,
--    dropCapMargin) so they survive a page reload / Model Answer re-render
--    instead of resetting to the old hardcoded default -- font doesn't need
--    a new field, since the drop cap character is just the paragraph's
--    first run and already has its own fontFamily/fontSize like any run.
--
-- 2. The Columns gallery gained "More Columns..." (up to 6, matching real
--    Word's practical range) -- the schema/capability validator only ever
--    allowed 1-3, so this widens that one regex on both the client and
--    Postgres side.
--
-- Follows the same wrap-and-neutralize technique every prior expansion of
-- this validator has used: validate the new/widened values against their
-- own rules, substitute values the older validator already accepts, then
-- delegate to it unchanged so none of its logic has to be reproduced.

-- Full redefinition (mirrors migration 043's body exactly, extended with
-- the three new drop cap attrs in the existing generic attrs lookup --
-- no new case is needed for columnCount, since word_efficiency_document_feature
-- never validates its *range*, only extracts the raw page-layout value).
create or replace function public.word_efficiency_document_feature(d jsonb,f text)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare feature_name alias for $2;feature_result jsonb;
begin
 if feature_name like'page:%'then return coalesce(d#>array['pageLayout',substr(feature_name,6)],'null'::jsonb);end if;
 if feature_name like'alignment:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb((block_entries.block_value->>'alignment')=substr(feature_name,11))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name like'list:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb((block_entries.block_value#>>'{attrs,listStyle}')=substr(feature_name,6))order by block_entries.block_value->>'id')filter(where block_entries.block_value->>'type'='list-item'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name like'type:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb(block_entries.block_value->>'type')order by block_entries.block_value->>'id')filter(where block_entries.block_value->>'type'=substr(feature_name,6)),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name in('marginLeft','marginRight','marginTop','marginBottom','lineHeight')then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb(public.word_efficiency_canonical_measurement(block_entries.block_value#>array['attrs',feature_name],case when feature_name='lineHeight'then'lineHeight'else'length'end))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name in('alignment','attrs','border','backgroundColor','hyphens','lineNumbers','dropCap','dropCapLines','dropCapDistance','dropCapMargin','listStyle','rows','src','kind','specialIndentMode','specialIndentAmount','tableLayout')then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',case when feature_name='alignment'then block_entries.block_value->'alignment'when feature_name='attrs'then block_entries.block_value->'attrs'else coalesce(block_entries.block_value#>array['attrs',feature_name],'null'::jsonb)end order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 select coalesce(jsonb_object_agg(block_entries.block_value->>'id',(select jsonb_agg(case feature_name when'bold'then coalesce(run_entries.run_value->'bold','false'::jsonb)when'italic'then coalesce(run_entries.run_value->'italic','false'::jsonb)when'underline'then coalesce(run_entries.run_value->'underline','false'::jsonb)when'strike'then coalesce(run_entries.run_value->'strike','false'::jsonb)when'doubleStrike'then coalesce(run_entries.run_value->'doubleStrike','false'::jsonb)when'superscript'then coalesce(run_entries.run_value->'superscript','false'::jsonb)when'subscript'then coalesce(run_entries.run_value->'subscript','false'::jsonb)when'smallCaps'then coalesce(run_entries.run_value->'smallCaps','false'::jsonb)when'allCaps'then coalesce(run_entries.run_value->'allCaps','false'::jsonb)when'hidden'then coalesce(run_entries.run_value->'hidden','false'::jsonb)when'kerningEnabled'then coalesce(run_entries.run_value->'kerningEnabled','false'::jsonb)when'href:external'then case when coalesce(run_entries.run_value->>'href','')~'^(https?://|mailto:)'then run_entries.run_value->'href'else'null'::jsonb end when'href:internal'then case when coalesce(run_entries.run_value->>'href','')~'^#bookmark-'then run_entries.run_value->'href'else'null'::jsonb end else coalesce(run_entries.run_value->feature_name,'null'::jsonb)end order by run_entries.ordinality)from jsonb_array_elements(block_entries.block_value->'runs')with ordinality as run_entries(run_value,ordinality))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;
end $$;

-- Wrap-and-neutralize: validate the drop cap attrs and the widened
-- columnCount range, then strip/substitute both to a shape the validator
-- active immediately before this migration (currently 043's, character
-- spacing) already accepts, and delegate to it unchanged.
alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_drop_cap_and_columns;
create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare block_value jsonb;safe_document jsonb;
begin
 if document_snapshot->>'schemaVersion'<>'2'then perform public.assert_word_efficiency_document_schema_before_drop_cap_and_columns(document_snapshot,editor_capabilities);return;end if;
 if jsonb_typeof(document_snapshot#>'{pageLayout,columnCount}')='string'and document_snapshot#>>'{pageLayout,columnCount}'!~'^[1-6]$'then raise exception'Invalid page columns';end if;
 for block_value in select value from jsonb_array_elements(document_snapshot->'blocks')loop
  if block_value->>'type'='paragraph'then
   if block_value->'attrs'?'dropCapLines'and not(jsonb_typeof(block_value#>'{attrs,dropCapLines}')='number'and(block_value#>>'{attrs,dropCapLines}')::numeric between 1 and 10)then raise exception'Invalid drop cap lines';end if;
   if block_value->'attrs'?'dropCapDistance'and not(jsonb_typeof(block_value#>'{attrs,dropCapDistance}')='number'and(block_value#>>'{attrs,dropCapDistance}')::numeric between 0 and 2)then raise exception'Invalid drop cap distance';end if;
   if block_value->'attrs'?'dropCapMargin'and jsonb_typeof(block_value#>'{attrs,dropCapMargin}')<>'boolean'then raise exception'Invalid drop cap margin flag';end if;
  end if;
 end loop;
 select jsonb_set(
  case when jsonb_typeof(document_snapshot#>'{pageLayout,columnCount}')='string'and document_snapshot#>>'{pageLayout,columnCount}'not in('1','2','3')
   then jsonb_set(document_snapshot,'{pageLayout,columnCount}','"3"'::jsonb)
   else document_snapshot end,
  '{blocks}',
  jsonb_agg(jsonb_set(blocks.block_item,'{attrs}',coalesce(blocks.block_item->'attrs','{}'::jsonb)-'dropCapLines'-'dropCapDistance'-'dropCapMargin')order by blocks.block_ordinality)
 )into safe_document from jsonb_array_elements(document_snapshot->'blocks')with ordinality as blocks(block_item,block_ordinality);
 perform public.assert_word_efficiency_document_schema_before_drop_cap_and_columns(safe_document,editor_capabilities);
end $$;

-- Full redefinition (not a wrap, per its own established convention),
-- mirroring migration 044's body exactly, extended with the three new
-- drop cap features all mapped to the same dropCap capability that
-- already gates the plain dropCap boolean.
create or replace function public.assert_word_efficiency_capability_changes(d jsonb,baseline jsonb,caps jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare operation_value jsonb;capability_rule record;is_enabled boolean;
begin
 if d->>'schemaVersion'='2'then for operation_value in select operation_entries.operation_item from jsonb_array_elements(d->'operations')as operation_entries(operation_item)loop if not public.word_efficiency_command_enabled(caps,operation_value#>>'{}')then raise exception'Disabled editor command %',operation_value#>>'{}';end if;end loop;end if;
 for capability_rule in select capability_rules.feature,capability_rules.commands from(values
  ('bold',array['bold']),('italic',array['italic']),('underline',array['underline']),('strike',array['strikeThrough']),('doubleStrike',array['textEffects']),('superscript',array['superscript']),('subscript',array['subscript']),('smallCaps',array['fontDialog']),('allCaps',array['fontDialog']),('hidden',array['fontDialog']),('charScale',array['fontDialog']),('charSpacing',array['fontDialog']),('charPosition',array['fontDialog']),('kerningEnabled',array['fontDialog']),('kerningMin',array['fontDialog']),('fontFamily',array['fontName']),('fontSize',array['fontSize','increaseFontSize','decreaseFontSize']),('color',array['fontColor']),('highlight',array['highlightColor']),('alignment:left',array['alignLeft','paragraphDialog']),('alignment:center',array['alignCenter','paragraphDialog']),('alignment:right',array['alignRight','paragraphDialog']),('alignment:justify',array['justify','paragraphDialog']),
  ('list:bullet',array['bullets']),('list:bullet-disc',array['bullets']),('list:bullet-circle',array['bullets']),('list:bullet-square',array['bullets']),('list:bullet-diamond',array['bullets']),('list:bullet-arrow',array['bullets']),('list:bullet-check',array['bullets']),
  ('list:decimal',array['numbering','multilevelList']),('list:decimal-paren',array['numbering','multilevelList']),('list:upper-roman',array['numbering','multilevelList']),('list:upper-alpha',array['numbering','multilevelList']),('list:lower-alpha-paren',array['numbering','multilevelList']),('list:lower-alpha',array['numbering','multilevelList']),('list:lower-roman',array['numbering','multilevelList']),
  ('marginLeft',array['increaseIndent','decreaseIndent','paragraphDialog']),('marginRight',array['increaseIndent','decreaseIndent','paragraphDialog']),('lineHeight',array['lineSpacing','paragraphDialog']),('marginTop',array['lineSpacing','paragraphSpacing','paragraphDialog']),('marginBottom',array['lineSpacing','paragraphSpacing','paragraphDialog']),('specialIndentMode',array['lineSpacing','paragraphSpacing','paragraphDialog']),('specialIndentAmount',array['lineSpacing','paragraphSpacing','paragraphDialog']),('backgroundColor',array['shading']),('border',array['borders']),('hyphens',array['borders','shading','paragraphDialog']),('lineNumbers',array['lineNumbers','paragraphDialog']),('dropCap',array['dropCap']),('dropCapLines',array['dropCap']),('dropCapDistance',array['dropCap']),('dropCapMargin',array['dropCap']),('tableLayout',array['insertTable']),('href:external',array['hyperlink']),('href:internal',array['crossReference']),('bookmark',array['bookmark']),('field',array['pageNumber','dateTime','symbol']),('type:cover-page',array['coverPage']),('type:shape',array['shapes']),('type:header',array['header']),('type:footer',array['footer']),('type:section-break',array['sectionBreak']),('page:padding',array['margins']),('page:aspectRatio',array['orientation']),('page:maxWidth',array['pageSize']),('page:columnCount',array['columns']),('page:backgroundColor',array['pageColor']),('page:watermark',array['watermark']),('page:border',array['pageBorders'])
 )as capability_rules(feature,commands)loop
  if public.word_efficiency_document_feature(d,capability_rule.feature)is distinct from public.word_efficiency_document_feature(baseline,capability_rule.feature)then select coalesce(bool_or(public.word_efficiency_command_enabled(caps,command_entries.command_name)),false)into is_enabled from unnest(capability_rule.commands)as command_entries(command_name);if not is_enabled then raise exception'Disabled capability changed document feature %',capability_rule.feature;end if;end if;
 end loop;
 if public.word_efficiency_document_feature(d,'type:table')is distinct from public.word_efficiency_document_feature(baseline,'type:table')or public.word_efficiency_document_feature(d,'rows')is distinct from public.word_efficiency_document_feature(baseline,'rows')then if not public.word_efficiency_command_enabled(caps,'insertTable')then raise exception'Disabled table capability';end if;end if;
 if public.word_efficiency_document_feature(d,'type:image')is distinct from public.word_efficiency_document_feature(baseline,'type:image')or public.word_efficiency_document_feature(d,'src')is distinct from public.word_efficiency_document_feature(baseline,'src')then if not public.word_efficiency_command_enabled(caps,'insertPicture')and not public.word_efficiency_command_enabled(caps,'onlinePictures')then raise exception'Disabled image capability';end if;end if;
 if public.word_efficiency_document_feature(d,'type:page-break')is distinct from public.word_efficiency_document_feature(baseline,'type:page-break')or public.word_efficiency_document_feature(d,'kind')is distinct from public.word_efficiency_document_feature(baseline,'kind')then if not public.word_efficiency_command_enabled(caps,'pageBreak')and not public.word_efficiency_command_enabled(caps,'blankPage')then raise exception'Disabled page break capability';end if;end if;
end $$;

revoke all on function public.word_efficiency_document_feature(jsonb,text),public.assert_word_efficiency_document_schema_before_drop_cap_and_columns(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb),public.assert_word_efficiency_capability_changes(jsonb,jsonb,jsonb)from public,anon,authenticated;

commit;

begin;

-- Adds the Font dialog's remaining text effects the admin asked for after
-- reviewing real Word screenshots: Outline and Emboss (Word also has
-- Shadow and Engrave in the same group, but those weren't asked for and
-- aren't added here). Same shape as every prior font-effect addition
-- (smallCaps/allCaps/hidden in migration 040): two new boolean run fields,
-- gated under the existing fontDialog capability -- no new command ID, so
-- no ribbon/capability-schema change is needed.
--
-- Learned the hard way earlier this session: assert_word_efficiency_
-- underline_styles is called directly by the validate_word_efficiency_
-- underline_write trigger on every autosave/submit UPDATE, completely
-- outside the assert_word_efficiency_document_schema wrap-and-neutralize
-- chain -- so its own run-field whitelist has to be extended too, or these
-- two new fields would fail autosave with "Document run fields are
-- invalid" exactly like migration 047 had to fix for the fields added in
-- migrations 040/043. Both places are updated together this time.

-- Wrap-and-neutralize: validate + strip the new fields, then delegate to
-- the validator active immediately before this migration (currently the
-- one from migration 040, font_dialog_and_layout_options).
alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_outline_and_emboss;
create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare block_value jsonb;run_value jsonb;safe_document jsonb;
begin
 if document_snapshot->>'schemaVersion'<>'2'then perform public.assert_word_efficiency_document_schema_before_outline_and_emboss(document_snapshot,editor_capabilities);return;end if;
 for block_value in select value from jsonb_array_elements(document_snapshot->'blocks')loop
  for run_value in select value from jsonb_array_elements(block_value->'runs')loop
   if run_value?'outline'and jsonb_typeof(run_value->'outline')<>'boolean'then raise exception'Invalid run mark';end if;
   if run_value?'emboss'and jsonb_typeof(run_value->'emboss')<>'boolean'then raise exception'Invalid run mark';end if;
  end loop;
 end loop;
 select jsonb_set(document_snapshot,'{blocks}',jsonb_agg(jsonb_set(blocks.block_item,'{runs}',(select jsonb_agg(runs.run_item-'outline'-'emboss'order by runs.run_ordinality)from jsonb_array_elements(blocks.block_item->'runs')with ordinality as runs(run_item,run_ordinality)))order by blocks.block_ordinality))into safe_document from jsonb_array_elements(document_snapshot->'blocks')with ordinality as blocks(block_item,block_ordinality);
 perform public.assert_word_efficiency_document_schema_before_outline_and_emboss(safe_document,editor_capabilities);
end $$;

-- Full redefinition (this function has always been fully redefined, never
-- wrapped -- see migration 047's comment on why it exists at all).
create or replace function public.assert_word_efficiency_underline_styles(document_snapshot jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare run_value jsonb;
begin
 if document_snapshot is null or jsonb_typeof(document_snapshot)<>'object' then raise exception 'Invalid structured document snapshot';end if;
 for run_value in select run_rows.run_value from jsonb_array_elements(coalesce(document_snapshot->'blocks','[]'::jsonb))as block_rows(block_value)cross join lateral jsonb_array_elements(coalesce(block_rows.block_value->'runs','[]'::jsonb))as run_rows(run_value)loop
  if exists(select 1 from jsonb_object_keys(run_value)as run_keys(key_name)where run_keys.key_name not in('text','bold','italic','underline','underlineStyle','underlineColor','underlineThickness','underlineWordsOnly','strike','superscript','subscript','fontFamily','fontSize','color','highlight','doubleStrike','href','bookmark','field','smallCaps','allCaps','hidden','charScale','charSpacing','charPosition','kerningEnabled','kerningMin','outline','emboss'))then raise exception 'Document run fields are invalid';end if;
  if run_value?'underlineStyle'and(run_value->'underlineStyle'<>'null'::jsonb and(jsonb_typeof(run_value->'underlineStyle')<>'string'or run_value->>'underlineStyle'not in('single','double','thick','dotted','dashed','dot-dash','dot-dot-dash','wavy','words-only')))then raise exception 'Invalid underline style';end if;
  if run_value?'underlineColor'and(run_value->'underlineColor'<>'null'::jsonb and(jsonb_typeof(run_value->'underlineColor')<>'string'or run_value->>'underlineColor'!~'^[0-9A-Fa-f]{6}$'))then raise exception 'Invalid underline color';end if;
  if run_value?'underlineThickness'and(run_value->'underlineThickness'<>'null'::jsonb and(jsonb_typeof(run_value->'underlineThickness')<>'number'or(run_value->>'underlineThickness')::numeric not between 1 and 5))then raise exception 'Invalid underline thickness';end if;
  if run_value?'underlineWordsOnly'and jsonb_typeof(run_value->'underlineWordsOnly')<>'boolean'then raise exception 'Invalid words-only underline setting';end if;
  if run_value?'smallCaps'and jsonb_typeof(run_value->'smallCaps')<>'boolean'then raise exception 'Invalid run mark';end if;
  if run_value?'allCaps'and jsonb_typeof(run_value->'allCaps')<>'boolean'then raise exception 'Invalid run mark';end if;
  if run_value?'hidden'and jsonb_typeof(run_value->'hidden')<>'boolean'then raise exception 'Invalid run mark';end if;
  if run_value?'outline'and jsonb_typeof(run_value->'outline')<>'boolean'then raise exception 'Invalid run mark';end if;
  if run_value?'emboss'and jsonb_typeof(run_value->'emboss')<>'boolean'then raise exception 'Invalid run mark';end if;
  if run_value?'charScale'and(run_value->'charScale'<>'null'::jsonb and jsonb_typeof(run_value->'charScale')<>'number')then raise exception 'Invalid character scale';end if;
  if run_value?'charSpacing'and(run_value->'charSpacing'<>'null'::jsonb and jsonb_typeof(run_value->'charSpacing')<>'number')then raise exception 'Invalid character spacing';end if;
  if run_value?'charPosition'and(run_value->'charPosition'<>'null'::jsonb and jsonb_typeof(run_value->'charPosition')<>'number')then raise exception 'Invalid character position';end if;
  if run_value?'kerningEnabled'and jsonb_typeof(run_value->'kerningEnabled')<>'boolean'then raise exception 'Invalid kerning setting';end if;
  if run_value?'kerningMin'and(run_value->'kerningMin'<>'null'::jsonb and jsonb_typeof(run_value->'kerningMin')<>'number')then raise exception 'Invalid kerning minimum';end if;
  if coalesce((run_value->>'underline')::boolean,false)=false and(
   coalesce(run_value->'underlineStyle','null'::jsonb)<>'null'::jsonb or
   coalesce(run_value->'underlineColor','null'::jsonb)<>'null'::jsonb or
   coalesce(run_value->'underlineThickness','null'::jsonb)<>'null'::jsonb or
   coalesce((run_value->>'underlineWordsOnly')::boolean,false)
  )then raise exception 'Underline metadata requires underline';end if;
 end loop;
end$$;

-- Full redefinition, mirroring migration 040's body exactly, extended with
-- outline/emboss under the existing fontDialog capability and default-
-- false handling in the generic feature lookup (matching smallCaps/
-- allCaps/hidden -- otherwise a missing field would read as null instead
-- of false and every document missing it would show as "changed").
create or replace function public.word_efficiency_document_feature(d jsonb,f text)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare feature_name alias for $2;feature_result jsonb;
begin
 if feature_name like'page:%'then return coalesce(d#>array['pageLayout',substr(feature_name,6)],'null'::jsonb);end if;
 if feature_name like'alignment:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb((block_entries.block_value->>'alignment')=substr(feature_name,11))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name like'list:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb((block_entries.block_value#>>'{attrs,listStyle}')=substr(feature_name,6))order by block_entries.block_value->>'id')filter(where block_entries.block_value->>'type'='list-item'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name like'type:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb(block_entries.block_value->>'type')order by block_entries.block_value->>'id')filter(where block_entries.block_value->>'type'=substr(feature_name,6)),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name in('marginLeft','marginRight','marginTop','marginBottom','lineHeight')then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb(public.word_efficiency_canonical_measurement(block_entries.block_value#>array['attrs',feature_name],case when feature_name='lineHeight'then'lineHeight'else'length'end))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name in('alignment','attrs','border','backgroundColor','hyphens','lineNumbers','dropCap','listStyle','rows','src','kind','specialIndentMode','specialIndentAmount','tableLayout')then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',case when feature_name='alignment'then block_entries.block_value->'alignment'when feature_name='attrs'then block_entries.block_value->'attrs'else coalesce(block_entries.block_value#>array['attrs',feature_name],'null'::jsonb)end order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 select coalesce(jsonb_object_agg(block_entries.block_value->>'id',(select jsonb_agg(case feature_name when'bold'then coalesce(run_entries.run_value->'bold','false'::jsonb)when'italic'then coalesce(run_entries.run_value->'italic','false'::jsonb)when'underline'then coalesce(run_entries.run_value->'underline','false'::jsonb)when'strike'then coalesce(run_entries.run_value->'strike','false'::jsonb)when'doubleStrike'then coalesce(run_entries.run_value->'doubleStrike','false'::jsonb)when'superscript'then coalesce(run_entries.run_value->'superscript','false'::jsonb)when'subscript'then coalesce(run_entries.run_value->'subscript','false'::jsonb)when'smallCaps'then coalesce(run_entries.run_value->'smallCaps','false'::jsonb)when'allCaps'then coalesce(run_entries.run_value->'allCaps','false'::jsonb)when'hidden'then coalesce(run_entries.run_value->'hidden','false'::jsonb)when'outline'then coalesce(run_entries.run_value->'outline','false'::jsonb)when'emboss'then coalesce(run_entries.run_value->'emboss','false'::jsonb)when'href:external'then case when coalesce(run_entries.run_value->>'href','')~'^(https?://|mailto:)'then run_entries.run_value->'href'else'null'::jsonb end when'href:internal'then case when coalesce(run_entries.run_value->>'href','')~'^#bookmark-'then run_entries.run_value->'href'else'null'::jsonb end else coalesce(run_entries.run_value->feature_name,'null'::jsonb)end order by run_entries.ordinality)from jsonb_array_elements(block_entries.block_value->'runs')with ordinality as run_entries(run_value,ordinality))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;
end $$;

-- Full redefinition (not a wrap, per its own established convention),
-- mirroring migration 040's body exactly, extended with the new features.
create or replace function public.assert_word_efficiency_capability_changes(d jsonb,baseline jsonb,caps jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare operation_value jsonb;capability_rule record;is_enabled boolean;
begin
 if d->>'schemaVersion'='2'then for operation_value in select operation_entries.operation_item from jsonb_array_elements(d->'operations')as operation_entries(operation_item)loop if not public.word_efficiency_command_enabled(caps,operation_value#>>'{}')then raise exception'Disabled editor command %',operation_value#>>'{}';end if;end loop;end if;
 for capability_rule in select capability_rules.feature,capability_rules.commands from(values
  ('bold',array['bold']),('italic',array['italic']),('underline',array['underline']),('strike',array['strikeThrough']),('doubleStrike',array['textEffects']),('superscript',array['superscript']),('subscript',array['subscript']),('smallCaps',array['fontDialog']),('allCaps',array['fontDialog']),('hidden',array['fontDialog']),('outline',array['fontDialog']),('emboss',array['fontDialog']),('fontFamily',array['fontName']),('fontSize',array['fontSize','increaseFontSize','decreaseFontSize']),('color',array['fontColor']),('highlight',array['highlightColor']),('alignment:left',array['alignLeft']),('alignment:center',array['alignCenter']),('alignment:right',array['alignRight']),('alignment:justify',array['justify']),
  ('list:bullet',array['bullets']),('list:bullet-disc',array['bullets']),('list:bullet-circle',array['bullets']),('list:bullet-square',array['bullets']),('list:bullet-diamond',array['bullets']),('list:bullet-arrow',array['bullets']),('list:bullet-check',array['bullets']),
  ('list:decimal',array['numbering','multilevelList']),('list:decimal-paren',array['numbering','multilevelList']),('list:upper-roman',array['numbering','multilevelList']),('list:upper-alpha',array['numbering','multilevelList']),('list:lower-alpha-paren',array['numbering','multilevelList']),('list:lower-alpha',array['numbering','multilevelList']),('list:lower-roman',array['numbering','multilevelList']),
  ('marginLeft',array['increaseIndent','decreaseIndent']),('marginRight',array['increaseIndent','decreaseIndent']),('lineHeight',array['lineSpacing']),('marginTop',array['lineSpacing','paragraphSpacing']),('marginBottom',array['lineSpacing','paragraphSpacing']),('specialIndentMode',array['lineSpacing','paragraphSpacing']),('specialIndentAmount',array['lineSpacing','paragraphSpacing']),('backgroundColor',array['shading']),('border',array['borders']),('hyphens',array['borders','shading']),('lineNumbers',array['lineNumbers']),('dropCap',array['dropCap']),('tableLayout',array['insertTable']),('href:external',array['hyperlink']),('href:internal',array['crossReference']),('bookmark',array['bookmark']),('field',array['pageNumber','dateTime','symbol']),('type:cover-page',array['coverPage']),('type:shape',array['shapes']),('type:header',array['header']),('type:footer',array['footer']),('type:section-break',array['sectionBreak']),('page:padding',array['margins']),('page:aspectRatio',array['orientation']),('page:maxWidth',array['pageSize']),('page:columnCount',array['columns']),('page:backgroundColor',array['pageColor']),('page:watermark',array['watermark']),('page:border',array['pageBorders'])
 )as capability_rules(feature,commands)loop
  if public.word_efficiency_document_feature(d,capability_rule.feature)is distinct from public.word_efficiency_document_feature(baseline,capability_rule.feature)then select coalesce(bool_or(public.word_efficiency_command_enabled(caps,command_entries.command_name)),false)into is_enabled from unnest(capability_rule.commands)as command_entries(command_name);if not is_enabled then raise exception'Disabled capability changed document feature %',capability_rule.feature;end if;end if;
 end loop;
 if public.word_efficiency_document_feature(d,'type:table')is distinct from public.word_efficiency_document_feature(baseline,'type:table')or public.word_efficiency_document_feature(d,'rows')is distinct from public.word_efficiency_document_feature(baseline,'rows')then if not public.word_efficiency_command_enabled(caps,'insertTable')then raise exception'Disabled table capability';end if;end if;
 if public.word_efficiency_document_feature(d,'type:image')is distinct from public.word_efficiency_document_feature(baseline,'type:image')or public.word_efficiency_document_feature(d,'src')is distinct from public.word_efficiency_document_feature(baseline,'src')then if not public.word_efficiency_command_enabled(caps,'insertPicture')and not public.word_efficiency_command_enabled(caps,'onlinePictures')then raise exception'Disabled image capability';end if;end if;
 if public.word_efficiency_document_feature(d,'type:page-break')is distinct from public.word_efficiency_document_feature(baseline,'type:page-break')or public.word_efficiency_document_feature(d,'kind')is distinct from public.word_efficiency_document_feature(baseline,'kind')then if not public.word_efficiency_command_enabled(caps,'pageBreak')and not public.word_efficiency_command_enabled(caps,'blankPage')then raise exception'Disabled page break capability';end if;end if;
end $$;

revoke all on function public.assert_word_efficiency_document_schema_before_outline_and_emboss(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb),public.assert_word_efficiency_underline_styles(jsonb),public.word_efficiency_document_feature(jsonb,text),public.assert_word_efficiency_capability_changes(jsonb,jsonb,jsonb)from public,anon,authenticated;

commit;

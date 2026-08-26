begin;

-- Bullets/Numbering/Multilevel list galleries were stuck at 2-3 choices each
-- (None + one style) and, worse, the ribbon commands that were supposed to
-- apply a chosen format never wrote it anywhere the schema validator or the
-- round-trip renderer could see (list-item blocks always defaulted their
-- attrs.listStyle to "bullet" on save, so a numbered/roman list silently
-- reverted to a plain bullet list after any reload). This migration expands
-- the enum the database will accept for list-item attrs.listStyle from the
-- historical 3 values to the full gallery now offered client-side, using the
-- same wrap-and-neutralize technique migration 012 used for approved fonts:
-- validate the real value against the new enum, then substitute the
-- old always-accepted "bullet" before delegating to the previously wrapped
-- validator so none of its other logic has to be reproduced or re-audited.

create or replace function public.word_efficiency_approved_list_styles()
returns text[] language sql immutable set search_path=pg_catalog,public as $$select array[
 'bullet','bullet-disc','bullet-circle','bullet-square','bullet-diamond','bullet-arrow','bullet-check',
 'decimal','decimal-paren','upper-roman','upper-alpha','lower-alpha-paren','lower-alpha','lower-roman']::text[]$$;

alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_list_style_gallery;
create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare block_value jsonb;safe_document jsonb;
begin
 for block_value in select value from jsonb_array_elements(document_snapshot->'blocks')loop
  if block_value->>'type'='list-item'and(jsonb_typeof(block_value#>'{attrs,listStyle}')<>'string'or not(block_value#>>'{attrs,listStyle}'=any(public.word_efficiency_approved_list_styles())))then raise exception'Invalid list style';end if;
 end loop;
 select jsonb_set(document_snapshot,'{blocks}',jsonb_agg(case when blocks.block_item->>'type'='list-item'then jsonb_set(blocks.block_item,'{attrs,listStyle}','"bullet"'::jsonb)else blocks.block_item end order by blocks.block_ordinality))into safe_document from jsonb_array_elements(document_snapshot->'blocks')with ordinality as blocks(block_item,block_ordinality);
 perform public.assert_word_efficiency_document_schema_before_list_style_gallery(safe_document,editor_capabilities);
end $$;

-- Full redefinition (not a wrap) mirroring migration 021 exactly, extended so
-- every new bullet format authorizes the "bullets" command and every new
-- numbering format authorizes either "numbering" or "multilevelList" (both
-- ribbon commands can now produce the same single-level numbered styles).
create or replace function public.assert_word_efficiency_capability_changes(d jsonb,baseline jsonb,caps jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare operation_value jsonb;capability_rule record;is_enabled boolean;
begin
 if d->>'schemaVersion'='2'then for operation_value in select operation_entries.operation_item from jsonb_array_elements(d->'operations')as operation_entries(operation_item)loop if not public.word_efficiency_command_enabled(caps,operation_value#>>'{}')then raise exception'Disabled editor command %',operation_value#>>'{}';end if;end loop;end if;
 for capability_rule in select capability_rules.feature,capability_rules.commands from(values
  ('bold',array['bold']),('italic',array['italic']),('underline',array['underline']),('strike',array['strikeThrough']),('doubleStrike',array['textEffects']),('superscript',array['superscript']),('subscript',array['subscript']),('fontFamily',array['fontName']),('fontSize',array['fontSize','increaseFontSize','decreaseFontSize']),('color',array['fontColor']),('highlight',array['highlightColor']),('alignment:left',array['alignLeft']),('alignment:center',array['alignCenter']),('alignment:right',array['alignRight']),('alignment:justify',array['justify']),
  ('list:bullet',array['bullets']),('list:bullet-disc',array['bullets']),('list:bullet-circle',array['bullets']),('list:bullet-square',array['bullets']),('list:bullet-diamond',array['bullets']),('list:bullet-arrow',array['bullets']),('list:bullet-check',array['bullets']),
  ('list:decimal',array['numbering','multilevelList']),('list:decimal-paren',array['numbering','multilevelList']),('list:upper-roman',array['numbering','multilevelList']),('list:upper-alpha',array['numbering','multilevelList']),('list:lower-alpha-paren',array['numbering','multilevelList']),('list:lower-alpha',array['numbering','multilevelList']),('list:lower-roman',array['numbering','multilevelList']),
  ('marginLeft',array['increaseIndent','decreaseIndent']),('marginRight',array['increaseIndent','decreaseIndent']),('lineHeight',array['lineSpacing']),('marginTop',array['lineSpacing','paragraphSpacing']),('marginBottom',array['lineSpacing','paragraphSpacing']),('backgroundColor',array['shading']),('border',array['borders']),('hyphens',array['borders','shading']),('lineNumbers',array['lineNumbers']),('dropCap',array['dropCap']),('href:external',array['hyperlink']),('href:internal',array['crossReference']),('bookmark',array['bookmark']),('field',array['pageNumber','dateTime','symbol']),('type:cover-page',array['coverPage']),('type:shape',array['shapes']),('type:header',array['header']),('type:footer',array['footer']),('type:section-break',array['sectionBreak']),('page:padding',array['margins']),('page:aspectRatio',array['orientation']),('page:maxWidth',array['pageSize']),('page:columnCount',array['columns']),('page:backgroundColor',array['pageColor']),('page:watermark',array['watermark']),('page:border',array['pageBorders'])
 )as capability_rules(feature,commands)loop
  if public.word_efficiency_document_feature(d,capability_rule.feature)is distinct from public.word_efficiency_document_feature(baseline,capability_rule.feature)then select coalesce(bool_or(public.word_efficiency_command_enabled(caps,command_entries.command_name)),false)into is_enabled from unnest(capability_rule.commands)as command_entries(command_name);if not is_enabled then raise exception'Disabled capability changed document feature %',capability_rule.feature;end if;end if;
 end loop;
 if public.word_efficiency_document_feature(d,'type:table')is distinct from public.word_efficiency_document_feature(baseline,'type:table')or public.word_efficiency_document_feature(d,'rows')is distinct from public.word_efficiency_document_feature(baseline,'rows')then if not public.word_efficiency_command_enabled(caps,'insertTable')then raise exception'Disabled table capability';end if;end if;
 if public.word_efficiency_document_feature(d,'type:image')is distinct from public.word_efficiency_document_feature(baseline,'type:image')or public.word_efficiency_document_feature(d,'src')is distinct from public.word_efficiency_document_feature(baseline,'src')then if not public.word_efficiency_command_enabled(caps,'insertPicture')and not public.word_efficiency_command_enabled(caps,'onlinePictures')then raise exception'Disabled image capability';end if;end if;
 if public.word_efficiency_document_feature(d,'type:page-break')is distinct from public.word_efficiency_document_feature(baseline,'type:page-break')or public.word_efficiency_document_feature(d,'kind')is distinct from public.word_efficiency_document_feature(baseline,'kind')then if not public.word_efficiency_command_enabled(caps,'pageBreak')and not public.word_efficiency_command_enabled(caps,'blankPage')then raise exception'Disabled page break capability';end if;end if;
end $$;

revoke all on function public.word_efficiency_approved_list_styles(),public.assert_word_efficiency_document_schema_before_list_style_gallery(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb),public.assert_word_efficiency_capability_changes(jsonb,jsonb,jsonb)from public,anon,authenticated;

commit;

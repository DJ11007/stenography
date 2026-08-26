begin;

-- marginRight, marginTop, and marginBottom were checked for unauthorized
-- change against an EMPTY allowed-commands list, meaning any detected drift
-- in these fields was always rejected -- there was no command that could
-- ever satisfy the check. marginLeft is the only side with a dedicated
-- ribbon command (increaseIndent/decreaseIndent), but the contentEditable
-- surface does not confine indentation/spacing changes to a single CSS
-- property in isolation, so real students hit "Disabled capability changed
-- document feature marginRight" on ordinary edits with no way to avoid it.
-- Pair marginRight with the same indent commands as marginLeft, and pair
-- marginTop/marginBottom with the spacing commands that already exist for
-- this purpose (lineSpacing, paragraphSpacing) -- this still requires a real
-- paragraph-formatting capability to be enabled, it just recognizes that
-- indentation and spacing naturally act on more than one box-model edge.
create or replace function public.assert_word_efficiency_capability_changes(d jsonb,baseline jsonb,caps jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare operation_value jsonb;capability_rule record;is_enabled boolean;
begin
 if d->>'schemaVersion'='2'then for operation_value in select operation_entries.operation_item from jsonb_array_elements(d->'operations')as operation_entries(operation_item)loop if not public.word_efficiency_command_enabled(caps,operation_value#>>'{}')then raise exception'Disabled editor command %',operation_value#>>'{}';end if;end loop;end if;
 for capability_rule in select capability_rules.feature,capability_rules.commands from(values
  ('bold',array['bold']),('italic',array['italic']),('underline',array['underline']),('strike',array['strikeThrough']),('doubleStrike',array['textEffects']),('superscript',array['superscript']),('subscript',array['subscript']),('fontFamily',array['fontName']),('fontSize',array['fontSize','increaseFontSize','decreaseFontSize']),('color',array['fontColor']),('highlight',array['highlightColor']),('alignment:left',array['alignLeft']),('alignment:center',array['alignCenter']),('alignment:right',array['alignRight']),('alignment:justify',array['justify']),('list:bullet',array['bullets']),('list:decimal',array['numbering']),('list:upper-roman',array['multilevelList']),('marginLeft',array['increaseIndent','decreaseIndent']),('marginRight',array['increaseIndent','decreaseIndent']),('lineHeight',array['lineSpacing']),('marginTop',array['lineSpacing','paragraphSpacing']),('marginBottom',array['lineSpacing','paragraphSpacing']),('backgroundColor',array['shading']),('border',array['borders']),('hyphens',array[]::text[]),('lineNumbers',array['lineNumbers']),('dropCap',array['dropCap']),('href:external',array['hyperlink']),('href:internal',array['crossReference']),('bookmark',array['bookmark']),('field',array['pageNumber','dateTime','symbol']),('type:cover-page',array['coverPage']),('type:shape',array['shapes']),('type:header',array['header']),('type:footer',array['footer']),('type:section-break',array['sectionBreak']),('page:padding',array['margins']),('page:aspectRatio',array['orientation']),('page:maxWidth',array['pageSize']),('page:columnCount',array['columns']),('page:backgroundColor',array['pageColor']),('page:watermark',array['watermark']),('page:border',array['pageBorders'])
 )as capability_rules(feature,commands)loop
  if public.word_efficiency_document_feature(d,capability_rule.feature)is distinct from public.word_efficiency_document_feature(baseline,capability_rule.feature)then select coalesce(bool_or(public.word_efficiency_command_enabled(caps,command_entries.command_name)),false)into is_enabled from unnest(capability_rule.commands)as command_entries(command_name);if not is_enabled then raise exception'Disabled capability changed document feature %',capability_rule.feature;end if;end if;
 end loop;
 if public.word_efficiency_document_feature(d,'type:table')is distinct from public.word_efficiency_document_feature(baseline,'type:table')or public.word_efficiency_document_feature(d,'rows')is distinct from public.word_efficiency_document_feature(baseline,'rows')then if not public.word_efficiency_command_enabled(caps,'insertTable')then raise exception'Disabled table capability';end if;end if;
 if public.word_efficiency_document_feature(d,'type:image')is distinct from public.word_efficiency_document_feature(baseline,'type:image')or public.word_efficiency_document_feature(d,'src')is distinct from public.word_efficiency_document_feature(baseline,'src')then if not public.word_efficiency_command_enabled(caps,'insertPicture')and not public.word_efficiency_command_enabled(caps,'onlinePictures')then raise exception'Disabled image capability';end if;end if;
 if public.word_efficiency_document_feature(d,'type:page-break')is distinct from public.word_efficiency_document_feature(baseline,'type:page-break')or public.word_efficiency_document_feature(d,'kind')is distinct from public.word_efficiency_document_feature(baseline,'kind')then if not public.word_efficiency_command_enabled(caps,'pageBreak')and not public.word_efficiency_command_enabled(caps,'blankPage')then raise exception'Disabled page break capability';end if;end if;
end $$;

revoke all on function public.assert_word_efficiency_capability_changes(jsonb,jsonb,jsonb)from public,anon,authenticated;

commit;

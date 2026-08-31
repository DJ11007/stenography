begin;

-- Adds the real MS-Word "Character Spacing" tab of the Font dialog (Scale,
-- Spacing Expanded/Condensed + By, Position Raised/Lowered + By, Kerning
-- for fonts + minimum size) alongside the existing Font tab, plus moves the
-- Font dialog's ribbon control out of the icon grid and into a real corner
-- "dialog box launcher" button matching real Word -- both changes the admin
-- asked for after reviewing an annotated Word 2013 screenshot. The launcher
-- move is purely client-side rendering (still the same fontDialog command
-- ID/capability, no migration needed for it). Character spacing itself is
-- new document state: five new, narrowly-typed optional run fields
-- (charScale, charSpacing, charPosition, kerningEnabled, kerningMin),
-- following the same wrap-and-neutralize technique every prior expansion of
-- this validator has used: validate the new fields against their own
-- rules, strip them to a shape the older validator already accepts, then
-- delegate to it unchanged so none of its logic has to be reproduced.
--
-- Spacing and Position are stored as a single signed number in points
-- (positive = Expanded/Raised, negative = Condensed/Lowered, 0/absent =
-- Normal) rather than a separate mode+amount pair -- no information is
-- lost (the client dialog derives the mode from the sign for display), and
-- it mirrors how the client already applies these as a plain signed
-- CSS letter-spacing/top offset.
--
-- Both the student workspace and the admin Model Answer editor render
-- through the same RichDocumentEditor component, so this is immediately
-- available -- and immediately gradable via lib/word-document-diff.ts -- in
-- both places at once, with no separate admin-side implementation.

-- word_efficiency_default_editor_capabilities() is unchanged: no new
-- command ID was added (Character Spacing lives inside the existing
-- fontDialog command), so no capability backfill is needed either.

-- Full redefinition (mirrors migration 040's body exactly, extended with a
-- single new case for the one new boolean run feature -- the four new
-- numeric run features already fall through correctly to the existing
-- generic "else" branch, since a run missing the key already resolves to
-- jsonb null via the -> operator, same as any other unset optional field).
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
 select coalesce(jsonb_object_agg(block_entries.block_value->>'id',(select jsonb_agg(case feature_name when'bold'then coalesce(run_entries.run_value->'bold','false'::jsonb)when'italic'then coalesce(run_entries.run_value->'italic','false'::jsonb)when'underline'then coalesce(run_entries.run_value->'underline','false'::jsonb)when'strike'then coalesce(run_entries.run_value->'strike','false'::jsonb)when'doubleStrike'then coalesce(run_entries.run_value->'doubleStrike','false'::jsonb)when'superscript'then coalesce(run_entries.run_value->'superscript','false'::jsonb)when'subscript'then coalesce(run_entries.run_value->'subscript','false'::jsonb)when'smallCaps'then coalesce(run_entries.run_value->'smallCaps','false'::jsonb)when'allCaps'then coalesce(run_entries.run_value->'allCaps','false'::jsonb)when'hidden'then coalesce(run_entries.run_value->'hidden','false'::jsonb)when'kerningEnabled'then coalesce(run_entries.run_value->'kerningEnabled','false'::jsonb)when'href:external'then case when coalesce(run_entries.run_value->>'href','')~'^(https?://|mailto:)'then run_entries.run_value->'href'else'null'::jsonb end when'href:internal'then case when coalesce(run_entries.run_value->>'href','')~'^#bookmark-'then run_entries.run_value->'href'else'null'::jsonb end else coalesce(run_entries.run_value->feature_name,'null'::jsonb)end order by run_entries.ordinality)from jsonb_array_elements(block_entries.block_value->'runs')with ordinality as run_entries(run_value,ordinality))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;
end $$;

-- Wrap-and-neutralize: validate + strip the new run fields, then delegate
-- to the validator active immediately before this migration (currently the
-- one from migration 040, font dialog and layout options).
alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_character_spacing;
create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare block_value jsonb;run_value jsonb;safe_document jsonb;
begin
 -- Character spacing only exists in the schema-v2 editing model; a
 -- schema-v1 document is passed straight through unchanged, exactly like
 -- every prior wrap in this chain.
 if document_snapshot->>'schemaVersion'<>'2'then perform public.assert_word_efficiency_document_schema_before_character_spacing(document_snapshot,editor_capabilities);return;end if;
 for block_value in select value from jsonb_array_elements(document_snapshot->'blocks')loop
  for run_value in select value from jsonb_array_elements(block_value->'runs')loop
   if run_value?'charScale'and not(jsonb_typeof(run_value->'charScale')='null'or(jsonb_typeof(run_value->'charScale')='number'and(run_value->>'charScale')::numeric between 1 and 600))then raise exception'Invalid character scale';end if;
   if run_value?'charSpacing'and not(jsonb_typeof(run_value->'charSpacing')='null'or(jsonb_typeof(run_value->'charSpacing')='number'and(run_value->>'charSpacing')::numeric between -100 and 100))then raise exception'Invalid character spacing';end if;
   if run_value?'charPosition'and not(jsonb_typeof(run_value->'charPosition')='null'or(jsonb_typeof(run_value->'charPosition')='number'and(run_value->>'charPosition')::numeric between -100 and 100))then raise exception'Invalid character position';end if;
   if run_value?'kerningEnabled'and jsonb_typeof(run_value->'kerningEnabled')<>'boolean'then raise exception'Invalid kerning flag';end if;
   if run_value?'kerningMin'and not(jsonb_typeof(run_value->'kerningMin')='null'or(jsonb_typeof(run_value->'kerningMin')='number'and(run_value->>'kerningMin')::numeric between 0 and 72))then raise exception'Invalid kerning minimum size';end if;
  end loop;
 end loop;
 select jsonb_set(document_snapshot,'{blocks}',jsonb_agg(jsonb_set(blocks.block_item,'{runs}',(select jsonb_agg(runs.run_item-'charScale'-'charSpacing'-'charPosition'-'kerningEnabled'-'kerningMin'order by runs.run_ordinality)from jsonb_array_elements(blocks.block_item->'runs')with ordinality as runs(run_item,run_ordinality)))order by blocks.block_ordinality))into safe_document from jsonb_array_elements(document_snapshot->'blocks')with ordinality as blocks(block_item,block_ordinality);
 perform public.assert_word_efficiency_document_schema_before_character_spacing(safe_document,editor_capabilities);
end $$;

-- Full redefinition (not a wrap, per its own established convention),
-- mirroring migration 040's body exactly, extended with the new features
-- all mapped to the same fontDialog capability that already gates
-- smallCaps/allCaps/hidden.
create or replace function public.assert_word_efficiency_capability_changes(d jsonb,baseline jsonb,caps jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare operation_value jsonb;capability_rule record;is_enabled boolean;
begin
 if d->>'schemaVersion'='2'then for operation_value in select operation_entries.operation_item from jsonb_array_elements(d->'operations')as operation_entries(operation_item)loop if not public.word_efficiency_command_enabled(caps,operation_value#>>'{}')then raise exception'Disabled editor command %',operation_value#>>'{}';end if;end loop;end if;
 for capability_rule in select capability_rules.feature,capability_rules.commands from(values
  ('bold',array['bold']),('italic',array['italic']),('underline',array['underline']),('strike',array['strikeThrough']),('doubleStrike',array['textEffects']),('superscript',array['superscript']),('subscript',array['subscript']),('smallCaps',array['fontDialog']),('allCaps',array['fontDialog']),('hidden',array['fontDialog']),('charScale',array['fontDialog']),('charSpacing',array['fontDialog']),('charPosition',array['fontDialog']),('kerningEnabled',array['fontDialog']),('kerningMin',array['fontDialog']),('fontFamily',array['fontName']),('fontSize',array['fontSize','increaseFontSize','decreaseFontSize']),('color',array['fontColor']),('highlight',array['highlightColor']),('alignment:left',array['alignLeft']),('alignment:center',array['alignCenter']),('alignment:right',array['alignRight']),('alignment:justify',array['justify']),
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

revoke all on function public.word_efficiency_document_feature(jsonb,text),public.assert_word_efficiency_document_schema_before_character_spacing(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb),public.assert_word_efficiency_capability_changes(jsonb,jsonb,jsonb)from public,anon,authenticated;

commit;

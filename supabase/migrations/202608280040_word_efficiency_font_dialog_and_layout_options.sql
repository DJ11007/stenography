begin;

-- Adds real MS-Word-style dialogs the admin asked for after reviewing actual
-- Word 2013 screenshots: a unified Font dialog (small caps/all caps/hidden
-- text, alongside the formatting already supported), a paragraph "Special"
-- indent (first line / hanging), a table AutoFit choice, a real Page Number
-- position+alignment picker, and visible Undo/Redo with keyboard shortcuts.
-- Undo/Redo need no schema change (they replay existing edit history, they
-- don't add new document state) -- they're added purely as new ribbon
-- commands. The rest add a handful of new, narrowly-typed run/attrs fields,
-- following the same wrap-and-neutralize technique every prior expansion of
-- this validator has used: validate the new field against its own rules,
-- substitute a value the older validator already accepts, then delegate to
-- it unchanged so none of its logic has to be reproduced or re-audited.
--
-- Both the student workspace and the admin Model Answer editor render
-- through the same RichDocumentEditor component, so every option added here
-- is immediately available -- and immediately gradable via
-- lib/word-document-diff.ts -- in both places at once, with no separate
-- admin-side implementation.

-- Full redefinition (this function has always been redefined wholesale, never wrapped).
create or replace function public.word_efficiency_default_editor_capabilities()
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
with commands(tab_name,group_name,command_name,supported)as(values
 ('Home','clipboard','undo',true),('Home','clipboard','redo',true),('Home','clipboard','paste',true),('Home','clipboard','cut',true),('Home','clipboard','copy',true),('Home','clipboard','formatPainter',true),
 ('Home','font','fontName',true),('Home','font','fontSize',true),('Home','font','increaseFontSize',true),('Home','font','decreaseFontSize',true),('Home','font','changeCase',true),('Home','font','bold',true),('Home','font','italic',true),('Home','font','underline',true),('Home','font','strikeThrough',true),('Home','font','subscript',true),('Home','font','superscript',true),('Home','font','textEffects',true),('Home','font','highlightColor',true),('Home','font','fontColor',true),('Home','font','fontDialog',true),
 ('Home','paragraph','bullets',true),('Home','paragraph','numbering',true),('Home','paragraph','multilevelList',true),('Home','paragraph','decreaseIndent',true),('Home','paragraph','increaseIndent',true),('Home','paragraph','sort',true),('Home','paragraph','formattingMarks',true),('Home','paragraph','alignLeft',true),('Home','paragraph','alignCenter',true),('Home','paragraph','alignRight',true),('Home','paragraph','justify',true),('Home','paragraph','lineSpacing',true),('Home','paragraph','shading',true),('Home','paragraph','borders',true),
 ('Home','editing','find',true),('Home','editing','replace',true),('Home','editing','selectAll',true),
 ('Insert','pages','coverPage',true),('Insert','pages','blankPage',true),('Insert','pages','pageBreak',true),('Insert','tables','insertTable',true),
 ('Insert','illustrations','insertPicture',true),('Insert','illustrations','onlinePictures',true),('Insert','illustrations','shapes',true),
 ('Insert','links','hyperlink',true),('Insert','links','bookmark',true),('Insert','links','crossReference',true),('Insert','headerFooter','header',true),('Insert','headerFooter','footer',true),('Insert','headerFooter','pageNumber',true),
 ('Insert','text','dropCap',true),('Insert','text','dateTime',true),('Insert','symbols','symbol',true),
 ('Design','pageBackground','watermark',true),('Design','pageBackground','pageColor',true),('Design','pageBackground','pageBorders',true),
 ('Page Layout','pageSetup','margins',true),('Page Layout','pageSetup','orientation',true),('Page Layout','pageSetup','pageSize',true),('Page Layout','pageSetup','columns',true),('Page Layout','pageSetup','sectionBreak',true),('Page Layout','pageSetup','lineNumbers',true),
 ('View','views','fullScreenReading',true),('View','views','printLayout',true),('View','views','webLayout',true),('View','views','outlineView',true),('View','views','draftView',true),('View','show','ruler',true),('View','show','gridlines',true),('View','show','documentMap',true),('View','zoom','zoom100',true),('View','zoom','onePage',true),('View','zoom','twoPages',true)
),groups as(select tab_name,group_name,jsonb_build_object('enabled',true,'options',jsonb_object_agg(command_name,to_jsonb(supported)order by command_name))body from commands group by tab_name,group_name),tabs as(select tab_name,jsonb_build_object('enabled',true,'groups',jsonb_object_agg(group_name,body order by group_name))body from groups group by tab_name)
select jsonb_build_object('schemaVersion','2','tabs',jsonb_build_object('File',jsonb_build_object('enabled',true,'groups','{}'::jsonb))||jsonb_object_agg(tab_name,body order by case tab_name when'Home'then 2 when'Insert'then 3 when'Design'then 4 when'Page Layout'then 5 else 6 end),'fonts',jsonb_build_array('Calibri (Body)','Calibri','Arial','Times New Roman','Mangal'),'fontSizeMin',8,'fontSizeMax',72)from tabs
$$;

-- Every existing, already-published test version and in-progress attempt is
-- backfilled to the new capability shape, mirroring migrations 020/022
-- exactly -- otherwise assert_word_efficiency_editor_capabilities would
-- reject the now-stale cached shape as soon as anything touches it.
update public.word_efficiency_versions set editor_capabilities=public.word_efficiency_default_editor_capabilities();
update public.word_efficiency_attempts
set snapshot = jsonb_set(snapshot, '{editor_capabilities}', public.word_efficiency_default_editor_capabilities())
where snapshot ? 'editor_capabilities' and status not in ('submitted','completed');

-- Full redefinition (mirrors migration 012's body exactly, extended so the
-- new attrs-level fields route through the existing generic attrs lookup
-- instead of falling through to the run-level branch).
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
 select coalesce(jsonb_object_agg(block_entries.block_value->>'id',(select jsonb_agg(case feature_name when'bold'then coalesce(run_entries.run_value->'bold','false'::jsonb)when'italic'then coalesce(run_entries.run_value->'italic','false'::jsonb)when'underline'then coalesce(run_entries.run_value->'underline','false'::jsonb)when'strike'then coalesce(run_entries.run_value->'strike','false'::jsonb)when'doubleStrike'then coalesce(run_entries.run_value->'doubleStrike','false'::jsonb)when'superscript'then coalesce(run_entries.run_value->'superscript','false'::jsonb)when'subscript'then coalesce(run_entries.run_value->'subscript','false'::jsonb)when'smallCaps'then coalesce(run_entries.run_value->'smallCaps','false'::jsonb)when'allCaps'then coalesce(run_entries.run_value->'allCaps','false'::jsonb)when'hidden'then coalesce(run_entries.run_value->'hidden','false'::jsonb)when'href:external'then case when coalesce(run_entries.run_value->>'href','')~'^(https?://|mailto:)'then run_entries.run_value->'href'else'null'::jsonb end when'href:internal'then case when coalesce(run_entries.run_value->>'href','')~'^#bookmark-'then run_entries.run_value->'href'else'null'::jsonb end else coalesce(run_entries.run_value->feature_name,'null'::jsonb)end order by run_entries.ordinality)from jsonb_array_elements(block_entries.block_value->'runs')with ordinality as run_entries(run_value,ordinality))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;
end $$;

-- Wrap-and-neutralize: validate + strip the new fields, then delegate to the
-- validator active immediately before this migration (currently the one
-- from migration 025, list-style-gallery).
alter function public.assert_word_efficiency_document_schema(jsonb,jsonb) rename to assert_word_efficiency_document_schema_before_font_dialog_and_layout_options;
create or replace function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare block_value jsonb;run_value jsonb;safe_document jsonb;
begin
 -- These new fields only exist in the schema-v2 editing model; a schema-v1
 -- document (older shape, no attrs/field/doubleStrike run metadata either)
 -- is passed straight through unchanged rather than risk injecting a key
 -- the v1 branch of the older validator would then reject as unknown.
 if document_snapshot->>'schemaVersion'<>'2'then perform public.assert_word_efficiency_document_schema_before_font_dialog_and_layout_options(document_snapshot,editor_capabilities);return;end if;
 for block_value in select value from jsonb_array_elements(document_snapshot->'blocks')loop
  if block_value->>'type'in('paragraph','list-item')then
   if block_value->'attrs'?'specialIndentMode'and(jsonb_typeof(block_value#>'{attrs,specialIndentMode}')<>'string'or block_value#>>'{attrs,specialIndentMode}'not in('none','firstLine','hanging'))then raise exception'Invalid special indent mode';end if;
   if block_value->'attrs'?'specialIndentAmount'and jsonb_typeof(block_value#>'{attrs,specialIndentAmount}')not in('string','null')then raise exception'Invalid special indent amount';end if;
   if jsonb_typeof(block_value#>'{attrs,specialIndentAmount}')='string'and length(block_value#>>'{attrs,specialIndentAmount}')>20 then raise exception'Invalid special indent amount';end if;
  end if;
  if block_value->>'type'='table'and block_value->'attrs'?'tableLayout'and(jsonb_typeof(block_value#>'{attrs,tableLayout}')<>'string'or block_value#>>'{attrs,tableLayout}'not in('auto','fixed','window'))then raise exception'Invalid table layout';end if;
  for run_value in select value from jsonb_array_elements(block_value->'runs')loop
   if run_value?'smallCaps'and jsonb_typeof(run_value->'smallCaps')<>'boolean'then raise exception'Invalid run mark';end if;
   if run_value?'allCaps'and jsonb_typeof(run_value->'allCaps')<>'boolean'then raise exception'Invalid run mark';end if;
   if run_value?'hidden'and jsonb_typeof(run_value->'hidden')<>'boolean'then raise exception'Invalid run mark';end if;
   if jsonb_typeof(run_value->'field')='string'and run_value->>'field'not in('page-number','date-time','symbol','special-character')and run_value->>'field'!~'^page-number\|(top|bottom|current)\|(left|center|right)$'then raise exception'Invalid document field';end if;
  end loop;
 end loop;
 select jsonb_set(document_snapshot,'{blocks}',jsonb_agg(jsonb_set(jsonb_set(blocks.block_item,'{runs}',(select jsonb_agg((runs.run_item-'smallCaps'-'allCaps'-'hidden')||jsonb_build_object('field',case when jsonb_typeof(runs.run_item->'field')='string'and runs.run_item->>'field'~'^page-number\|'then'"page-number"'::jsonb else coalesce(runs.run_item->'field','null'::jsonb)end)order by runs.run_ordinality)from jsonb_array_elements(blocks.block_item->'runs')with ordinality as runs(run_item,run_ordinality))),'{attrs}',coalesce(blocks.block_item->'attrs','{}'::jsonb)-'specialIndentMode'-'specialIndentAmount'-'tableLayout')order by blocks.block_ordinality))into safe_document from jsonb_array_elements(document_snapshot->'blocks')with ordinality as blocks(block_item,block_ordinality);
 perform public.assert_word_efficiency_document_schema_before_font_dialog_and_layout_options(safe_document,editor_capabilities);
end $$;

-- Full redefinition (not a wrap, per its own established convention),
-- mirroring migration 025's body exactly, extended with the new features.
create or replace function public.assert_word_efficiency_capability_changes(d jsonb,baseline jsonb,caps jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare operation_value jsonb;capability_rule record;is_enabled boolean;
begin
 if d->>'schemaVersion'='2'then for operation_value in select operation_entries.operation_item from jsonb_array_elements(d->'operations')as operation_entries(operation_item)loop if not public.word_efficiency_command_enabled(caps,operation_value#>>'{}')then raise exception'Disabled editor command %',operation_value#>>'{}';end if;end loop;end if;
 for capability_rule in select capability_rules.feature,capability_rules.commands from(values
  ('bold',array['bold']),('italic',array['italic']),('underline',array['underline']),('strike',array['strikeThrough']),('doubleStrike',array['textEffects']),('superscript',array['superscript']),('subscript',array['subscript']),('smallCaps',array['fontDialog']),('allCaps',array['fontDialog']),('hidden',array['fontDialog']),('fontFamily',array['fontName']),('fontSize',array['fontSize','increaseFontSize','decreaseFontSize']),('color',array['fontColor']),('highlight',array['highlightColor']),('alignment:left',array['alignLeft']),('alignment:center',array['alignCenter']),('alignment:right',array['alignRight']),('alignment:justify',array['justify']),
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

revoke all on function public.word_efficiency_default_editor_capabilities(),public.word_efficiency_document_feature(jsonb,text),public.assert_word_efficiency_document_schema_before_font_dialog_and_layout_options(jsonb,jsonb),public.assert_word_efficiency_document_schema(jsonb,jsonb),public.assert_word_efficiency_capability_changes(jsonb,jsonb,jsonb)from public,anon,authenticated;

commit;

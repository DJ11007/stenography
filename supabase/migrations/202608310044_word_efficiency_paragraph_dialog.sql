begin;

-- Adds a real MS-Word-style "Paragraph" dialog, reached from a corner
-- dialog-box launcher on the Paragraph ribbon group (matching the Font
-- group's launcher added in migration 040/043), with two tabs: "Indents
-- and Spacing" (alignment, left/right indent, special indent, space
-- before/after, line spacing) and "Line and Page Breaks" (don't hyphenate,
-- suppress line numbers for this paragraph). Every field in this dialog
-- writes to a block-level attrs/alignment value this schema already
-- validates (marginLeft/marginRight/lineHeight/marginTop/marginBottom/
-- specialIndentMode/specialIndentAmount/alignment/hyphens/lineNumbers) --
-- unlike the Character Spacing migration, no new document fields exist
-- here, so assert_word_efficiency_document_schema needs no new wrap.
--
-- This is a genuinely new ribbon command (paragraphDialog), unlike the
-- Font launcher move, so it needs the usual two things: added to the
-- default capability set (with backfill), and added as an alternate gate
-- alongside each feature's existing commands in
-- assert_word_efficiency_capability_changes -- otherwise a test where an
-- admin disabled e.g. increaseIndent/decreaseIndent but left
-- paragraphDialog enabled would have the dialog visibly work but then be
-- silently rejected at submission.

-- Full redefinition (this function has always been redefined wholesale, never wrapped).
create or replace function public.word_efficiency_default_editor_capabilities()
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
with commands(tab_name,group_name,command_name,supported)as(values
 ('Home','clipboard','undo',true),('Home','clipboard','redo',true),('Home','clipboard','paste',true),('Home','clipboard','cut',true),('Home','clipboard','copy',true),('Home','clipboard','formatPainter',true),
 ('Home','font','fontName',true),('Home','font','fontSize',true),('Home','font','increaseFontSize',true),('Home','font','decreaseFontSize',true),('Home','font','changeCase',true),('Home','font','bold',true),('Home','font','italic',true),('Home','font','underline',true),('Home','font','strikeThrough',true),('Home','font','subscript',true),('Home','font','superscript',true),('Home','font','textEffects',true),('Home','font','highlightColor',true),('Home','font','fontColor',true),('Home','font','fontDialog',true),
 ('Home','paragraph','bullets',true),('Home','paragraph','numbering',true),('Home','paragraph','multilevelList',true),('Home','paragraph','decreaseIndent',true),('Home','paragraph','increaseIndent',true),('Home','paragraph','sort',true),('Home','paragraph','formattingMarks',true),('Home','paragraph','alignLeft',true),('Home','paragraph','alignCenter',true),('Home','paragraph','alignRight',true),('Home','paragraph','justify',true),('Home','paragraph','lineSpacing',true),('Home','paragraph','shading',true),('Home','paragraph','borders',true),('Home','paragraph','paragraphDialog',true),
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
-- backfilled to the new capability shape, mirroring migrations 020/022/040
-- exactly -- otherwise assert_word_efficiency_editor_capabilities would
-- reject the now-stale cached shape as soon as anything touches it.
update public.word_efficiency_versions set editor_capabilities=public.word_efficiency_default_editor_capabilities();
update public.word_efficiency_attempts
set snapshot = jsonb_set(snapshot, '{editor_capabilities}', public.word_efficiency_default_editor_capabilities())
where snapshot ? 'editor_capabilities' and status not in ('submitted','completed');

-- Full redefinition (not a wrap, per its own established convention),
-- mirroring migration 043's body exactly, extended so paragraphDialog is
-- an alternate gate for every feature it can also change.
create or replace function public.assert_word_efficiency_capability_changes(d jsonb,baseline jsonb,caps jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare operation_value jsonb;capability_rule record;is_enabled boolean;
begin
 if d->>'schemaVersion'='2'then for operation_value in select operation_entries.operation_item from jsonb_array_elements(d->'operations')as operation_entries(operation_item)loop if not public.word_efficiency_command_enabled(caps,operation_value#>>'{}')then raise exception'Disabled editor command %',operation_value#>>'{}';end if;end loop;end if;
 for capability_rule in select capability_rules.feature,capability_rules.commands from(values
  ('bold',array['bold']),('italic',array['italic']),('underline',array['underline']),('strike',array['strikeThrough']),('doubleStrike',array['textEffects']),('superscript',array['superscript']),('subscript',array['subscript']),('smallCaps',array['fontDialog']),('allCaps',array['fontDialog']),('hidden',array['fontDialog']),('charScale',array['fontDialog']),('charSpacing',array['fontDialog']),('charPosition',array['fontDialog']),('kerningEnabled',array['fontDialog']),('kerningMin',array['fontDialog']),('fontFamily',array['fontName']),('fontSize',array['fontSize','increaseFontSize','decreaseFontSize']),('color',array['fontColor']),('highlight',array['highlightColor']),('alignment:left',array['alignLeft','paragraphDialog']),('alignment:center',array['alignCenter','paragraphDialog']),('alignment:right',array['alignRight','paragraphDialog']),('alignment:justify',array['justify','paragraphDialog']),
  ('list:bullet',array['bullets']),('list:bullet-disc',array['bullets']),('list:bullet-circle',array['bullets']),('list:bullet-square',array['bullets']),('list:bullet-diamond',array['bullets']),('list:bullet-arrow',array['bullets']),('list:bullet-check',array['bullets']),
  ('list:decimal',array['numbering','multilevelList']),('list:decimal-paren',array['numbering','multilevelList']),('list:upper-roman',array['numbering','multilevelList']),('list:upper-alpha',array['numbering','multilevelList']),('list:lower-alpha-paren',array['numbering','multilevelList']),('list:lower-alpha',array['numbering','multilevelList']),('list:lower-roman',array['numbering','multilevelList']),
  ('marginLeft',array['increaseIndent','decreaseIndent','paragraphDialog']),('marginRight',array['increaseIndent','decreaseIndent','paragraphDialog']),('lineHeight',array['lineSpacing','paragraphDialog']),('marginTop',array['lineSpacing','paragraphSpacing','paragraphDialog']),('marginBottom',array['lineSpacing','paragraphSpacing','paragraphDialog']),('specialIndentMode',array['lineSpacing','paragraphSpacing','paragraphDialog']),('specialIndentAmount',array['lineSpacing','paragraphSpacing','paragraphDialog']),('backgroundColor',array['shading']),('border',array['borders']),('hyphens',array['borders','shading','paragraphDialog']),('lineNumbers',array['lineNumbers','paragraphDialog']),('dropCap',array['dropCap']),('tableLayout',array['insertTable']),('href:external',array['hyperlink']),('href:internal',array['crossReference']),('bookmark',array['bookmark']),('field',array['pageNumber','dateTime','symbol']),('type:cover-page',array['coverPage']),('type:shape',array['shapes']),('type:header',array['header']),('type:footer',array['footer']),('type:section-break',array['sectionBreak']),('page:padding',array['margins']),('page:aspectRatio',array['orientation']),('page:maxWidth',array['pageSize']),('page:columnCount',array['columns']),('page:backgroundColor',array['pageColor']),('page:watermark',array['watermark']),('page:border',array['pageBorders'])
 )as capability_rules(feature,commands)loop
  if public.word_efficiency_document_feature(d,capability_rule.feature)is distinct from public.word_efficiency_document_feature(baseline,capability_rule.feature)then select coalesce(bool_or(public.word_efficiency_command_enabled(caps,command_entries.command_name)),false)into is_enabled from unnest(capability_rule.commands)as command_entries(command_name);if not is_enabled then raise exception'Disabled capability changed document feature %',capability_rule.feature;end if;end if;
 end loop;
 if public.word_efficiency_document_feature(d,'type:table')is distinct from public.word_efficiency_document_feature(baseline,'type:table')or public.word_efficiency_document_feature(d,'rows')is distinct from public.word_efficiency_document_feature(baseline,'rows')then if not public.word_efficiency_command_enabled(caps,'insertTable')then raise exception'Disabled table capability';end if;end if;
 if public.word_efficiency_document_feature(d,'type:image')is distinct from public.word_efficiency_document_feature(baseline,'type:image')or public.word_efficiency_document_feature(d,'src')is distinct from public.word_efficiency_document_feature(baseline,'src')then if not public.word_efficiency_command_enabled(caps,'insertPicture')and not public.word_efficiency_command_enabled(caps,'onlinePictures')then raise exception'Disabled image capability';end if;end if;
 if public.word_efficiency_document_feature(d,'type:page-break')is distinct from public.word_efficiency_document_feature(baseline,'type:page-break')or public.word_efficiency_document_feature(d,'kind')is distinct from public.word_efficiency_document_feature(baseline,'kind')then if not public.word_efficiency_command_enabled(caps,'pageBreak')and not public.word_efficiency_command_enabled(caps,'blankPage')then raise exception'Disabled page break capability';end if;end if;
end $$;

revoke all on function public.word_efficiency_default_editor_capabilities(),public.assert_word_efficiency_capability_changes(jsonb,jsonb,jsonb)from public,anon,authenticated;

commit;

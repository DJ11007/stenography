-- Word Efficiency: "Submission failed" on Hindi Word Test 7 (new paper, 24 Nov 2026) and possibly Test 8.
--
-- 1. PAGE LAYOUT > Hyphenation records the editor command "hyphenation" in the document, but no editor setting has
--    that name (the Hyphenation button is shown with Line Numbers), so assert_word_efficiency_capability_changes()
--    refused the document ("Disabled editor command hyphenation"): every autosave and the final submit failed from
--    the moment a student used it (Test 7 Q13 asks for it). "hyphenation" now counts as enabled when Line Numbers is.
--    The editor records "lineNumbers" for it from now on; documents already saved with "hyphenation" pass too.
-- 2. Every tool of the exam's tabs (HOME, INSERT, DESIGN, PAGE LAYOUT) is switched on in Hindi Word Tests 7 and 8's
--    current versions (in place: no new version, marking unchanged). Their settings were copied from older papers, and
--    the server refuses a document as soon as the effect of a switched-off tool is in it -- and it compares more than a
--    question asks for: formatting run by run (splitting a paragraph into runs changes every font feature of it), block
--    features per block (a header, footer or break is a new block), the page's aspect ratio (Page Setup > OK saves the
--    page size and orientation). E.g. Test 7 Q14 (Gutter) needs Page Size and Orientation, Q4 (Spacing Before) Line
--    Spacing, Q13 (Hyphenation) Borders or Shading, Q15 (Section Break) Page Break.
-- Safe to run twice.
begin;

create or replace function public.word_efficiency_command_enabled(c jsonb, command_name text)
returns boolean language sql immutable set search_path = pg_catalog, public as $$
select exists(
  select 1
  from jsonb_each(c->'tabs') as tab_entries(tab_name, tab_value)
  join lateral jsonb_each(tab_entries.tab_value->'groups') as group_entries(group_name, group_value) on true
  join lateral jsonb_each(group_entries.group_value->'options') as option_entries(option_name, option_value) on true
  -- PAGE LAYOUT > Hyphenation is part of Line Numbers in the editor settings.
  where option_entries.option_name = case when command_name = 'hyphenation' then 'lineNumbers' else command_name end
    and (tab_entries.tab_value->>'enabled')::boolean
    and (group_entries.group_value->>'enabled')::boolean
    and (option_entries.option_value#>>'{}')::boolean)
$$;

do $$
declare paper record; caps jsonb; tool text[];
begin
  for paper in
    select v.id, t.title, v.editor_capabilities, array[
        array['Home','clipboard','undo'], array['Home','clipboard','redo'], array['Home','clipboard','paste'],
        array['Home','clipboard','cut'], array['Home','clipboard','copy'], array['Home','clipboard','formatPainter'],
        array['Home','font','fontName'], array['Home','font','fontSize'], array['Home','font','increaseFontSize'],
        array['Home','font','decreaseFontSize'], array['Home','font','changeCase'], array['Home','font','bold'],
        array['Home','font','italic'], array['Home','font','underline'], array['Home','font','strikeThrough'],
        array['Home','font','subscript'], array['Home','font','superscript'], array['Home','font','textEffects'],
        array['Home','font','highlightColor'], array['Home','font','fontColor'], array['Home','font','fontDialog'],
        array['Home','paragraph','bullets'], array['Home','paragraph','numbering'],
        array['Home','paragraph','multilevelList'], array['Home','paragraph','decreaseIndent'],
        array['Home','paragraph','increaseIndent'], array['Home','paragraph','sort'],
        array['Home','paragraph','formattingMarks'], array['Home','paragraph','alignLeft'],
        array['Home','paragraph','alignCenter'], array['Home','paragraph','alignRight'],
        array['Home','paragraph','justify'], array['Home','paragraph','lineSpacing'],
        array['Home','paragraph','shading'], array['Home','paragraph','borders'],
        array['Home','paragraph','paragraphDialog'], array['Home','editing','find'], array['Home','editing','replace'],
        array['Home','editing','selectAll'], array['Insert','pages','coverPage'], array['Insert','pages','blankPage'],
        array['Insert','pages','pageBreak'], array['Insert','tables','insertTable'],
        array['Insert','headerFooter','header'], array['Insert','headerFooter','footer'],
        array['Insert','headerFooter','pageNumber'], array['Insert','text','dropCap'],
        array['Insert','text','dateTime'], array['Insert','symbols','symbol'], array['Insert','links','hyperlink'],
        array['Insert','links','bookmark'], array['Insert','links','crossReference'],
        array['Insert','illustrations','insertPicture'], array['Insert','illustrations','onlinePictures'],
        array['Insert','illustrations','shapes'], array['Design','pageBackground','watermark'],
        array['Design','pageBackground','pageColor'], array['Design','pageBackground','pageBorders'],
        array['Page Layout','pageSetup','margins'], array['Page Layout','pageSetup','orientation'],
        array['Page Layout','pageSetup','pageSize'], array['Page Layout','pageSetup','columns'],
        array['Page Layout','pageSetup','sectionBreak'], array['Page Layout','pageSetup','lineNumbers']] as tools
    from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id
    where t.language = 'Hindi' and t.title in ('EFFICIENCY TEST 7', 'EFFICIENCY TEST 8')
  loop
    caps := coalesce(paper.editor_capabilities, '{}'::jsonb);
    foreach tool slice 1 in array paper.tools loop
      caps := jsonb_set(caps, array['tabs'], coalesce(caps->'tabs', '{}'::jsonb));
      caps := jsonb_set(caps, array['tabs', tool[1]], coalesce(caps #> array['tabs', tool[1]], '{}'::jsonb) || '{"enabled": true}');
      caps := jsonb_set(caps, array['tabs', tool[1], 'groups'], coalesce(caps #> array['tabs', tool[1], 'groups'], '{}'::jsonb));
      caps := jsonb_set(caps, array['tabs', tool[1], 'groups', tool[2]], coalesce(caps #> array['tabs', tool[1], 'groups', tool[2]], '{}'::jsonb) || '{"enabled": true}');
      caps := jsonb_set(caps, array['tabs', tool[1], 'groups', tool[2], 'options'], coalesce(caps #> array['tabs', tool[1], 'groups', tool[2], 'options'], '{}'::jsonb));
      caps := jsonb_set(caps, array['tabs', tool[1], 'groups', tool[2], 'options', tool[3]], 'true');
    end loop;
    if caps is distinct from paper.editor_capabilities then
      update public.word_efficiency_versions set editor_capabilities = caps where id = paper.id;
    end if;
  end loop;
end $$;

-- Check: both tests' current versions allow Hyphenation (through Line Numbers) and the tools listed above.
select t.title,
       public.word_efficiency_command_enabled(v.editor_capabilities, 'hyphenation') hyphenation_allowed,
       (select string_agg(command, ', ') from unnest(array['fontDialog','lineSpacing','paragraphDialog','insertTable','pageBreak','margins','orientation','pageSize']) command
         where not public.word_efficiency_command_enabled(v.editor_capabilities, command)) still_off
  from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id
 where t.language = 'Hindi' and t.title in ('EFFICIENCY TEST 7', 'EFFICIENCY TEST 8')
 order by t.title;

commit;

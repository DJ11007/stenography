-- Hindi Word EFFICIENCY TEST 8, 9 and 10 (new papers, migration 202611251200): an attempt could not be started
-- ("Working Matter paragraph contains unknown fields"). The practice documents' list items broke two rules of the
-- server's practice-document check (assert_word_efficiency_working_matter, migration 202610211000): they carried a field
-- "numbered" it does not allow, and a paragraph number (a list item must have none). Both are corrected in the current
-- versions of Hindi Word Tests 7-10 wherever they occur (neither did anything: a list's style comes from its bullets),
-- in place -- no new version, marking and Model Answers unchanged.
-- Safe to run twice.
begin;

update public.word_efficiency_versions v
   set working_matter_snapshot = jsonb_set(v.working_matter_snapshot, '{paragraphs}',
         (select jsonb_agg(case when paragraph.value->>'type' = 'list-item' then jsonb_set(paragraph.value - 'numbered', '{paragraphNumber}', 'null')
                                else paragraph.value - 'numbered' end order by paragraph.ord)
            from jsonb_array_elements(v.working_matter_snapshot->'paragraphs') with ordinality as paragraph(value, ord)))
  from public.word_efficiency_tests t
 where t.current_version_id = v.id and t.language = 'Hindi'
   and t.title in ('EFFICIENCY TEST 7', 'EFFICIENCY TEST 8', 'EFFICIENCY TEST 9', 'EFFICIENCY TEST 10')
   and exists (select 1 from jsonb_array_elements(v.working_matter_snapshot->'paragraphs') paragraph
                where paragraph ? 'numbered' or (paragraph->>'type' = 'list-item' and jsonb_typeof(paragraph->'paragraphNumber') <> 'null'));

-- Check: each practice document now passes the server's own check (this raises, and nothing is saved, if one does not).
do $$
declare matter jsonb;
begin
  for matter in select v.working_matter_snapshot from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id
                 where t.language = 'Hindi' and t.title in ('EFFICIENCY TEST 7', 'EFFICIENCY TEST 8', 'EFFICIENCY TEST 9', 'EFFICIENCY TEST 10') loop
    perform public.assert_word_efficiency_working_matter(matter);
  end loop;
end $$;

select t.title, (select count(*) from jsonb_array_elements(v.working_matter_snapshot->'paragraphs') paragraph where paragraph ? 'numbered') numbered_fields_left
  from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id
 where t.language = 'Hindi' and t.title in ('EFFICIENCY TEST 7', 'EFFICIENCY TEST 8', 'EFFICIENCY TEST 9', 'EFFICIENCY TEST 10')
 order by t.title;

commit;

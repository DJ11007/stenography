-- Hindi Word EFFICIENCY TEST 8 (new paper): the Model Answer's merged table row ("RESULT SHEET", Q7) was saved with one
-- cell where its cell formatting has four (the editor counted the <td>s of the row instead of its grid -- fixed in the
-- editor on 26 Nov 2026; before the fix every save after Merge Cells was refused). The row gets its four slots
-- ("RESULT SHEET", "", "", ""), so the Model Answer is a valid document. Marking is unchanged (it reads the first cell).
-- Safe to run twice.
begin;

update public.word_efficiency_versions v
   set model_answer_snapshot = jsonb_set(v.model_answer_snapshot,
         array['blocks', (select (block.ord - 1)::text from jsonb_array_elements(v.model_answer_snapshot->'blocks') with ordinality as block(value, ord)
                           where block.value->>'type' = 'table' order by block.ord limit 1), 'attrs', 'rows', '0'],
         '["RESULT SHEET", "", "", ""]'::jsonb)
  from public.word_efficiency_tests t
 where t.current_version_id = v.id and t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 8'
   and exists (select 1 from jsonb_array_elements(v.model_answer_snapshot->'blocks') as block(value)
                where block.value->>'type' = 'table' and jsonb_array_length(block.value->'attrs'->'rows'->0) = 1
                  and block.value->'attrs'->'rows'->0->>0 = 'RESULT SHEET');

select t.title, (select block->'attrs'->'rows'->0 from jsonb_array_elements(v.model_answer_snapshot->'blocks') block where block->>'type' = 'table') first_row
  from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id = t.current_version_id
 where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 8';

commit;

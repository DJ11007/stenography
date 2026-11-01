-- Live Exam check (2026-11-01): two stored model answers were incomplete. Marking rules are not changed.
--   EXCEL EFFICIENCY TEST 2 (version 1866e1f0): cell J8 was stored as an empty {} (migration 202610311200 used it as a
--     fallback), which the sheet validator refuses, so the model answer could not be submitted as an attempt.
--   Hindi EFFICIENCY TEST 1 (version 69dbc0f2): the saved model answer had no footer (Q8, Q9) and no orange cell in
--     row 3, column 3 of the table (Q15), so it scored 19.92 instead of 25. Both are added, as in the 25/25 attempt.
-- Safe to run twice.
begin;

update public.excel_efficiency_versions
set model_answer_snapshot = model_answer_snapshot #- '{cells,J8}'
where id = '1866e1f0-35d3-45a1-9303-53e8c7a1e0cf' and model_answer_snapshot->'cells'->'J8' = '{}'::jsonb;

update public.word_efficiency_versions as v
set model_answer_snapshot = jsonb_set(v.model_answer_snapshot, array['blocks', t.idx::text, 'attrs', 'cellFormats', '2', '2', 'shading'], '"FFC000"')
from (select (i - 1)::int as idx from public.word_efficiency_versions w, jsonb_array_elements(w.model_answer_snapshot->'blocks') with ordinality e(b, i)
      where w.id = '69dbc0f2-9055-41d3-a88b-44a65d8f33c5' and b->>'type' = 'table' limit 1) as t
where v.id = '69dbc0f2-9055-41d3-a88b-44a65d8f33c5' and v.model_answer_snapshot->'blocks'->t.idx->'attrs'->'cellFormats'->2->2->>'shading' is null;

update public.word_efficiency_versions
set model_answer_snapshot = jsonb_set(model_answer_snapshot, '{blocks}', (model_answer_snapshot->'blocks') || jsonb_build_array($footer${"id":"block-21","type":"footer","alignment":"left","runs":[{"text":"4","bold":false,"italic":false,"underline":false,"underlineStyle":null,"underlineColor":null,"underlineThickness":null,"underlineWordsOnly":false,"strike":false,"doubleStrike":false,"superscript":false,"subscript":false,"smallCaps":false,"allCaps":false,"hidden":false,"outline":false,"emboss":false,"fontFamily":"Segoe UI","fontSize":12,"color":"020618","highlight":null,"charScale":null,"charSpacing":null,"charPosition":null,"kerningEnabled":false,"kerningMin":null,"href":null,"bookmark":null,"field":"page-number|current|left"},{"text":"\t","bold":false,"italic":false,"underline":false,"underlineStyle":null,"underlineColor":null,"underlineThickness":null,"underlineWordsOnly":false,"strike":false,"doubleStrike":false,"superscript":false,"subscript":false,"smallCaps":false,"allCaps":false,"hidden":false,"outline":false,"emboss":false,"fontFamily":"Segoe UI","fontSize":12,"color":"020618","highlight":null,"charScale":null,"charSpacing":null,"charPosition":null,"kerningEnabled":false,"kerningMin":null,"href":null,"bookmark":null,"field":null},{"text":"\tvf/kuLFk cksMZ","bold":false,"italic":false,"underline":false,"underlineStyle":null,"underlineColor":null,"underlineThickness":null,"underlineWordsOnly":false,"strike":false,"doubleStrike":false,"superscript":false,"subscript":false,"smallCaps":false,"allCaps":false,"hidden":false,"outline":false,"emboss":false,"fontFamily":"Kruti Dev 010","fontSize":22,"color":"020618","highlight":null,"charScale":null,"charSpacing":null,"charPosition":null,"kerningEnabled":false,"kerningMin":null,"href":null,"bookmark":null,"field":null}],"attrs":{}}$footer$::jsonb))
where id = '69dbc0f2-9055-41d3-a88b-44a65d8f33c5'
  and not exists (select 1 from jsonb_array_elements(model_answer_snapshot->'blocks') b where b->>'type' = 'footer');

commit;

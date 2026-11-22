-- Excel Efficiency paper fixes (22 Nov 2026). Existing marks are left as they are; new attempts use these rules.
-- 1. "Green Tab Color" (Test 8 Q14, Test 9 Q12) also accepts Green, Accent 6 (70AD47) -- the green of the theme row
--    many students click first -- besides standard Green and the darker Accent 6 shades.
-- 2. Test 8 Q15 asked for Percentage format on column L, which holds percentages as 75.75 (=K2/400*100): Percentage
--    format multiplies by 100 and showed 7575.00%. Q15 now asks for Number format with 2 decimal places (75.75), so
--    column L, Q2's grades (75 / 60 / 40) and the Result column stay as they are. The model answer follows.
update public.excel_efficiency_grading_rules g set additional_criteria = (
  select jsonb_agg(case when e->>'path' = 'tabColor' and not (e->'equals' ? '70AD47') then jsonb_set(e, '{equals}', (e->'equals') || '["70AD47"]') else e end order by ord)
  from jsonb_array_elements(g.additional_criteria) with ordinality as x(e, ord))
from public.excel_efficiency_questions q, public.excel_efficiency_tests t
where g.question_id = q.id and q.version_id = t.current_version_id and t.status = 'published' and t.language = 'English'
  and ((t.title = 'EFFICIENCY TEST 8' and q.question_number = 14) or (t.title = 'EFFICIENCY TEST 9' and q.question_number = 12))
  and g.additional_criteria::text like '%"tabColor"%';

do $$
declare v uuid; q uuid;
begin
  select t.current_version_id into v from public.excel_efficiency_tests t where t.title = 'EFFICIENCY TEST 8' and t.language = 'English' and t.status = 'published';
  if v is null then return; end if;
  select id into q from public.excel_efficiency_questions where version_id = v and question_number = 15;
  update public.excel_efficiency_questions set
    instruction = 'Apply Number Format with 2 decimal places to the Percentage column L2:L201.',
    solution = E'1. Select **L2:L201**.\n2. HOME > Number Format list > **Number** (or Ctrl+1 > Number > Number, Decimal places: 2).\n\nThe percentages then show as 75.75, 54.00 ... (Percentage format would multiply them by 100: 7575.00%).\n\nChecked: L2:L201, Number format with 2 decimal places.'
  where id = q;
  update public.excel_efficiency_grading_rules set additional_criteria = '[{"rule":"cells","props":{"decimals":[2],"numberFormat":["Number"]},"range":"L2:L201"}]'::jsonb where question_id = q;
  -- The model answer: column L in Number format, 2 decimal places.
  update public.excel_efficiency_versions ver set model_answer_snapshot = jsonb_set(ver.model_answer_snapshot, '{cells}',
    (select jsonb_object_agg(k, case when k ~ '^L([2-9]|[1-9][0-9]|1[0-9][0-9]|20[01])$' then (ver.model_answer_snapshot->'cells'->k) || '{"numberFormat":"Number","decimals":2}'::jsonb else ver.model_answer_snapshot->'cells'->k end)
     from jsonb_object_keys(ver.model_answer_snapshot->'cells') k))
  where ver.id = v and ver.model_answer_snapshot is not null;
end $$;

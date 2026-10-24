-- English EFFICIENCY TEST 1, Q3 and Q5 ("font colour red"): Dark Red (C00000) is accepted as well as
-- Red (FF0000). The Font Color button's default swatch was Dark Red (Word 2013's is Red, fixed in the
-- editor), so a student who clicked the button itself got C00000 and lost the question.
-- Only the colour criteria of these two rules change; running it again changes nothing.
begin;

update public.word_efficiency_grading_rules r
set additional_criteria=(
  select jsonb_agg(case
    when c.value->>'target' like '%.color' and c.value->>'expectedValue'='FF0000' and not coalesce(c.value->'alternatives','[]'::jsonb) ? 'C00000'
      then jsonb_set(c.value,'{alternatives}',coalesce(c.value->'alternatives','[]'::jsonb)||'["C00000"]'::jsonb)
    else c.value end order by c.ord)
  from jsonb_array_elements(r.additional_criteria) with ordinality c(value,ord))
where r.id in ('79ba4fc3-c906-43ec-b6b1-1a96a36e4e67','e380b213-99f7-4651-b4e2-7616076a6645');

commit;

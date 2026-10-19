-- EFFICIENCY TEST 1, Q5 "left side indent 1.23 and right side indent 1.63" gives no unit. Its key
-- expected centimetres (34.8696pt / 46.2024pt) while the editor's indent boxes now take inches, so a
-- student typing 1.23 / 1.63 as written got 0. Decision (2026-10-19): when a question gives no unit,
-- accept the value read in cm OR in inches -- 1.23" = 88.56pt, 1.63" = 117.36pt. Applied to live.
begin;
update public.word_efficiency_grading_rules
   set additional_criteria = (
     select jsonb_agg(case
       when c->>'target' = 'blocks.0.attrs.marginLeft' and c->>'expectedValue' = '34.8696pt' then c || '{"alternatives":["88.56pt"]}'::jsonb
       when c->>'target' = 'blocks.0.attrs.marginRight' and c->>'expectedValue' = '46.2024pt' then c || '{"alternatives":["117.36pt"]}'::jsonb
       else c end order by ord)
     from jsonb_array_elements(additional_criteria) with ordinality as x(c, ord))
 where id = 'e380b213-99f7-4651-b4e2-7616076a6645';
commit;

-- Excel Efficiency marking: a cell with Number / Currency / Accounting / Percentage / Scientific format but no stored
-- "decimals" now counts as 2 decimals -- what the sheet shows (lib/excel-sheet-model.ts formatCellValue). Choosing
-- "Accounting" from the Number Format list stored no decimals, so a sheet showing "₹ 1,000.00" got 0 marks for
-- "Accounting with the ₹ symbol and 2 decimal places" (Excel Efficiency Test 5, Q7). The app's port of this grader
-- (stenography-offline/src/lib/excel-efficiency-grading.ts) has the same change.
-- (Applied to production as migration "excel_cell_prop_default_decimals", 17 Nov 2026.)
CREATE OR REPLACE FUNCTION public.excel_efficiency_cell_prop(p_cell jsonb, p_key text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select case
  when p_key in ('bold','italic','underline','wrap','strike') then coalesce(case when jsonb_typeof(p_cell->p_key) = 'boolean' then p_cell->p_key end, 'false'::jsonb)
  when p_key = 'fontSize' then coalesce(case when jsonb_typeof(p_cell->'fontSize') = 'number' then p_cell->'fontSize' end, '11'::jsonb)
  when p_key = 'fontFamily' then coalesce(case when jsonb_typeof(p_cell->'fontFamily') = 'string' then p_cell->'fontFamily' end, '"Calibri"'::jsonb)
  when p_key = 'vAlign' then coalesce(case when jsonb_typeof(p_cell->'vAlign') = 'string' then p_cell->'vAlign' end, '"bottom"'::jsonb)
  when p_key in ('rotate','indent') then coalesce(case when jsonb_typeof(p_cell->p_key) = 'number' then p_cell->p_key end, '0'::jsonb)
  when p_key in ('fontColor','fillColor') then case when jsonb_typeof(p_cell->p_key) = 'string' then to_jsonb(upper(p_cell->>p_key)) else 'null'::jsonb end
  when p_key = 'decimals' then coalesce(case when jsonb_typeof(p_cell->'decimals') = 'number' then p_cell->'decimals' end,
       case when p_cell->>'numberFormat' in ('Number','Currency','Accounting','Percentage','Scientific') then '2'::jsonb else 'null'::jsonb end)
  else coalesce(p_cell->p_key, 'null'::jsonb) end
$function$;

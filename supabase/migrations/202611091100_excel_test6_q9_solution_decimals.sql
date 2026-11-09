-- EXCEL EFFICIENCY TEST 6, Q9 written solution: the example said "₹ 800" but a cell with 2 decimals shows "₹ 800.00".
-- Text only; safe to run twice.
update public.excel_efficiency_questions q
set solution = replace(q.solution, 'places: ₹ 800.' || chr(10), 'places: ₹ 800.00.' || chr(10))
from public.excel_efficiency_tests t
where t.slug = 'efficiency-test-6' and q.version_id = t.current_version_id and q.question_number = 9
  and q.solution not like '%₹ 800.00%';

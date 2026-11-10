-- EXCEL EFFICIENCY TEST 4, version 3: rewrite questions 14 and 15's instructions/solutions to use ribbon-only
-- steps (no right-click, no Ctrl+1/Ctrl+E) since those are disallowed during the real exam this practice paper
-- models, and to explain "0 decimal places" in plain language with an example. Pure wording fix: the grading
-- criteria and model answer are unchanged, so this does not affect the one existing attempt's score.
-- Safe to run twice (idempotent: sets the text to its final value either way).
begin;

update public.excel_efficiency_questions
set instruction = 'Give the sheet tab a Blue Tab Color, and Bold the Total column K2:K201.',
    solution = $sol$1. HOME → **Format ▾** (in the Cells group) → **Tab Color** → Standard Colors → **Blue**.
2. Select **K2:K201** and click HOME → **Bold**.

Checked: the tab colour is blue, and K2:K201 is bold.$sol$
where question_number = 14
  and version_id = (select id from public.excel_efficiency_versions where test_id = '48dd8076-8223-4887-a83e-4cdec34561fd' and version_number = 3);

update public.excel_efficiency_questions
set instruction = 'Apply Number Format with 0 decimal places (no digits after the decimal point) to the Typing Speed column J2:J201, and Center alignment to J2:J201.',
    solution = $sol$**Decimal places** means how many digits are shown after the decimal point (the dot). For example, with **2 decimal places** the number 27 would show as **27.00**; with **0 decimal places** it shows as plain **27** -- no dot, no digits after it at all. (A number like 27.8 would be rounded and shown as **28**.)
1. Select **J2:J201** (click J2, then drag down to J201, or click J2 then Shift-click J201).
2. HOME → the **Number Format** box (it shows "General") → choose **Number** from the list. This switches it to 2 decimal places by default.
3. Click the **Decrease Decimal** button in the Number group (the **.00 → .0** icon) **twice** to bring it down from 2 decimal places to 0.
4. With J2:J201 still selected, click HOME → **Center**.

Checked: J2:J201 with 0 decimals and centred.$sol$
where question_number = 15
  and version_id = (select id from public.excel_efficiency_versions where test_id = '48dd8076-8223-4887-a83e-4cdec34561fd' and version_number = 3);

commit;

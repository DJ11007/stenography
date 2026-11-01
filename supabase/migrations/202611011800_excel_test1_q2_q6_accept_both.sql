-- English EXCEL EFFICIENCY TEST 1 (version 8004a8fe), used in tonight's RSMSSB LDC Exam-2 (5 pm batch). Two rules made
-- fair to students. Safe to run twice.
--   Q6 "find the Total fee for offline classes" in I5 / I13 / I21 / I26: the admin's model answer adds every row
--      (=SUM(I2:I4) = 8999 ...), the wording says offline only (5000 + 1000 = 6000 ...). Both answers now get the marks.
--      I21 offline: offline course + offline typing = 6499, or every offline row (4999+900+1500+1000+100) = 8499.
--   Q2 (a) red, 14 pt on A28:L31 after Merge Across: the visible cell of each merged row is its A cell (as in Excel),
--      so A28:A31 is checked instead of every hidden cell of the range.
begin;

update public.excel_efficiency_grading_rules set additional_criteria = case id
  when 'bdbc1ca1-c1e1-4124-a3ce-01681d08c1ba' then '[{"rule":"anyOf","criteria":[{"rule":"value","cell":"I5","equals":8999},{"rule":"value","cell":"I5","equals":6000}]}]'::jsonb
  when 'e05f7aca-1440-493f-b653-47619d5c62e3' then '[{"rule":"anyOf","criteria":[{"rule":"value","cell":"I13","equals":12998},{"rule":"value","cell":"I13","equals":9999}]}]'::jsonb
  when '78b40032-2b76-4de3-a221-5d42de600522' then '[{"rule":"anyOf","criteria":[{"rule":"value","cell":"I21","equals":11498},{"rule":"value","cell":"I21","equals":6499},{"rule":"value","cell":"I21","equals":8499}]}]'::jsonb
  when '799c4746-4bc5-4df9-af4b-3acb3e733338' then '[{"rule":"anyOf","criteria":[{"rule":"value","cell":"I26","equals":10998},{"rule":"value","cell":"I26","equals":7999}]}]'::jsonb
  when '78a29bdb-0e47-4ee5-8f06-316e39bd97cc' then '[{"rule":"cells","range":"A28:A31","props":{"fontSize":[14],"fontColor":["FF0000"]}}]'::jsonb
end
where id in ('bdbc1ca1-c1e1-4124-a3ce-01681d08c1ba','e05f7aca-1440-493f-b653-47619d5c62e3','78b40032-2b76-4de3-a221-5d42de600522','799c4746-4bc5-4df9-af4b-3acb3e733338','78a29bdb-0e47-4ee5-8f06-316e39bd97cc')
  and version_id = '8004a8fe-5254-489b-b328-07d005b78029';

commit;

-- Word Efficiency tests: a student chooses 10, 15, 20, 25 or 30 minutes (the "Choose duration" list on
-- the test card, shown when a test allows more than one duration). Every current version allowed only
-- 10 minutes. Live (scheduled) tests keep their single duration, so a live exam stays the same length
-- for everyone. New tests start with the same five choices in the admin form.
begin;

update public.word_efficiency_versions v
set duration_options=array[600,900,1200,1500,1800]
from public.word_efficiency_tests t
where t.current_version_id=v.id
  and not t.is_live
  and v.duration_options is distinct from array[600,900,1200,1500,1800];

commit;

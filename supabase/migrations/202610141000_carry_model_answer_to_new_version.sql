begin;

-- Saving a test again (changing a title, a mark, an instruction...) creates a NEW immutable version.
-- That new version got the grading rules copied from the question editor but NOT the Model Answer,
-- so "Publish results automatically" stayed locked: its self-test runs the Model Answer through the
-- rules, found none, and reported 0 for every question.
--
-- A new version now inherits the most recent Model Answer of the same test when -- and only when --
-- its working document is exactly the same (the rules point at positions in that document, so a
-- changed document needs a fresh Model Answer).

create or replace function public.carry_word_efficiency_model_answer()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare previous jsonb;
begin
 if new.model_answer_snapshot is null then
  select older.model_answer_snapshot into previous
  from public.word_efficiency_versions as older
  where older.test_id=new.test_id and older.model_answer_snapshot is not null and older.working_matter_snapshot=new.working_matter_snapshot
  order by older.version_number desc limit 1;
  if previous is not null then new.model_answer_snapshot:=previous;end if;
 end if;
 return new;
end $$;

drop trigger if exists carry_word_efficiency_model_answer on public.word_efficiency_versions;
create trigger carry_word_efficiency_model_answer before insert on public.word_efficiency_versions
 for each row execute function public.carry_word_efficiency_model_answer();

-- One-time repair of versions already created without it: only versions that DO have grading rules
-- (a version whose Model Answer was deliberately reset has none, so it is left alone) and whose
-- working document is identical to an earlier version that has a Model Answer.
update public.word_efficiency_versions as target
set model_answer_snapshot=(
 select older.model_answer_snapshot from public.word_efficiency_versions as older
 where older.test_id=target.test_id and older.version_number<target.version_number and older.model_answer_snapshot is not null and older.working_matter_snapshot=target.working_matter_snapshot
 order by older.version_number desc limit 1)
where target.model_answer_snapshot is null
 and exists(select 1 from public.word_efficiency_grading_rules as rules where rules.version_id=target.id)
 and exists(select 1 from public.word_efficiency_versions as older where older.test_id=target.test_id and older.version_number<target.version_number and older.model_answer_snapshot is not null and older.working_matter_snapshot=target.working_matter_snapshot);

commit;

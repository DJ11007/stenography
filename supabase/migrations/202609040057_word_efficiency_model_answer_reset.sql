begin;

-- The admin asked for a Reset button on the Model Answer page, in case a
-- mistake is made while solving the paper -- one action that clears both
-- the saved model answer document and every grading rule generated from
-- it, so the admin can start the paper over from a clean slate.
--
-- Does NOT touch word_efficiency_question_scores for any already-submitted
-- student attempt: those are frozen at the moment they were graded (the
-- same standing rule every other test-attempt result on this platform
-- follows), so resetting the model answer only changes how FUTURE
-- submissions are graded -- it never rewrites a result a student has
-- already seen.
create or replace function public.reset_word_efficiency_model_answer(p_version_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if not exists(select 1 from public.word_efficiency_versions where id=p_version_id) then raise exception 'test version unavailable'; end if;
 delete from public.word_efficiency_grading_rules where version_id=p_version_id;
 update public.word_efficiency_versions set model_answer_snapshot=null where id=p_version_id;
end $$;

revoke all on function public.reset_word_efficiency_model_answer(uuid) from public,anon;
grant execute on function public.reset_word_efficiency_model_answer(uuid) to authenticated;

commit;

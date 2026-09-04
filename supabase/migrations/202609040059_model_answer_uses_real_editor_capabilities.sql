begin;

-- Real reported bug, traced live: Q8 asks the admin to set paragraph one to
-- "Bookman Old Style" at 18.5pt. Applying that font (via the Font Settings
-- dialog or the Font Name box -- both offer the full 60-font
-- APPROVED_WORD_FONTS list, which includes Bookman Old Style) made every
-- subsequent Model Answer autosave fail with "Save failed." -- reproduced
-- live with font size alone (18.5pt) working fine, and only the font-family
-- change causing the failure, isolating the real cause to fontFamily, not
-- fontSize.
--
-- save_word_efficiency_model_answer validated the document against
-- public.word_efficiency_default_editor_capabilities() -- a hardcoded
-- constant whose 'fonts' array only ever lists 5 basic fonts (Calibri
-- (Body), Calibri, Arial, Times New Roman, Mangal; see migration
-- 202608280040) -- instead of the version's own real, stored
-- editor_capabilities, which every real test version actually has (set via
-- recommendedWordEditorCapabilities() at test-creation time in
-- app/admin/word-efficiency-tests/actions.ts, whose 'fonts' array is the
-- FULL APPROVED_WORD_FONTS list of 60 fonts the client's Font Name box and
-- Font dialog both actually offer). Every other RPC that validates a
-- document -- autosave_word_efficiency_document, submit_word_efficiency_
-- document -- already reads the version's real editor_capabilities via
-- normalize_word_efficiency_editor_capabilities(version_rows.
-- editor_capabilities); save_word_efficiency_model_answer was the one
-- outlier still using the narrow hardcoded default, so any of the other 55
-- approved fonts (everything except those exact 5) failed Model Answer
-- autosave the moment it was applied, while the very same font worked fine
-- in a student's own attempt.
create or replace function public.save_word_efficiency_model_answer(p_version_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare version_record public.word_efficiency_versions%rowtype;effective_capabilities jsonb;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 select * into version_record from public.word_efficiency_versions where id=p_version_id;
 if not found then raise exception 'test version unavailable'; end if;
 effective_capabilities:=public.normalize_word_efficiency_editor_capabilities(version_record.editor_capabilities);
 perform public.assert_word_efficiency_document_schema(p_document,effective_capabilities);
 update public.word_efficiency_versions set model_answer_snapshot=p_document where id=p_version_id;
end $$;

revoke all on function public.save_word_efficiency_model_answer(uuid,jsonb) from public,anon;
grant execute on function public.save_word_efficiency_model_answer(uuid,jsonb) to authenticated;

commit;

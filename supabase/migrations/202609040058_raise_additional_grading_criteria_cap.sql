begin;

-- Real reported bug: saving a Model Answer question hit "invalid additional
-- grading criteria" -- assert_word_efficiency_additional_criteria's hard
-- cap of 20 array elements. Live reproduction traced the actual root cause
-- to a since-fixed bug (paragraph-level formatting leaking to an adjacent
-- block, and stale pt/in-unit-confused margin data) inflating the number
-- of detected changes past 20 for a question that shouldn't have had that
-- many at all -- but the 20-item cap itself is also a genuinely fragile
-- limit on its own: diffWordDocuments checks roughly 20 run-level fields
-- (bold/italic/underline/font/color/highlight/etc.) PER RUN, and a real
-- paragraph in an uploaded Working Matter document can easily have a dozen
-- or more separate runs (this exact test paper has one with 13) if the
-- admin's answer legitimately needs to restyle several properties across
-- such a paragraph, 20 total changes is easy to exceed with no leak or bug
-- involved at all.
--
-- Raised to 300 -- generous headroom for any realistic multi-run paragraph
-- (even 15 runs times every one of diffWordDocuments' ~20 checked fields
-- is under 300), while still bounded so a genuinely runaway diff (e.g. an
-- entire mismatched document being compared) is still rejected rather than
-- silently accepted.
create or replace function public.assert_word_efficiency_additional_criteria(criteria jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare item jsonb;
begin
 if jsonb_typeof(criteria)<>'array' or jsonb_array_length(criteria)>300 then raise exception 'invalid additional grading criteria'; end if;
 for item in select value from jsonb_array_elements(criteria) loop
  if jsonb_typeof(item)<>'object' or not(item?&array['target','expectedValue']) or exists(select 1 from jsonb_object_keys(item) k where k<>all(array['target','expectedValue'])) then raise exception 'invalid grading criterion'; end if;
  if jsonb_typeof(item->'target')<>'string' or char_length(item->>'target') not between 1 and 300 then raise exception 'invalid grading criterion target'; end if;
 end loop;
end $$;

-- Matches the original migration's security posture exactly: this helper
-- is revoked from every role and never granted back to anyone -- it's only
-- ever called from inside other security-definer functions
-- (save_word_efficiency_grading_rules, generate_...), which run with their
-- own elevated privileges regardless of who's allowed to call this helper
-- directly (no one).
revoke all on function public.assert_word_efficiency_additional_criteria(jsonb) from public,anon,authenticated;

commit;

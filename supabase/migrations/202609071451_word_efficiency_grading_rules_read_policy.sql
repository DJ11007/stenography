begin;

-- Real reported bug: the admin Model Answer page always showed every
-- question as unanswered after a page reload, even immediately after
-- successfully saving with "Saved. Qn is now auto-graded from your
-- answer." -- and every student attempt was landing at "still ungraded,
-- needs manual marking" despite grading rules having genuinely been
-- saved.
--
-- Root cause: word_efficiency_grading_rules has row level security
-- enabled (and an explicit `revoke all ... from public`) since the table
-- was created in 202608250014, but no policy was ever added for it --
-- unlike its sibling excel_efficiency_grading_rules, which has had
-- "AAL2 admins manage Excel grading rules" (202608260023) all along.
-- With RLS on and zero policies, ordinary PostgREST reads/writes
-- (supabase.from("word_efficiency_grading_rules")...) are rejected for
-- every role outright; only the SECURITY DEFINER RPCs
-- (save_word_efficiency_grading_rules, evaluate_word_efficiency_grading_rule,
-- prepare_word_efficiency_attempt, ...) could ever touch this table,
-- because they run as the function owner and so bypass RLS. So writes
-- through the admin UI's save action always silently succeeded (that RPC
-- still worked), but the same page's own direct read
-- (`supabase.from("word_efficiency_grading_rules").select(...)` in
-- app/admin/word-efficiency-tests/[testId]/model-answer/page.tsx and
-- app/admin/word-efficiency-tests/page.tsx) always came back empty --
-- this has been broken for every Word Efficiency test since the table
-- was created, not just this session.
create policy "AAL2 admins manage Word grading rules" on public.word_efficiency_grading_rules for all to authenticated using(public.is_aal2_admin()) with check(public.is_aal2_admin());

commit;

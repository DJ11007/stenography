-- Word Efficiency "words" rule: a paragraph with a drop cap is judged without the drop cap's own letter.
-- As in Word, the drop cap letter sits apart from its paragraph, so selecting the paragraph does not take it in.
-- Live Exam 10 (22 Nov 2026), Hindi Word Test 5: a student made paragraph 1's first letter a drop cap (Q6), then
-- selected the paragraph and gave it character spacing 2.3 (Q4). Every letter but the drop cap got 2.3, and the
-- rule wanted every letter, so Q4 got 0. Only that one letter is skipped; every other letter must still match.
-- Checked before applying: over 3,006 "words" checks on 14 days of real attempts, only that one result changes
-- (now passes; none newly fails); every test's model answer and untouched paper score as before.
do $$ declare d text; anchor text := E'   end loop;\n   run_start:=1;\n'; n int;
begin
 d := pg_get_functiondef('public.word_efficiency_rule_criterion_matches'::regproc);
 if position('dropCap'')::boolean,false) then masked:=' in d) > 0 then return; end if; -- already applied
 n := (length(d) - length(replace(d, anchor, ''))) / length(anchor);
 if n <> 1 then raise exception 'words-rule anchor found % times', n; end if;
 d := replace(d, anchor, E'   end loop;\n   -- A drop cap''s letter sits apart from its paragraph (as in Word): selecting the paragraph does not take it in,\n   -- so a paragraph-wide format is judged without that one letter.\n   if coalesce((block->''attrs''->>''dropCap'')::boolean,false) then masked:=regexp_replace(masked,''[[:alnum:]]'',chr(1)); end if;\n   run_start:=1;\n');
 execute d;
end $$;
drop function if exists public.zz_wrcm(jsonb, jsonb);

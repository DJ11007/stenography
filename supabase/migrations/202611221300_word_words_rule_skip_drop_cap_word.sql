-- Word "words" rule: a paragraph with a drop cap is judged without the drop cap's whole first word, not only its
-- first letter. A drop cap made with the paragraph (or its first word) selected drops the whole first word ("Video"),
-- and that word is not selected with its paragraph (as in Word), so a paragraph-wide format such as Character
-- Spacing never reaches it (Hindi Word Test 5 Q4 + Q6, 22 Nov 2026). Before applying, over 3,088 "words" checks on
-- 14 days of attempts: none newly fails; 13 newly pass, all Hindi Word Test 5 Q4 with the drop cap word "Video".
do $$ declare d text;
 old_line text := 'if coalesce((block->''attrs''->>''dropCap'')::boolean,false) then masked:=regexp_replace(masked,''[[:alnum:]]'',chr(1)); end if;';
 new_line text := 'if coalesce((block->''attrs''->>''dropCap'')::boolean,false) then masked:=repeat(chr(1),length(coalesce(substring(masked from ''^[^[:alnum:]]*[[:alnum:]]+''),'''')))||substr(masked,length(coalesce(substring(masked from ''^[^[:alnum:]]*[[:alnum:]]+''),''''))+1); end if;';
begin
 d := pg_get_functiondef('public.word_efficiency_rule_criterion_matches'::regproc);
 if position(new_line in d) > 0 then return; end if; -- already applied
 if position(old_line in d) = 0 then raise exception 'drop-cap line not found'; end if;
 execute replace(d, old_line, new_line);
end $$;
drop function if exists public.zz_wrcm(jsonb, jsonb);

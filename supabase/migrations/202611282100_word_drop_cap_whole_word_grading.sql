-- Hindi Word EFFICIENCY TEST 11, Q1 ("make paragraph 1 bold with a red wavy underline") gave 0 marks whenever the
-- student also did Q12 (a 3-line drop cap on the same paragraph), and full marks when Q1 was done alone (owner's
-- report, 28 Nov 2026, after RSMSSB LDC Live Exam 13).
--
-- Why: when the whole paragraph (or first word) is selected, the editor makes the whole first word the drop cap
-- ("राजस्थान"), saved as the paragraph's first run without the paragraph's formatting. The grader already leaves a
-- drop cap out of paragraph-wide checks, but it measured the drop cap as the first run of [[:alnum:]] characters,
-- and Hindi vowel signs and the virama (ा ् ...) are not [[:alnum:]]: only "र" was left out, so "ाजस्थान" counted as
-- an unformatted word of the paragraph. The same thing hit Q1 of Hindi Tests 15 and 18.
--
-- Fix: the drop cap is the paragraph's first run when that run is no longer than the first word; the part left out
-- is the longer of that and the old measure, so no answer is judged more strictly than before. Checked on every
-- saved answer that has a drop cap: every Model Answer scores the same; 47 student answers (Hindi Tests 11, 15, 18,
-- Q1 only) go from wrong to right, none from right to wrong.
--
-- Then gives Q1 its marks to every student of RSMSSB LDC Live Exam 13's Word section (Hindi Test 11), as the owner
-- asked: Q1 is marked again with the fixed grader (never lowered), and the attempt's total and the live exam's
-- section marks follow. Other attempts (practice attempts of Tests 11, 15, 18) keep their marks; they are graded by
-- the fixed rule only if marked again.
begin;

do $$
declare
  d text := pg_get_functiondef('public.word_efficiency_rule_criterion_matches'::regproc);
  old_line constant text := $o$if coalesce((block->'attrs'->>'dropCap')::boolean,false) then masked:=repeat(chr(1),length(coalesce(substring(masked from '^[^[:alnum:]]*[[:alnum:]]+'),'')))||substr(masked,length(coalesce(substring(masked from '^[^[:alnum:]]*[[:alnum:]]+'),''))+1); end if;$o$;
  new_line constant text := $n$if coalesce((block->'attrs'->>'dropCap')::boolean,false) then
    -- The drop cap is the paragraph's first run (as long as it is not longer than the first word). Hindi words
    -- carry vowel signs that are not [[:alnum:]], so measuring letters alone left most of the word in (Test 11 Q1).
    pos:=length(replace(coalesce(runs->0->>'text',''),chr(160),' '));
    if pos>length(coalesce(substring(masked from '^\s*\S+'),'')) then pos:=0;end if;
    pos:=greatest(pos,length(coalesce(substring(masked from '^[^[:alnum:]]*[[:alnum:]]+'),'')));
    masked:=repeat(chr(1),pos)||substr(masked,pos+1);
   end if;$n$;
begin
  if position('Hindi words' in d) > 0 then return; end if; -- already fixed
  if position(old_line in d) = 0 then raise exception 'word_efficiency_rule_criterion_matches: drop cap line not found'; end if;
  execute replace(d, old_line, new_line);
end $$;

create temporary table remarked (student text, old_marks numeric, new_marks numeric) on commit drop;

do $$
declare
  v_section constant uuid := 'e33b93ad-58e4-4c7c-9e3b-fde4375ec552'; -- RSMSSB LDC Live Exam 13, Word (Hindi Test 11)
  v_question constant uuid := '8bbea2cf-f8d2-4231-834f-ea1eb4bb7099'; -- Hindi Test 11 Q1
  a record; score record; awarded numeric; total numeric; maximum numeric; passing numeric;
begin
  for a in select w.id, w.version_id, w.final_document_snapshot doc, w.result, coalesce(p.full_name, w.student_id::text) name, sa.id section_attempt
           from public.live_exam_section_attempts sa
           join public.word_efficiency_attempts w on w.id = sa.attempt_id
           left join public.profiles p on p.id = w.student_id
           where sa.section_id = v_section and w.status = 'completed' and w.final_document_snapshot is not null loop
    select s.id, s.awarded_marks, s.maximum_marks into score from public.word_efficiency_question_scores s
     where s.attempt_id = a.id and s.question_id = v_question and s.graded_by is null;
    continue when score.id is null;
    awarded := greatest(score.awarded_marks, coalesce((public.word_efficiency_score_question(a.doc, a.version_id, v_question, score.maximum_marks,
                 (select model_answer_snapshot from public.word_efficiency_versions where id = a.version_id))).awarded, 0));
    continue when awarded = score.awarded_marks;
    update public.word_efficiency_question_scores set awarded_marks = awarded, grading_status = 'graded', updated_at = now() where id = score.id;
    select coalesce(sum(awarded_marks), 0) into total from public.word_efficiency_question_scores where attempt_id = a.id;
    maximum := coalesce(nullif(a.result->>'maximum_marks', '')::numeric, 25);
    passing := coalesce(nullif(a.result->>'passing_marks', '')::numeric, 9);
    update public.word_efficiency_attempts set result = coalesce(result, '{}'::jsonb) || jsonb_build_object(
        'marks', total, 'percentage', case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end, 'passed', total >= passing),
      updated_at = now()
     where id = a.id;
    update public.live_exam_section_attempts set marks = total where id = a.section_attempt;
    insert into remarked values (a.name, nullif(a.result->>'marks', '')::numeric, total);
  end loop;
end $$;

select student, old_marks, new_marks from remarked order by student;

commit;

begin;

-- Word Efficiency auto-grading: rules built from the FINISHED Model Answer.
--
-- Real reported case (EFFICIENCY TEST 1): the auto-grading check showed the
-- admin's own Model Answer earning 0 on all 13 questions, so no student could
-- ever be marked. Three causes, fixed together:
--
-- 1. Each question's rule froze the values present when that question was
--    saved. Later questions edit the same paragraphs (Change Case, a
--    Find & Replace that rewrites every paragraph), so earlier rules expected
--    text the finished paper no longer has. The Model Answer page now reads
--    every expected value from the finished document and keeps the value at
--    save time as an accepted ALTERNATIVE; text checks from questions that
--    changed wording (not letter case) may ask for a case-insensitive match.
-- 2. Stray blank paragraphs shifted every position. Rules now count
--    text-bearing paragraphs only (the Model Answer is saved without blank
--    paragraphs), and a v2 criterion is resolved against the paragraph that
--    holds the same place among text-bearing paragraphs in the student's
--    document FIRST, then at the exact position.
-- 3. A criterion like "marginLeft must be null" failed against "0pt": a
--    missing value, false, "", 0 and "0pt" now count as the same "off/zero".
--
-- New rules use expected_operation 'model-answer-match-v2' and keep every
-- criterion in additional_criteria; rules saved before this keep working
-- exactly as before ('model-answer-match' and every other operation are
-- evaluated by the unchanged path).
--
-- Also lifts "grading rules are immutable after an attempt is prepared":
-- since 202610111200 every automatic score can be re-graded (and each change
-- is recorded), and without lifting it a wrong rule could never be corrected
-- once one student had opened the test -- exactly this test's situation.
-- Already-saved scores only change when an admin presses Re-grade.

-- ---------------------------------------------------------------------------
-- 1. Criteria may carry "alternatives" (array) and "ignoreCase" (boolean)
-- ---------------------------------------------------------------------------
create or replace function public.assert_word_efficiency_additional_criteria(criteria jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare item jsonb;
begin
 if jsonb_typeof(criteria)<>'array' or jsonb_array_length(criteria)>300 then raise exception 'invalid additional grading criteria'; end if;
 for item in select value from jsonb_array_elements(criteria) loop
  if jsonb_typeof(item)<>'object' or not(item?&array['target','expectedValue']) or exists(select 1 from jsonb_object_keys(item) k where k<>all(array['target','expectedValue','alternatives','ignoreCase'])) then raise exception 'invalid grading criterion'; end if;
  if jsonb_typeof(item->'target')<>'string' or char_length(item->>'target') not between 1 and 300 then raise exception 'invalid grading criterion target'; end if;
  if item?'alternatives' and (jsonb_typeof(item->'alternatives')<>'array' or jsonb_array_length(item->'alternatives')>5) then raise exception 'invalid grading criterion alternatives'; end if;
  if item?'ignoreCase' and jsonb_typeof(item->'ignoreCase')<>'boolean' then raise exception 'invalid grading criterion ignoreCase'; end if;
 end loop;
end $$;
revoke all on function public.assert_word_efficiency_additional_criteria(jsonb) from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 2. Saving rules: keep alternatives/ignoreCase; allowed after attempts exist
-- ---------------------------------------------------------------------------
create or replace function public.save_word_efficiency_grading_rules(p_version_id uuid,p_rules jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare item jsonb;question_record public.word_efficiency_questions%rowtype;expected jsonb;criteria jsonb;criterion jsonb;parsed_value jsonb;built jsonb;
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 if jsonb_typeof(p_rules)<>'array'or jsonb_array_length(p_rules)>500 then raise exception'invalid grading rules';end if;
 delete from public.word_efficiency_grading_rules where version_id=p_version_id;
 for item in select value from jsonb_array_elements(p_rules)loop
  if jsonb_typeof(item)<>'object'or not(item?&array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks'])or exists(select 1 from jsonb_object_keys(item)k where k<>all(array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks','additionalCriteria']))then raise exception'invalid grading rule';end if;
  select*into question_record from public.word_efficiency_questions where version_id=p_version_id and question_number=(item->>'questionNumber')::integer;
  if not found then raise exception'grading rule question does not belong to version';end if;
  begin expected:=(item->>'expectedValue')::jsonb;exception when others then expected:=to_jsonb(item->>'expectedValue');end;
  if(item->>'allocatedMarks')::numeric>question_record.marks then raise exception'grading rule marks exceed question marks';end if;
  criteria:='[]'::jsonb;
  if item?'additionalCriteria' and jsonb_typeof(item->'additionalCriteria')='array' then
   for criterion in select value from jsonb_array_elements(item->'additionalCriteria') loop
    begin parsed_value:=(criterion->>'expectedValue')::jsonb; exception when others then parsed_value:=to_jsonb(criterion->>'expectedValue'); end;
    built:=jsonb_build_object('target',criterion->>'target','expectedValue',parsed_value);
    if criterion?'alternatives' then built:=built||jsonb_build_object('alternatives',criterion->'alternatives');end if;
    if criterion?'ignoreCase' then built:=built||jsonb_build_object('ignoreCase',criterion->'ignoreCase');end if;
    criteria:=criteria||jsonb_build_array(built);
   end loop;
  end if;
  perform public.assert_word_efficiency_additional_criteria(criteria);
  insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria)values(p_version_id,question_record.id,btrim(item->>'exactTarget'),btrim(item->>'expectedOperation'),coalesce(expected,'null'::jsonb),(item->>'allocatedMarks')::numeric,case when jsonb_typeof(item->'partialMarks')='null'then null else(item->>'partialMarks')::numeric end,criteria);
 end loop;
end$$;
revoke all on function public.save_word_efficiency_grading_rules(uuid,jsonb) from public,anon;
grant execute on function public.save_word_efficiency_grading_rules(uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. v2 matching
-- ---------------------------------------------------------------------------
-- "Off/zero" values that mean the same thing however the editor wrote them.
create or replace function public.word_efficiency_zeroish(value jsonb)
returns boolean language sql immutable set search_path=pg_catalog,public as $$
 select value is null or value='null'::jsonb or value='false'::jsonb or value='0'::jsonb or value='""'::jsonb or value='"0"'::jsonb or value='"0pt"'::jsonb or value='"0in"'::jsonb or value='"0px"'::jsonb
$$;

create or replace function public.word_efficiency_values_equivalent(actual jsonb,expected jsonb,ignore_case boolean)
returns boolean language sql immutable set search_path=pg_catalog,public as $$
 select actual is not distinct from expected
  or (public.word_efficiency_zeroish(actual) and public.word_efficiency_zeroish(expected))
  or (coalesce(ignore_case,false) and jsonb_typeof(actual)='string' and jsonb_typeof(expected)='string' and lower(actual#>>'{}')=lower(expected#>>'{}'))
$$;

-- One target at one exact path. Run text means the paragraph's whole text;
-- runs.<k>.<field> means the k-th run that has text (an empty run left
-- behind by the editor never shifts which run is meant).
create or replace function public.word_efficiency_criterion_matches_at(document jsonb,target text,expected jsonb,ignore_case boolean)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
declare parts text[];block_value jsonb;runs_value jsonb;candidate jsonb;joined text;
begin
 parts:=string_to_array(coalesce(target,''),'.');
 if coalesce(array_length(parts,1),0)=5 and parts[1]='blocks' and parts[3]='runs' and parts[2] ~ '^[0-9]+$' and parts[4] ~ '^[0-9]+$' then
  block_value:=(coalesce(document->'blocks','[]'::jsonb))->(parts[2]::integer);
  if block_value is null then return false;end if;
  runs_value:=case when jsonb_typeof(block_value->'runs')='array' then block_value->'runs' else '[]'::jsonb end;
  if parts[5]='text' then
   select string_agg(coalesce(run_item.value->>'text',''),'' order by run_item.ord)into joined from jsonb_array_elements(runs_value)with ordinality as run_item(value,ord);
   return public.word_efficiency_values_equivalent(to_jsonb(coalesce(joined,'')),expected,ignore_case);
  end if;
  select run_item.value into candidate from jsonb_array_elements(runs_value)with ordinality as run_item(value,ord) where btrim(coalesce(run_item.value->>'text',''))<>'' order by run_item.ord offset parts[4]::integer limit 1;
  if candidate is null then return false;end if;
  return public.word_efficiency_values_equivalent(candidate->parts[5],expected,ignore_case);
 end if;
 if parts[1]='blocks' and parts[2] ~ '^[0-9]+$' and (coalesce(document->'blocks','[]'::jsonb))->(parts[2]::integer) is null then return false;end if;
 return public.word_efficiency_values_equivalent(public.word_efficiency_grading_target_value(document,target),expected,ignore_case);
end $$;

-- The same place among text-bearing paragraphs (the Model Answer is saved
-- without blank paragraphs, so a rule's position IS that place).
create or replace function public.word_efficiency_content_rank_target(document jsonb,target text)
returns text language plpgsql immutable set search_path=pg_catalog,public as $$
declare parts text[];found_index integer;
begin
 parts:=string_to_array(coalesce(target,''),'.');
 if parts[1]<>'blocks' or coalesce(array_length(parts,1),0)<3 or parts[2] !~ '^[0-9]+$' then return target;end if;
 select ranked.ord-1 into found_index from(select block_item.ord,row_number()over(order by block_item.ord)as place from jsonb_array_elements(coalesce(document->'blocks','[]'::jsonb))with ordinality as block_item(value,ord) where public.word_efficiency_block_has_content(block_item.value))as ranked where ranked.place=parts[2]::integer+1;
 if found_index is null then return target;end if;
 parts[2]:=found_index::text;
 return array_to_string(parts,'.');
end $$;

create or replace function public.word_efficiency_criterion_matches(document jsonb,criterion jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
declare target text:=criterion->>'target';ranked text;ignore_case boolean:=coalesce((criterion->>'ignoreCase')::boolean,false);accepted jsonb;
begin
 if document is null or target is null then return false;end if;
 ranked:=public.word_efficiency_content_rank_target(document,target);
 for accepted in select criterion->'expectedValue' union all select value from jsonb_array_elements(case when jsonb_typeof(criterion->'alternatives')='array' then criterion->'alternatives' else '[]'::jsonb end) loop
  if public.word_efficiency_criterion_matches_at(document,ranked,accepted,ignore_case) then return true;end if;
  if ranked is distinct from target and public.word_efficiency_criterion_matches_at(document,target,accepted,ignore_case) then return true;end if;
 end loop;
 return false;
end $$;

-- ---------------------------------------------------------------------------
-- 4. evaluate: v2 rules need every criterion to match; others unchanged
-- ---------------------------------------------------------------------------
create or replace function public.evaluate_word_efficiency_grading_rule(final_document jsonb,target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric,additional_criteria jsonb default '[]'::jsonb,model_document jsonb default null)
returns numeric language plpgsql immutable set search_path=pg_catalog,public as $$
declare operation_applied boolean;criterion jsonb;all_additional_matched boolean:=true;
begin
 if expected_operation='model-answer-match-v2' then
  if jsonb_typeof(additional_criteria)<>'array' or jsonb_array_length(additional_criteria)=0 then return 0;end if;
  for criterion in select value from jsonb_array_elements(additional_criteria) loop
   if not public.word_efficiency_criterion_matches(final_document,criterion) then return 0;end if;
  end loop;
  return allocated_marks;
 end if;
 if expected_value is not null and public.word_efficiency_grading_target_matches(final_document,target,expected_value,model_document)then
  for criterion in select value from jsonb_array_elements(coalesce(additional_criteria,'[]'::jsonb)) loop
   if not public.word_efficiency_grading_target_matches(final_document,criterion->>'target',criterion->'expectedValue',model_document)then all_additional_matched:=false;exit;end if;
  end loop;
  if all_additional_matched then return allocated_marks;end if;
 end if;
 operation_applied:=exists(select 1 from jsonb_array_elements_text(coalesce(final_document->'operations','[]'::jsonb))as operation_value where operation_value=expected_operation);
 if operation_applied then return coalesce(partial_marks,0);end if;
 return 0;
end $$;

commit;

begin;

-- Word Efficiency grading: find a rule's block among blocks of its own kind.
--
-- EFFICIENCY TEST 2 asks for a header ("SAMRADHI CLASSES"). Inserting a header
-- puts a new block at the top of the document, so in the Model Answer
-- "paragraph 3" sat at position 4 -- but in the document of a student who
-- skipped the header (or added it last) it sits at position 3, and every
-- paragraph rule would read the wrong paragraph.
--
-- Rules built by the Model Answer page now say which block they mean as a kind
-- ('header', 'footer' or 'body') and a place among blocks of that kind
-- ("the 3rd body block"); grading looks the block up the same way in each
-- student's document. Criteria without kind/place (every rule saved before
-- this) are evaluated exactly as before. Safe to run more than once.

-- 1. Criteria may carry "kind" and "place"
create or replace function public.assert_word_efficiency_additional_criteria(criteria jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare item jsonb;
begin
 if jsonb_typeof(criteria)<>'array' or jsonb_array_length(criteria)>300 then raise exception 'invalid additional grading criteria'; end if;
 for item in select value from jsonb_array_elements(criteria) loop
  if jsonb_typeof(item)<>'object' or not(item?&array['target','expectedValue']) or exists(select 1 from jsonb_object_keys(item) k where k<>all(array['target','expectedValue','alternatives','ignoreCase','kind','place'])) then raise exception 'invalid grading criterion'; end if;
  if jsonb_typeof(item->'target')<>'string' or char_length(item->>'target') not between 1 and 300 then raise exception 'invalid grading criterion target'; end if;
  if item?'alternatives' and (jsonb_typeof(item->'alternatives')<>'array' or jsonb_array_length(item->'alternatives')>5) then raise exception 'invalid grading criterion alternatives'; end if;
  if item?'ignoreCase' and jsonb_typeof(item->'ignoreCase')<>'boolean' then raise exception 'invalid grading criterion ignoreCase'; end if;
  if item?'kind' and (jsonb_typeof(item->'kind')<>'string' or item->>'kind' not in('header','footer','body')) then raise exception 'invalid grading criterion kind'; end if;
  if item?'place' and (jsonb_typeof(item->'place')<>'number' or (item->>'place')::numeric<0 or (item->>'place')::numeric<>trunc((item->>'place')::numeric)) then raise exception 'invalid grading criterion place'; end if;
 end loop;
end $$;
revoke all on function public.assert_word_efficiency_additional_criteria(jsonb) from public,anon,authenticated;

-- 2. Saving rules keeps kind/place
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
    if criterion?'kind' then built:=built||jsonb_build_object('kind',criterion->'kind');end if;
    if criterion?'place' then built:=built||jsonb_build_object('place',criterion->'place');end if;
    criteria:=criteria||jsonb_build_array(built);
   end loop;
  end if;
  perform public.assert_word_efficiency_additional_criteria(criteria);
  insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria)values(p_version_id,question_record.id,btrim(item->>'exactTarget'),btrim(item->>'expectedOperation'),coalesce(expected,'null'::jsonb),(item->>'allocatedMarks')::numeric,case when jsonb_typeof(item->'partialMarks')='null'then null else(item->>'partialMarks')::numeric end,criteria);
 end loop;
end$$;
revoke all on function public.save_word_efficiency_grading_rules(uuid,jsonb) from public,anon;
grant execute on function public.save_word_efficiency_grading_rules(uuid,jsonb) to authenticated;

-- 3. The (place+1)-th block of a kind. Body blocks skip blank paragraphs, as
--    the Model Answer is saved without them; headers/footers count as written.
create or replace function public.word_efficiency_kind_rank_target(document jsonb,target text,block_kind text,block_place integer)
returns text language plpgsql immutable set search_path=pg_catalog,public as $$
declare parts text[];found_index integer;
begin
 parts:=string_to_array(coalesce(target,''),'.');
 if parts[1]<>'blocks' or coalesce(array_length(parts,1),0)<3 or parts[2] !~ '^[0-9]+$' then return target;end if;
 select ranked.ord-1 into found_index from(
  select block_item.ord,row_number()over(order by block_item.ord)as place
  from jsonb_array_elements(coalesce(document->'blocks','[]'::jsonb))with ordinality as block_item(value,ord)
  where case block_kind
   when 'header' then block_item.value->>'type'='header'
   when 'footer' then block_item.value->>'type'='footer'
   else coalesce(block_item.value->>'type','paragraph') not in('header','footer') and public.word_efficiency_block_has_content(block_item.value)
  end)as ranked where ranked.place=block_place+1;
 if found_index is null then return null;end if;
 parts[2]:=found_index::text;
 return array_to_string(parts,'.');
end $$;

-- 4. Criteria with kind/place are looked up that way (and only that way: the
--    exact position would point at a different block when a header is
--    missing). Others keep the previous behaviour.
create or replace function public.word_efficiency_criterion_matches(document jsonb,criterion jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
declare target text:=criterion->>'target';ranked text;ignore_case boolean:=coalesce((criterion->>'ignoreCase')::boolean,false);accepted jsonb;by_kind boolean:=criterion?'kind' and criterion?'place';
begin
 if document is null or target is null then return false;end if;
 if by_kind then
  ranked:=public.word_efficiency_kind_rank_target(document,target,criterion->>'kind',(criterion->>'place')::integer);
  if ranked is null then return false;end if;
 else
  ranked:=public.word_efficiency_content_rank_target(document,target);
 end if;
 for accepted in select criterion->'expectedValue' union all select value from jsonb_array_elements(case when jsonb_typeof(criterion->'alternatives')='array' then criterion->'alternatives' else '[]'::jsonb end) loop
  if public.word_efficiency_criterion_matches_at(document,ranked,accepted,ignore_case) then return true;end if;
  if not by_kind and ranked is distinct from target and public.word_efficiency_criterion_matches_at(document,target,accepted,ignore_case) then return true;end if;
 end loop;
 return false;
end $$;

commit;

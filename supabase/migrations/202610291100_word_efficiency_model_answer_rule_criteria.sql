-- Word Efficiency Model Answer: rules that do not depend on how the text happens to be split into runs, and
-- rules that survive saving another question.
--
-- 1. The Model Answer page used to write, for "highlight every word of paragraph 1", one criterion per run
--    ("blocks.0.runs.37.highlight"): a student who highlighted the paragraph in one go (a different run split)
--    scored 0, and a long paragraph could need more than the 300 criteria one rule may hold, so the question
--    could not be saved at all. It now writes {"rule":"words","kind":"body","place":0,"props":{"highlight":[...]}}
--    (migration 202610201200: every run holding a letter or digit has the props, however the runs are split).
-- 2. Saving the rules of a version replaces all of them, and the page sent only the questions it could show as
--    targets: every other rule (rule criteria, part marks) was deleted by the next save. The rules the page
--    does not rebuild are now sent back as they were, so this function stores a criterion that carries a "rule"
--    as it is (still checked by assert_word_efficiency_additional_criteria) and keeps a rule's part label.
-- Otherwise this is save_word_efficiency_grading_rules of migration 202610151200.
begin;

create or replace function public.save_word_efficiency_grading_rules(p_version_id uuid,p_rules jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare item jsonb;question_record public.word_efficiency_questions%rowtype;expected jsonb;criteria jsonb;criterion jsonb;parsed_value jsonb;built jsonb;
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 if jsonb_typeof(p_rules)<>'array'or jsonb_array_length(p_rules)>500 then raise exception'invalid grading rules';end if;
 delete from public.word_efficiency_grading_rules where version_id=p_version_id;
 for item in select value from jsonb_array_elements(p_rules)loop
  if jsonb_typeof(item)<>'object'or not(item?&array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks'])or exists(select 1 from jsonb_object_keys(item)k where k<>all(array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks','additionalCriteria','partLabel']))then raise exception'invalid grading rule';end if;
  select*into question_record from public.word_efficiency_questions where version_id=p_version_id and question_number=(item->>'questionNumber')::integer;
  if not found then raise exception'grading rule question does not belong to version';end if;
  begin expected:=(item->>'expectedValue')::jsonb;exception when others then expected:=to_jsonb(item->>'expectedValue');end;
  if(item->>'allocatedMarks')::numeric>question_record.marks then raise exception'grading rule marks exceed question marks';end if;
  criteria:='[]'::jsonb;
  if item?'additionalCriteria' and jsonb_typeof(item->'additionalCriteria')='array' then
   for criterion in select value from jsonb_array_elements(item->'additionalCriteria') loop
    if criterion?'rule' then criteria:=criteria||jsonb_build_array(criterion);continue;end if;
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
  insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria,part_label)values(p_version_id,question_record.id,btrim(item->>'exactTarget'),btrim(item->>'expectedOperation'),coalesce(expected,'null'::jsonb),(item->>'allocatedMarks')::numeric,case when jsonb_typeof(item->'partialMarks')='null'then null else(item->>'partialMarks')::numeric end,criteria,nullif(btrim(coalesce(item->>'partLabel','')),''));
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

revoke all on function public.save_word_efficiency_grading_rules(uuid,jsonb) from public,anon;
grant execute on function public.save_word_efficiency_grading_rules(uuid,jsonb) to authenticated;

commit;

-- Rule criteria for Word Efficiency grading. A model-answer criterion compares ONE saved value
-- ("blocks.3.runs.2.highlight" = "00FFFF"): runs are counted by position, so a question such as
-- "highlight every word of paragraph 1" or "format every 'Ajay sir' in the document" failed as
-- soon as a student's runs were split differently from the model's (one word at a time, or a
-- different order of work) -- correct answers scored 0. EFFICIENCY TEST 3 is built from such
-- questions, so a criterion can now carry a "rule" instead of a target:
--
--   {"rule":"words","kind":"body","place":0,"props":{...},"spaceProps":{...},"except":["ajay sir"]}
--      every run of the block(s) holding a letter/digit has props; with spaceProps, every run
--      holding a space has spaceProps (Word's "words only"); text matching an except phrase is
--      left out.
--   {"rule":"text","kind":"body","find":"ajay sir","minCount":5,"maxCount":5,"props":{...}}
--      every occurrence (case-insensitive) is covered only by runs with props; the number of
--      occurrences must lie between minCount (default 1) and maxCount.
--   {"rule":"run","kind":"footer","place":0,"props":{...}}      some run has props.
--   {"rule":"value","target":"pageLayout.border","spec":...}    one saved value matches spec
--      (with kind+place, a blocks.N target is found the way kind/place criteria find it).
--   {"rule":"table","place":0,"columns":5,"attrs":{...},"headerAt":{"3":"city"},
--    "cellProps":{...},"columnHeader":"city","nonEmptyOnly":true}
--   {"rule":"anyOf","criteria":[...]}                           any one criterion matches.
--
-- kind: body (paragraphs/tables with content, as kind/place criteria count them) | header |
-- footer | table | any; place: 0-based place among those blocks, omitted = every one.
-- A prop spec is a list of accepted values (null matches null/false/""), {"notIn":[...]} (a
-- set value not in the list), or {"regex":"..."} (case-insensitive). Only adds a criterion form;
-- every existing criterion (one with a target and no rule) is graded exactly as before.
begin;

create or replace function public.word_efficiency_prop_matches(actual jsonb, spec jsonb)
 returns boolean
 language plpgsql
 immutable
 set search_path to 'pg_catalog', 'public'
as $function$
declare item jsonb;
begin
 if jsonb_typeof(spec)='array' then
  for item in select value from jsonb_array_elements(spec) loop
   if public.word_efficiency_values_equivalent(actual,item,true) then return true;end if;
  end loop;
  return false;
 end if;
 if jsonb_typeof(spec)='object' and spec ? 'notIn' then
  if public.word_efficiency_zeroish(actual) then return false;end if;
  for item in select value from jsonb_array_elements(case when jsonb_typeof(spec->'notIn')='array' then spec->'notIn' else '[]'::jsonb end) loop
   if public.word_efficiency_values_equivalent(actual,item,true) then return false;end if;
  end loop;
  return true;
 end if;
 if jsonb_typeof(spec)='object' and spec ? 'regex' then
  return actual is not null and jsonb_typeof(actual) in ('string','number') and (actual#>>'{}') ~* (spec->>'regex');
 end if;
 return public.word_efficiency_values_equivalent(actual,spec,true);
end $function$;

create or replace function public.word_efficiency_props_match(item jsonb, props jsonb)
 returns boolean
 language sql
 immutable
 set search_path to 'pg_catalog', 'public'
as $function$
 select coalesce(bool_and(public.word_efficiency_prop_matches(item->spec.key,spec.value)),true)
 from jsonb_each(case when jsonb_typeof(props)='object' then props else '{}'::jsonb end) as spec
$function$;

create or replace function public.word_efficiency_rule_blocks(document jsonb, block_kind text, block_place integer)
 returns setof jsonb
 language sql
 immutable
 set search_path to 'pg_catalog', 'public'
as $function$
 select ranked.value from (
  select block_item.value,row_number() over (order by block_item.ord)-1 as place
  from jsonb_array_elements(case when jsonb_typeof(document->'blocks')='array' then document->'blocks' else '[]'::jsonb end) with ordinality as block_item(value,ord)
  where case coalesce(block_kind,'body')
   when 'header' then block_item.value->>'type'='header'
   when 'footer' then block_item.value->>'type'='footer'
   when 'table' then block_item.value->>'type'='table'
   when 'any' then true
   else coalesce(block_item.value->>'type','paragraph') not in ('header','footer') and public.word_efficiency_block_has_content(block_item.value)
  end) as ranked
 where block_place is null or ranked.place=block_place
 order by ranked.place
$function$;

create or replace function public.word_efficiency_rule_criterion_matches(document jsonb, criterion jsonb)
 returns boolean
 language plpgsql
 immutable
 set search_path to 'pg_catalog', 'public'
as $function$
declare
 rule_kind text:=criterion->>'rule';
 block jsonb;run jsonb;runs jsonb;sub jsonb;item jsonb;rows_value jsonb;formats jsonb;
 ranked text;joined text;folded text;masked text;needle text;piece text;
 pos integer;found integer;total integer:=0;run_start integer;run_len integer;header_col integer;
 any_block boolean:=false;
begin
 if document is null or rule_kind is null then return false;end if;
 if rule_kind='anyOf' then
  for sub in select value from jsonb_array_elements(case when jsonb_typeof(criterion->'criteria')='array' then criterion->'criteria' else '[]'::jsonb end) loop
   if public.word_efficiency_criterion_matches(document,sub) then return true;end if;
  end loop;
  return false;
 end if;
 if rule_kind='value' then
  ranked:=criterion->>'target';
  if criterion ? 'kind' and criterion ? 'place' then
   ranked:=public.word_efficiency_kind_rank_target(document,ranked,criterion->>'kind',(criterion->>'place')::integer);
   if ranked is null then return false;end if;
  end if;
  return public.word_efficiency_prop_matches(public.word_efficiency_grading_target_value(document,ranked),criterion->'spec');
 end if;
 if rule_kind='table' then
  select table_block into block from public.word_efficiency_rule_blocks(document,'table',coalesce((criterion->>'place')::integer,0)) as table_block limit 1;
  if block is null then return false;end if;
  rows_value:=block->'attrs'->'rows';formats:=block->'attrs'->'cellFormats';
  if jsonb_typeof(rows_value)<>'array' or jsonb_array_length(rows_value)=0 or jsonb_typeof(rows_value->0)<>'array' then return false;end if;
  if criterion ? 'columns' and jsonb_array_length(rows_value->0)<>(criterion->>'columns')::integer then return false;end if;
  if criterion ? 'attrs' and not public.word_efficiency_props_match(block->'attrs',criterion->'attrs') then return false;end if;
  if jsonb_typeof(criterion->'headerAt')='object' then
   for item in select jsonb_build_array(head.key,head.value) from jsonb_each_text(criterion->'headerAt') as head loop
    if lower(btrim(coalesce(rows_value->0->>((item->>0)::integer),'')))<>lower(btrim(item->>1)) then return false;end if;
   end loop;
  end if;
  if criterion ? 'cellProps' then
   if criterion ? 'columnHeader' then
    select (head.ord-1)::integer into header_col from jsonb_array_elements(rows_value->0) with ordinality as head(value,ord)
    where lower(btrim(head.value#>>'{}'))=lower(btrim(criterion->>'columnHeader')) order by head.ord limit 1;
    if header_col is null then return false;end if;
   end if;
   for r in 0..jsonb_array_length(rows_value)-1 loop
    for c in 0..coalesce(jsonb_array_length(case when jsonb_typeof(rows_value->r)='array' then rows_value->r else '[]'::jsonb end),0)-1 loop
     continue when header_col is not null and c<>header_col;
     continue when coalesce((criterion->>'nonEmptyOnly')::boolean,false) and btrim(coalesce(rows_value->r->>c,''))='';
     continue when coalesce(formats->r->c->>'merged','false')='true';
     if not public.word_efficiency_props_match(coalesce(formats->r->c,'{}'::jsonb),criterion->'cellProps') then return false;end if;
    end loop;
   end loop;
  end if;
  return true;
 end if;
 if rule_kind not in ('words','text','run') then return false;end if;
 for block in select rule_block from public.word_efficiency_rule_blocks(document,criterion->>'kind',(criterion->>'place')::integer) as rule_block loop
  any_block:=true;
  runs:=case when jsonb_typeof(block->'runs')='array' then block->'runs' else '[]'::jsonb end;
  if rule_kind='run' then
   for run in select value from jsonb_array_elements(runs) loop
    if public.word_efficiency_props_match(run,criterion->'props') then return true;end if;
   end loop;
   continue;
  end if;
  select coalesce(string_agg(coalesce(run_item.value->>'text',''),'' order by run_item.ord),'') into joined from jsonb_array_elements(runs) with ordinality as run_item(value,ord);
  joined:=replace(joined,chr(160),' ');
  folded:=lower(joined);
  if rule_kind='words' then
   masked:=joined;
   for item in select value from jsonb_array_elements(case when jsonb_typeof(criterion->'except')='array' then criterion->'except' else '[]'::jsonb end) loop
    needle:=lower(item#>>'{}');
    continue when coalesce(needle,'')='';
    pos:=0;
    loop
     found:=strpos(substr(folded,pos+1),needle);
     exit when found=0;
     pos:=pos+found;
     masked:=overlay(masked placing repeat(chr(1),length(needle)) from pos for length(needle));
     pos:=pos+length(needle)-1;
    end loop;
   end loop;
   run_start:=1;
   for run in select run_item.value from jsonb_array_elements(runs) with ordinality as run_item(value,ord) order by run_item.ord loop
    run_len:=length(replace(coalesce(run->>'text',''),chr(160),' '));
    piece:=substr(masked,run_start,run_len);
    run_start:=run_start+run_len;
    if piece ~ '[[:alnum:]]' and not public.word_efficiency_props_match(run,criterion->'props') then return false;end if;
    if criterion ? 'spaceProps' and piece ~ '[[:space:]]' and not public.word_efficiency_props_match(run,criterion->'spaceProps') then return false;end if;
   end loop;
   continue;
  end if;
  needle:=lower(replace(coalesce(criterion->>'find',''),chr(160),' '));
  if needle='' then return false;end if;
  pos:=0;
  loop
   found:=strpos(substr(folded,pos+1),needle);
   exit when found=0;
   pos:=pos+found;
   total:=total+1;
   if criterion ? 'props' then
    run_start:=1;
    for run in select run_item.value from jsonb_array_elements(runs) with ordinality as run_item(value,ord) order by run_item.ord loop
     run_len:=length(replace(coalesce(run->>'text',''),chr(160),' '));
     if run_len>0 and run_start<pos+length(needle) and pos<run_start+run_len and not public.word_efficiency_props_match(run,criterion->'props') then return false;end if;
     run_start:=run_start+run_len;
    end loop;
   end if;
   pos:=pos+length(needle)-1;
  end loop;
 end loop;
 if rule_kind='run' then return false;end if;
 if rule_kind='words' then return any_block;end if;
 return total>=coalesce((criterion->>'minCount')::integer,1) and (not criterion ? 'maxCount' or total<=(criterion->>'maxCount')::integer);
end $function$;

-- The rules table's shape check (valid_additional_criteria_shape) accepted target criteria only.
-- A rule criterion must name a known rule, use only known keys and stay small; anyOf holds at
-- most 5 criteria, each checked the same way. Target criteria are checked exactly as before.
create or replace function public.assert_word_efficiency_rule_criterion(item jsonb, depth integer)
 returns void
 language plpgsql
 immutable
 set search_path to 'pg_catalog', 'public'
as $function$
declare sub jsonb;
begin
 if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'rule')<>'string' or item->>'rule' not in ('words','text','run','value','table','anyOf') then raise exception 'invalid grading rule'; end if;
 if exists(select 1 from jsonb_object_keys(item) k where k<>all(array['rule','kind','place','props','spaceProps','except','find','minCount','maxCount','target','spec','columns','attrs','headerAt','cellProps','columnHeader','nonEmptyOnly','criteria'])) then raise exception 'invalid grading rule key'; end if;
 if char_length(item::text)>4000 then raise exception 'grading rule too long'; end if;
 if item?'kind' and (jsonb_typeof(item->'kind')<>'string' or item->>'kind' not in('header','footer','body','table','any')) then raise exception 'invalid grading rule kind'; end if;
 if item?'place' and (jsonb_typeof(item->'place')<>'number' or (item->>'place')::numeric<0 or (item->>'place')::numeric<>trunc((item->>'place')::numeric)) then raise exception 'invalid grading rule place'; end if;
 if item->>'rule'='value' and (jsonb_typeof(item->'target')<>'string' or char_length(item->>'target') not between 1 and 300) then raise exception 'invalid grading rule target'; end if;
 if item->>'rule'='text' and (jsonb_typeof(item->'find')<>'string' or char_length(item->>'find') not between 1 and 200) then raise exception 'invalid grading rule text'; end if;
 if item->>'rule'='anyOf' then
  if depth>2 or jsonb_typeof(item->'criteria')<>'array' or jsonb_array_length(item->'criteria') not between 1 and 5 then raise exception 'invalid grading rule alternatives'; end if;
  for sub in select value from jsonb_array_elements(item->'criteria') loop
   if sub?'rule' then perform public.assert_word_efficiency_rule_criterion(sub,depth+1);
   else perform public.assert_word_efficiency_additional_criteria(jsonb_build_array(sub)); end if;
  end loop;
 end if;
end $function$;

create or replace function public.assert_word_efficiency_additional_criteria(criteria jsonb)
 returns void
 language plpgsql
 immutable
 set search_path to 'pg_catalog', 'public'
as $function$
declare item jsonb;
begin
 if jsonb_typeof(criteria)<>'array' or jsonb_array_length(criteria)>300 then raise exception 'invalid additional grading criteria'; end if;
 for item in select value from jsonb_array_elements(criteria) loop
  if jsonb_typeof(item)='object' and item?'rule' then perform public.assert_word_efficiency_rule_criterion(item,0); continue; end if;
  if jsonb_typeof(item)<>'object' or not(item?&array['target','expectedValue']) or exists(select 1 from jsonb_object_keys(item) k where k<>all(array['target','expectedValue','alternatives','ignoreCase','kind','place'])) then raise exception 'invalid grading criterion'; end if;
  if jsonb_typeof(item->'target')<>'string' or char_length(item->>'target') not between 1 and 300 then raise exception 'invalid grading criterion target'; end if;
  if item?'alternatives' and (jsonb_typeof(item->'alternatives')<>'array' or jsonb_array_length(item->'alternatives')>5) then raise exception 'invalid grading criterion alternatives'; end if;
  if item?'ignoreCase' and jsonb_typeof(item->'ignoreCase')<>'boolean' then raise exception 'invalid grading criterion ignoreCase'; end if;
  if item?'kind' and (jsonb_typeof(item->'kind')<>'string' or item->>'kind' not in('header','footer','body')) then raise exception 'invalid grading criterion kind'; end if;
  if item?'place' and (jsonb_typeof(item->'place')<>'number' or (item->>'place')::numeric<0 or (item->>'place')::numeric<>trunc((item->>'place')::numeric)) then raise exception 'invalid grading criterion place'; end if;
 end loop;
end $function$;

create or replace function public.word_efficiency_criterion_matches(document jsonb, criterion jsonb)
 returns boolean
 language plpgsql
 immutable
 set search_path to 'pg_catalog', 'public'
as $function$
declare target text:=criterion->>'target';ranked text;ignore_case boolean:=coalesce((criterion->>'ignoreCase')::boolean,false);accepted jsonb;by_kind boolean:=criterion?'kind' and criterion?'place';
begin
 if criterion ? 'rule' then return public.word_efficiency_rule_criterion_matches(document,criterion);end if;
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
end $function$;

commit;

-- Rule criteria (migrations 202610201200, 202610241000, 202610251000): a text rule can match whole words only.
--   {"rule":"text","kind":"body","place":3,"find":"you","wholeWord":true,"props":{...}}
-- finds "you" / "You" but not the "you" inside "your", so a question about the word "you" does not also
-- demand the formatting on "your". Without it a text rule matches anywhere, exactly as before. The two
-- functions are the 202610251000 ones with this option added.
begin;

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
 numeric_col boolean;cur_text text;prev_text text;list_items integer;list_levels integer;
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
  if criterion ? 'rowCount' and jsonb_array_length(rows_value)<>(criterion->>'rowCount')::integer then return false;end if;
  if criterion ? 'sortedColumn' then
   header_col:=(criterion->>'sortedColumn')::integer;
   select coalesce(bool_and(btrim(coalesce(row_item.value->>header_col,''))='' or btrim(row_item.value->>header_col) ~ '^-?[0-9]+(\.[0-9]+)?$'),true) into numeric_col
   from jsonb_array_elements(rows_value) with ordinality as row_item(value,ord) where row_item.ord>1;
   for item in select row_item.value from jsonb_array_elements(rows_value) with ordinality as row_item(value,ord) where row_item.ord>1 order by row_item.ord loop
    cur_text:=btrim(coalesce(item->>header_col,''));
    continue when cur_text='';
    if prev_text is not null and (case when numeric_col then cur_text::numeric<prev_text::numeric else lower(cur_text)<lower(prev_text) end) then return false;end if;
    prev_text:=cur_text;
   end loop;
   if prev_text is null then return false;end if;
   header_col:=null;
  end if;
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
     continue when criterion ? 'onlyRow' and r<>(criterion->>'onlyRow')::integer;
     continue when criterion ? 'onlyColumn' and c<>(criterion->>'onlyColumn')::integer;
     continue when coalesce((criterion->>'nonEmptyOnly')::boolean,false) and btrim(coalesce(rows_value->r->>c,''))='';
     continue when coalesce(formats->r->c->>'merged','false')='true';
     if not public.word_efficiency_props_match(coalesce(formats->r->c,'{}'::jsonb),criterion->'cellProps') then return false;end if;
    end loop;
   end loop;
  end if;
  return true;
 end if;
 if rule_kind='list' then
  select count(*),count(distinct coalesce(list_item.value->'attrs'->>'listLevel','1')) into list_items,list_levels
  from jsonb_array_elements(case when jsonb_typeof(document->'blocks')='array' then document->'blocks' else '[]'::jsonb end) as list_item(value)
  where list_item.value->>'type'='list-item' and coalesce(list_item.value->'attrs'->>'listStyle','') like 'multilevel-%' and public.word_efficiency_block_has_content(list_item.value);
  return list_items>=coalesce((criterion->>'minItems')::integer,1) and list_levels>=coalesce((criterion->>'minLevels')::integer,1);
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
  folded:=case when coalesce((criterion->>'caseSensitive')::boolean,false) and rule_kind='text' then joined else lower(joined) end;
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
  needle:=replace(coalesce(criterion->>'find',''),chr(160),' ');
  if not coalesce((criterion->>'caseSensitive')::boolean,false) then needle:=lower(needle);end if;
  if needle='' then return false;end if;
  pos:=0;
  loop
   found:=strpos(substr(folded,pos+1),needle);
   exit when found=0;
   pos:=pos+found;
   if coalesce((criterion->>'wholeWord')::boolean,false) and ((pos>1 and substr(folded,pos-1,1) ~ '[[:alnum:]]') or substr(folded,pos+length(needle),1) ~ '[[:alnum:]]') then pos:=pos+length(needle)-1;continue;end if;
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

create or replace function public.assert_word_efficiency_rule_criterion(item jsonb, depth integer)
 returns void
 language plpgsql
 immutable
 set search_path to 'pg_catalog', 'public'
as $function$
declare sub jsonb;
begin
 if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'rule')<>'string' or item->>'rule' not in ('words','text','run','value','table','anyOf','list') then raise exception 'invalid grading rule'; end if;
 if exists(select 1 from jsonb_object_keys(item) k where k<>all(array['rule','kind','place','props','spaceProps','except','find','minCount','maxCount','target','spec','columns','attrs','headerAt','cellProps','columnHeader','nonEmptyOnly','criteria','wholeWord','rowCount','sortedColumn','onlyRow','onlyColumn','minItems','minLevels','caseSensitive'])) then raise exception 'invalid grading rule key'; end if;
 if char_length(item::text)>4000 then raise exception 'grading rule too long'; end if;
 if item?'kind' and (jsonb_typeof(item->'kind')<>'string' or item->>'kind' not in('header','footer','body','table','any')) then raise exception 'invalid grading rule kind'; end if;
 if item?'place' and (jsonb_typeof(item->'place')<>'number' or (item->>'place')::numeric<0 or (item->>'place')::numeric<>trunc((item->>'place')::numeric)) then raise exception 'invalid grading rule place'; end if;
 if exists(select 1 from unnest(array['rowCount','sortedColumn','onlyRow','onlyColumn','minItems','minLevels']) k where item?k and (jsonb_typeof(item->k)<>'number' or (item->>k)::numeric<0 or (item->>k)::numeric>1000 or (item->>k)::numeric<>trunc((item->>k)::numeric))) then raise exception 'invalid grading rule count'; end if;
 if item?'caseSensitive' and jsonb_typeof(item->'caseSensitive')<>'boolean' then raise exception 'invalid grading rule caseSensitive'; end if;
 if item?'wholeWord' and jsonb_typeof(item->'wholeWord')<>'boolean' then raise exception 'invalid grading rule wholeWord'; end if;
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

commit;

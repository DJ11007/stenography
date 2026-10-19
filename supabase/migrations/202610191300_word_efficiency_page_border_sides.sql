-- Word Efficiency grading: a page border's SIDES can be marked.
--
-- EFFICIENCY TEST 2, Q4(b) "Apply bottom and right page border only" had no rule, so Q4 was marked
-- on (a) and (c) alone (2.5 + 2.5): (b) could not gain or lose a mark. The page border is saved as
-- pageLayout.border = "<css>" (all four sides) or "<css> sides:right,bottom" (some sides), and the
-- css part depends on the style / colour / width the student picked, so an exact match on the
-- whole string would fail correct answers. A derived target, pageLayout.borderSides, gives just
-- the sides, sorted ("bottom,right"; all four = "bottom,left,right,top"; none = null).
--
-- Q4 is then split a 1.67 / b 1.67 / c 1.66, like the other questions.
begin;

create or replace function public.word_efficiency_page_border_sides(p_border text)
returns jsonb
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
  select case
    when p_border is null or btrim(p_border) = '' or p_border ~* '(^|\s)none(\s|$)' then null
    when p_border !~ ' sides:[a-z,]+$' then to_jsonb('bottom,left,right,top'::text)
    else (
      select to_jsonb(string_agg(distinct side, ',' order by side))
      from unnest(string_to_array(substring(p_border from ' sides:([a-z,]+)$'), ',')) as side
      where side in ('top', 'right', 'bottom', 'left')
    )
  end
$function$;

create or replace function public.word_efficiency_grading_target_value(document jsonb, target text)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
declare parts text[];value jsonb;segment text;index_value integer;
begin
 if document is null or target is null or target=''then return null;end if;
 parts:=string_to_array(target,'.');
 if parts[1]='pageLayout'then
  if parts[2]='borderSides' and coalesce(array_length(parts,1),0)=2 then
   return public.word_efficiency_page_border_sides(document->'pageLayout'->>'border');
  end if;
  value:=document->'pageLayout';
  for i in 2..coalesce(array_length(parts,1),1)loop if value is null then return null;end if;value:=value->parts[i];end loop;
  return value;
 end if;
 if parts[1]<>'blocks'or coalesce(array_length(parts,1),0)<3 then return null;end if;
 if parts[2] !~ '^[0-9]+$' then return null; end if;
 value:=(coalesce(document->'blocks','[]'::jsonb))->(parts[2]::integer);
 for i in 3..array_length(parts,1)loop
  if value is null then return null;end if;
  segment:=parts[i];
  if jsonb_typeof(value)='array'and segment~'^[0-9]+$'then index_value:=segment::integer;value:=value->index_value;
  elsif jsonb_typeof(value)='object'then value:=value->segment;
  else return null;end if;
 end loop;
 return value;
end $function$;

-- EFFICIENCY TEST 2 (version e5830d7a...), Q4: add part (b) and rebalance the parts.
insert into public.word_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
select 'e5830d7a-9bbb-4594-9a73-bc3dddc29305', '8768080b-cb58-4e01-85a9-08f031fc45f8', 'pageLayout.borderSides', 'model-answer-match-v2', to_jsonb('bottom,right'::text), 1.67, null,
  '[{"target":"pageLayout.borderSides","ignoreCase":false,"alternatives":[],"expectedValue":"bottom,right"}]'::jsonb, 'b'
where exists (select 1 from public.word_efficiency_grading_rules where version_id = 'e5830d7a-9bbb-4594-9a73-bc3dddc29305' and question_id = '8768080b-cb58-4e01-85a9-08f031fc45f8')
  and not exists (select 1 from public.word_efficiency_grading_rules where version_id = 'e5830d7a-9bbb-4594-9a73-bc3dddc29305' and question_id = '8768080b-cb58-4e01-85a9-08f031fc45f8' and part_label = 'b');

update public.word_efficiency_grading_rules set allocated_marks = 1.67
 where version_id = 'e5830d7a-9bbb-4594-9a73-bc3dddc29305' and question_id = '8768080b-cb58-4e01-85a9-08f031fc45f8' and part_label = 'a';
update public.word_efficiency_grading_rules set allocated_marks = 1.66
 where version_id = 'e5830d7a-9bbb-4594-9a73-bc3dddc29305' and question_id = '8768080b-cb58-4e01-85a9-08f031fc45f8' and part_label = 'c';

commit;

-- Word Efficiency grading: accept formatting applied to the words only.
--
-- A question like "highlight the entire words of the first paragraph, not all the text" is done in
-- Word with Find > Any Letter (^$) > Find In > Current Selection, then Highlight / Font Color: every
-- letter is formatted, the spaces and punctuation are not. The saved runs then alternate
-- word / space / word ..., while the rules (built from the model answer) look runs up by position
-- (blocks.1.runs.1 = the first "Guru"), so a correct answer scored 0 -- and broke the other
-- questions on that paragraph too.
--
-- Each rule is now also evaluated on a copy of the document in which runs with no letter or digit
-- (spaces, punctuation) are left out and neighbouring runs with the same formatting are joined.
-- A part gets the better of the two results, so this can only add marks, never take any away.
begin;

create or replace function public.word_efficiency_merge_word_runs(p_document jsonb)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
declare
  blocks jsonb := '[]'::jsonb;
  block jsonb;
  run jsonb;
  merged jsonb;
  last_run jsonb;
begin
  if p_document is null or jsonb_typeof(p_document->'blocks') <> 'array' then
    return p_document;
  end if;
  for block in select value from jsonb_array_elements(p_document->'blocks') loop
    if jsonb_typeof(block->'runs') = 'array' and jsonb_array_length(block->'runs') > 1 then
      merged := '[]'::jsonb;
      for run in select value from jsonb_array_elements(block->'runs') loop
        continue when coalesce(run->>'text', '') !~ '[[:alnum:]]';
        last_run := merged->-1;
        if last_run is not null and (last_run - 'text') = (run - 'text') then
          merged := jsonb_set(merged, array[(jsonb_array_length(merged) - 1)::text, 'text'],
            to_jsonb(coalesce(last_run->>'text', '') || ' ' || coalesce(run->>'text', '')));
        else
          merged := merged || jsonb_build_array(run);
        end if;
      end loop;
      if jsonb_array_length(merged) > 0 then
        block := jsonb_set(block, '{runs}', merged);
      end if;
    end if;
    blocks := blocks || jsonb_build_array(block);
  end loop;
  return jsonb_set(p_document, '{blocks}', blocks);
end
$function$;

create or replace function public.word_efficiency_score_question(p_document jsonb, p_version_id uuid, p_question_id uuid, p_maximum numeric, p_model jsonb, out awarded numeric, out parts jsonb)
returns record
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare rule record;earned numeric;total numeric:=0;total_allocated numeric:=0;has_parts boolean;words_document jsonb;
begin
 awarded:=null;parts:=null;
 words_document:=public.word_efficiency_merge_word_runs(p_document);
 select bool_or(grading_rules.part_label is not null) into has_parts from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=p_version_id and grading_rules.question_id=p_question_id;
 if has_parts is null then return;end if;
 if not has_parts then
  select grading_rules.* into rule from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=p_version_id and grading_rules.question_id=p_question_id order by grading_rules.created_at,grading_rules.id limit 1;
  awarded:=round(greatest(
    public.evaluate_word_efficiency_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria,p_model),
    public.evaluate_word_efficiency_grading_rule(words_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria,p_model)
  )*p_maximum/rule.allocated_marks,2);
  return;
 end if;
 parts:='[]'::jsonb;
 for rule in select grading_rules.* from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=p_version_id and grading_rules.question_id=p_question_id order by coalesce(grading_rules.part_label,''),grading_rules.created_at,grading_rules.id loop
  earned:=round(greatest(
    public.evaluate_word_efficiency_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria,p_model),
    public.evaluate_word_efficiency_grading_rule(words_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria,p_model)
  ),2);
  total:=total+earned;total_allocated:=total_allocated+rule.allocated_marks;
  parts:=parts||jsonb_build_object('label',coalesce(rule.part_label,''),'awarded',earned,'maximum',rule.allocated_marks);
 end loop;
 awarded:=case when total_allocated>0 then round(total*p_maximum/total_allocated,2) else 0 end;
end $function$;

commit;

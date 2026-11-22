-- Word Efficiency rules get "allOf" (every listed check must pass), so one alternative inside an "anyOf" can need two
-- things together. Used by Hindi Word Efficiency Test 4:
--  Q14 (page number from 4, right side): also accepted when the number 4 sits in a footer paragraph aligned right
--      (inserted at the left/current position, then the footer aligned right -- it shows on the right).
--  Q12 (date and time in the footer): also accepted as plain text "<date> <time>" (Insert > Date & Time without
--      "Update automatically" writes text, not a field), e.g. "14 November 2026 9:42 PM" or "10/30/2026 2:32 AM".
-- Checked before applying: the untouched paper meets neither new alternative; the model answer still scores full.
do $$ declare d text; anchor text := E' if rule_kind=''value'' then\n'; n int;
begin
 d := pg_get_functiondef('public.word_efficiency_rule_criterion_matches'::regproc);
 if position('rule_kind=''allOf''' in d) = 0 then
  n := (length(d) - length(replace(d, anchor, ''))) / length(anchor);
  if n <> 1 then raise exception 'value anchor found % times', n; end if;
  d := replace(d, anchor, E' if rule_kind=''allOf'' then\n  if jsonb_typeof(criterion->''criteria'')<>''array'' or jsonb_array_length(criterion->''criteria'')=0 then return false;end if;\n  for sub in select value from jsonb_array_elements(criterion->''criteria'') loop\n   if not public.word_efficiency_criterion_matches(document,sub) then return false;end if;\n  end loop;\n  return true;\n end if;\n' || anchor);
  execute d;
 end if;
 d := pg_get_functiondef('public.assert_word_efficiency_rule_criterion'::regproc);
 if position('''allOf''' in d) = 0 then
  if position('''anyOf'',''list'')' in d) = 0 or position('if item->>''rule''=''anyOf'' then' in d) = 0 then raise exception 'assert anchors missing'; end if;
  d := replace(d, '''anyOf'',''list'')', '''anyOf'',''allOf'',''list'')');
  d := replace(d, 'if item->>''rule''=''anyOf'' then', 'if item->>''rule'' in (''anyOf'',''allOf'') then');
  execute d;
 end if;
end $$;

-- Hindi Word Efficiency Test 4 (current version): Q12 and Q14 alternatives.
update public.word_efficiency_grading_rules g set additional_criteria = jsonb_set(g.additional_criteria, '{0,criteria}',
  (g.additional_criteria->0->'criteria') || '[{"kind":"footer","rule":"run","props":{"text":{"regex":"[0-9]{1,2}[ /.-]([A-Za-z]+|[0-9]{1,2})[ /.-][0-9]{4}.{0,3}[0-9]{1,2}:[0-9]{2}"}}}]'::jsonb)
from public.word_efficiency_questions q, public.word_efficiency_tests t
where g.question_id = q.id and q.version_id = t.current_version_id and t.id = 'd22b43e0-e756-4877-8786-7703eb0d541b' and q.question_number = 12
  and jsonb_array_length(g.additional_criteria->0->'criteria') = 2;
update public.word_efficiency_grading_rules g set additional_criteria = jsonb_set(g.additional_criteria, '{0,criteria}',
  (g.additional_criteria->0->'criteria') || '[{"rule":"allOf","criteria":[{"kind":"footer","rule":"run","props":{"text":{"regex":"^\\s*4\\s*$"},"field":{"regex":"^page-number\\|"}}},{"kind":"footer","rule":"value","spec":["right"],"place":0,"target":"blocks.0.alignment"}]}]'::jsonb)
from public.word_efficiency_questions q, public.word_efficiency_tests t
where g.question_id = q.id and q.version_id = t.current_version_id and t.id = 'd22b43e0-e756-4877-8786-7703eb0d541b' and q.question_number = 14
  and jsonb_array_length(g.additional_criteria->0->'criteria') = 2;

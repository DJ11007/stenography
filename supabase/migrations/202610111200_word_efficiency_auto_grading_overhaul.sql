begin;

-- Word Efficiency automatic grading, end to end -- rule-based, no AI.
--
-- The platform already scores each question at submit time from the rules the
-- Model Answer page generates. Four real problems stopped that being a hands-off
-- system, all addressed here:
--
-- 1. A rule reads ONE run of ONE paragraph (blocks.5.runs.0.text). Highlighting
--    only the first line of a paragraph (a different question) splits it into
--    several runs, so a perfectly done "capitalize paragraph six" scored 0 -- the
--    model answer itself failed its own Q3 rule. Matching is now tolerant: the
--    exact path is still tried first (nothing that scores today can stop scoring),
--    then the whole paragraph's text, then the k-th run that actually has text.
-- 2. Auto scores were copied at the rule's allocated_marks, not scaled to the
--    attempt's own question maximum, so after a test's marks were changed an
--    attempt could end up with awarded_marks above its maximum and fail to submit.
--    Scores are now scaled by maximum_marks / allocated_marks.
-- 3. Nothing published an auto-scored attempt: the student saw "Not graded" until
--    a teacher opened it and clicked Publish. Tests can now be switched to publish
--    automatically (only when the self-test below passes on every question).
-- 4. Published results were immutable. An admin can now adjust one question's
--    marks with a recorded reason, and re-grade attempts after fixing a rule.

-- ---------------------------------------------------------------------------
-- 1. Tolerant rule matching
-- ---------------------------------------------------------------------------
create or replace function public.word_efficiency_grading_target_matches(document jsonb,target text,expected jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
declare actual jsonb;parts text[];block_value jsonb;runs_value jsonb;prop text;run_position integer;candidate jsonb;joined text;
begin
 actual:=public.word_efficiency_grading_target_value(document,target);
 if actual is not distinct from expected then return true;end if;
 if expected is null then return false;end if;
 parts:=string_to_array(coalesce(target,''),'.');
 if coalesce(array_length(parts,1),0)<>5 or parts[1]<>'blocks' or parts[3]<>'runs' or parts[2] !~ '^[0-9]+$' or parts[4] !~ '^[0-9]+$' then return false;end if;
 block_value:=(coalesce(document->'blocks','[]'::jsonb))->(parts[2]::integer);
 runs_value:=coalesce(block_value->'runs','[]'::jsonb);
 if jsonb_typeof(runs_value)<>'array' then return false;end if;
 prop:=parts[5];run_position:=parts[4]::integer;
 if prop='text' then
  select string_agg(coalesce(run_item.value->>'text',''),'' order by run_item.ord)into joined from jsonb_array_elements(runs_value)with ordinality as run_item(value,ord);
  return joined is not null and to_jsonb(joined) is not distinct from expected;
 end if;
 select run_item.value into candidate from jsonb_array_elements(runs_value)with ordinality as run_item(value,ord) where btrim(coalesce(run_item.value->>'text',''))<>'' order by run_item.ord offset run_position limit 1;
 return candidate is not null and (candidate->prop) is not null and (candidate->prop) is not distinct from expected;
end $$;

create or replace function public.evaluate_word_efficiency_grading_rule(final_document jsonb,target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric,additional_criteria jsonb default '[]'::jsonb)
returns numeric language plpgsql immutable set search_path=pg_catalog,public as $$
declare operation_applied boolean;criterion jsonb;all_additional_matched boolean:=true;
begin
 if expected_value is not null and public.word_efficiency_grading_target_matches(final_document,target,expected_value) then
  for criterion in select value from jsonb_array_elements(coalesce(additional_criteria,'[]'::jsonb)) loop
   if not public.word_efficiency_grading_target_matches(final_document,criterion->>'target',criterion->'expectedValue') then all_additional_matched:=false;exit;end if;
  end loop;
  if all_additional_matched then return allocated_marks;end if;
 end if;
 operation_applied:=exists(select 1 from jsonb_array_elements_text(coalesce(final_document->'operations','[]'::jsonb))as operation_value where operation_value=expected_operation);
 if operation_applied then return coalesce(partial_marks,0);end if;
 return 0;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Grade-change history (every re-grade and admin adjustment is recorded)
-- ---------------------------------------------------------------------------
create table if not exists public.word_efficiency_grade_changes(
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.word_efficiency_attempts(id)on delete cascade,
 question_id uuid not null references public.word_efficiency_questions(id)on delete cascade,
 old_awarded numeric(8,2),
 new_awarded numeric(8,2),
 source text not null check(source in('regrade','override','auto_publish')),
 reason text not null check(char_length(btrim(reason))between 1 and 1000),
 changed_by uuid references public.profiles(id)on delete set null,
 changed_at timestamptz not null default now()
);
create index if not exists word_efficiency_grade_changes_attempt on public.word_efficiency_grade_changes(attempt_id,changed_at desc);
alter table public.word_efficiency_grade_changes enable row level security;
revoke all on table public.word_efficiency_grade_changes from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 3. Recompute a published attempt's totals after a score changed
-- ---------------------------------------------------------------------------
create or replace function public.word_efficiency_refresh_published_result(p_attempt_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare total_awarded numeric;maximum_total numeric;passing numeric;percentage numeric;
begin
 select coalesce(sum(score_rows.awarded_marks),0),sum(score_rows.maximum_marks)into total_awarded,maximum_total from public.word_efficiency_question_scores as score_rows where score_rows.attempt_id=p_attempt_id;
 select version_rows.passing_marks into passing from public.word_efficiency_attempts as attempt_rows join public.word_efficiency_versions as version_rows on version_rows.id=attempt_rows.version_id where attempt_rows.id=p_attempt_id;
 percentage:=case when maximum_total>0 then round(total_awarded*100/maximum_total,2)else 0 end;
 update public.word_efficiency_attempts as attempt_rows set result=attempt_rows.result||jsonb_build_object('marks',total_awarded,'maximum_marks',maximum_total,'percentage',percentage,'passed',case when passing is null then null else total_awarded>=passing end),updated_at=now()where attempt_rows.id=p_attempt_id and attempt_rows.result is not null;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Re-grade after fixing a rule (leaves human-graded scores alone)
-- ---------------------------------------------------------------------------
create or replace function public.regrade_word_efficiency_version(p_version_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_row record;rule record;score_row record;new_marks numeric;examined integer:=0;changed_scores integer:=0;
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 if not exists(select 1 from public.word_efficiency_versions as version_rows where version_rows.id=p_version_id)then raise exception'test version unavailable';end if;
 for attempt_row in select attempt_rows.id,attempt_rows.final_document_snapshot,attempt_rows.result from public.word_efficiency_attempts as attempt_rows where attempt_rows.version_id=p_version_id and attempt_rows.status in('submitted','completed')and attempt_rows.final_document_snapshot is not null and(attempt_rows.result is null or attempt_rows.evaluated_by is null)order by attempt_rows.id for update loop
  examined:=examined+1;
  for rule in select grading_rules.question_id,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks,grading_rules.additional_criteria from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=p_version_id loop
   select score_rows.id,score_rows.awarded_marks,score_rows.maximum_marks into score_row from public.word_efficiency_question_scores as score_rows where score_rows.attempt_id=attempt_row.id and score_rows.question_id=rule.question_id and score_rows.graded_by is null;
   if not found then continue;end if;
   new_marks:=round(public.evaluate_word_efficiency_grading_rule(attempt_row.final_document_snapshot,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria)*score_row.maximum_marks/rule.allocated_marks,2);
   if score_row.awarded_marks is distinct from new_marks then
    update public.word_efficiency_question_scores as score_rows set awarded_marks=new_marks,grading_status='graded',updated_at=now()where score_rows.id=score_row.id;
    insert into public.word_efficiency_grade_changes(attempt_id,question_id,old_awarded,new_awarded,source,reason,changed_by)values(attempt_row.id,rule.question_id,score_row.awarded_marks,new_marks,'regrade','Re-graded with the corrected grading rules',auth.uid());
    changed_scores:=changed_scores+1;
   end if;
  end loop;
  if attempt_row.result is not null then perform public.word_efficiency_refresh_published_result(attempt_row.id);end if;
 end loop;
 return jsonb_build_object('attemptsExamined',examined,'scoresChanged',changed_scores);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Admin adjustment of one question's marks (works on published results)
-- ---------------------------------------------------------------------------
create or replace function public.override_word_efficiency_question_marks(p_attempt_id uuid,p_question_id uuid,p_awarded numeric,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare score_row public.word_efficiency_question_scores%rowtype;attempt_row public.word_efficiency_attempts%rowtype;reason_text text:=btrim(coalesce(p_reason,''));
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 if char_length(reason_text)not between 3 and 500 then raise exception'a reason of 3 to 500 characters is required';end if;
 select attempt_rows.* into attempt_row from public.word_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id for update;
 if not found or attempt_row.status not in('submitted','completed')then raise exception'submitted attempt unavailable';end if;
 select score_rows.* into score_row from public.word_efficiency_question_scores as score_rows where score_rows.attempt_id=p_attempt_id and score_rows.question_id=p_question_id for update;
 if not found then raise exception'grading question does not belong to attempt';end if;
 if p_awarded is null or p_awarded<0 or p_awarded>score_row.maximum_marks then raise exception'awarded marks must be between 0 and the question maximum';end if;
 update public.word_efficiency_question_scores as score_rows set awarded_marks=round(p_awarded,2),graded_by=auth.uid(),graded_at=now(),grading_status='graded',teacher_comment=left('Marks adjusted by your teacher: '||reason_text,5000),updated_at=now()where score_rows.id=score_row.id;
 insert into public.word_efficiency_grade_changes(attempt_id,question_id,old_awarded,new_awarded,source,reason,changed_by)values(p_attempt_id,p_question_id,score_row.awarded_marks,round(p_awarded,2),'override',reason_text,auth.uid());
 if attempt_row.result is not null then perform public.word_efficiency_refresh_published_result(p_attempt_id);end if;
 return jsonb_build_object('status',case when attempt_row.result is not null then'published'else'pending'end);
end $$;

-- ---------------------------------------------------------------------------
-- 5b. Readable history of re-grades and adjustments for the admin screen
-- ---------------------------------------------------------------------------
create or replace function public.list_word_efficiency_grade_changes(p_attempt_id uuid)
returns table(question_number integer,old_awarded numeric,new_awarded numeric,source text,reason text,changed_by_name text,changed_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 return query select score_rows.question_number,change_rows.old_awarded,change_rows.new_awarded,change_rows.source,change_rows.reason,coalesce(profile_rows.full_name,profile_rows.email,'System')::text,change_rows.changed_at from public.word_efficiency_grade_changes as change_rows join public.word_efficiency_question_scores as score_rows on score_rows.attempt_id=change_rows.attempt_id and score_rows.question_id=change_rows.question_id left join public.profiles as profile_rows on profile_rows.id=change_rows.changed_by where change_rows.attempt_id=p_attempt_id order by change_rows.changed_at desc,score_rows.question_number;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Auto-grading self-test: every question needs a rule, and the model answer
--    must score FULL marks on each rule (otherwise a rule can never award them)
-- ---------------------------------------------------------------------------
create or replace function public.check_word_efficiency_auto_grading(p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare version_row public.word_efficiency_versions%rowtype;question_summary jsonb;all_ok boolean;
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 select version_rows.* into version_row from public.word_efficiency_tests as test_rows join public.word_efficiency_versions as version_rows on version_rows.id=test_rows.current_version_id where test_rows.id=p_test_id;
 if not found then raise exception'test version unavailable';end if;
 select coalesce(jsonb_agg(jsonb_build_object('number',question_rows_inner.question_number,'hasRule',question_rows_inner.rule_id is not null,'allocatedMarks',question_rows_inner.allocated_marks,'modelGets',question_rows_inner.model_gets,'ok',coalesce(question_rows_inner.model_gets=question_rows_inner.allocated_marks,false))order by question_rows_inner.question_number),'[]'::jsonb)into question_summary
 from(select question_rows.question_number,grading_rules.id as rule_id,grading_rules.allocated_marks,case when grading_rules.id is not null and version_row.model_answer_snapshot is not null then public.evaluate_word_efficiency_grading_rule(version_row.model_answer_snapshot,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks,grading_rules.additional_criteria)end as model_gets
  from public.word_efficiency_questions as question_rows left join public.word_efficiency_grading_rules as grading_rules on grading_rules.question_id=question_rows.id and grading_rules.version_id=version_row.id where question_rows.version_id=version_row.id)as question_rows_inner;
 all_ok:=jsonb_array_length(question_summary)>0 and not exists(select 1 from jsonb_array_elements(question_summary)as question_item where not(question_item->>'ok')::boolean);
 return jsonb_build_object('versionId',version_row.id,'hasModelAnswer',version_row.model_answer_snapshot is not null,'ready',version_row.model_answer_snapshot is not null and all_ok,'questions',question_summary);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Automatic publishing
-- ---------------------------------------------------------------------------
alter table public.word_efficiency_tests add column if not exists auto_publish_results boolean not null default false;

create or replace function public.set_word_efficiency_auto_publish(p_test_id uuid,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 if p_enabled and not coalesce((public.check_word_efficiency_auto_grading(p_test_id)->>'ready')::boolean,false)then
  raise exception'automatic publishing needs every question to have a grading rule that scores full marks on the saved model answer';
 end if;
 update public.word_efficiency_tests as test_rows set auto_publish_results=p_enabled where test_rows.id=p_test_id;
 if not found then raise exception'test unavailable';end if;
 return jsonb_build_object('autoPublish',p_enabled);
end $$;

create or replace function public.word_efficiency_auto_publish_attempt(p_attempt_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare total_awarded numeric;maximum_total numeric;passing numeric;percentage numeric;published_at timestamptz:=now();published boolean:=false;
begin
 if exists(select 1 from public.word_efficiency_question_scores as score_rows where score_rows.attempt_id=p_attempt_id and score_rows.awarded_marks is null)then return false;end if;
 update public.word_efficiency_question_scores as score_rows set teacher_comment=case when score_rows.awarded_marks>=score_rows.maximum_marks then'Full marks: the required change was found in your document.'when score_rows.awarded_marks<=0 then'No marks: the required change was not found in your document.'else'Partial marks: you used the right tool, but the result is different from what was asked.'end,updated_at=now()where score_rows.attempt_id=p_attempt_id and score_rows.teacher_comment is null and score_rows.graded_by is null;
 select coalesce(sum(score_rows.awarded_marks),0),sum(score_rows.maximum_marks)into total_awarded,maximum_total from public.word_efficiency_question_scores as score_rows where score_rows.attempt_id=p_attempt_id;
 select version_rows.passing_marks into passing from public.word_efficiency_attempts as attempt_rows join public.word_efficiency_versions as version_rows on version_rows.id=attempt_rows.version_id where attempt_rows.id=p_attempt_id;
 percentage:=case when maximum_total>0 then round(total_awarded*100/maximum_total,2)else 0 end;
 update public.word_efficiency_attempts as attempt_rows set evaluation_status='published',evaluated_at=published_at,result_published_at=published_at,result=jsonb_build_object('marks',total_awarded,'maximum_marks',maximum_total,'percentage',percentage,'passed',case when passing is null then null else total_awarded>=passing end,'passing_marks',passing,'evaluation_status','published','evaluated_at',published_at,'overall_feedback',null,'auto_graded',true),status='completed',updated_at=published_at where attempt_rows.id=p_attempt_id and attempt_rows.status='submitted'and attempt_rows.result is null;
 published:=found;
 return published;
end $$;

-- ---------------------------------------------------------------------------
-- 8. submit_word_efficiency_document: identical to the current version except
--    scores are scaled to the question's own maximum, and an attempt is
--    published automatically when its test has the switch on.
-- ---------------------------------------------------------------------------
create or replace function public.submit_word_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;effective_capabilities jsonb;baseline_document jsonb;rule record;
begin
 if not public.is_active_word_efficiency_student()then raise exception'active student account required';end if;
 select attempt_rows.* into attempt_record from public.word_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()for update;
 if not found or attempt_record.status<>'active'or attempt_record.started_at is null or attempt_record.final_document_snapshot is not null then raise exception'attempt unavailable or already submitted';end if;
 if now()>attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds+300)then raise exception'submission grace expired';end if;
 if attempt_record.original_document_snapshot is null then raise exception'attempt original document is invalid';end if;
 select public.normalize_word_efficiency_editor_capabilities(version_rows.editor_capabilities)into effective_capabilities from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;
 baseline_document:=case when p_document->>'schemaVersion'='1'and attempt_record.snapshot#>>'{initial_editor_document,schemaVersion}'='1'then attempt_record.snapshot->'initial_editor_document'else public.word_efficiency_initial_editor_document(attempt_record.original_document_snapshot)end;
 perform public.assert_word_efficiency_editor_capabilities(effective_capabilities);perform public.assert_word_efficiency_document_schema(baseline_document,effective_capabilities);
 if now()<=attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds)then
  perform public.assert_word_efficiency_document_schema(p_document,effective_capabilities);perform public.assert_word_efficiency_capability_changes(p_document,baseline_document,effective_capabilities);
 else
  if attempt_record.document_autosave is null or(p_document-'savedAt'-'operations')is distinct from(attempt_record.document_autosave-'savedAt'-'operations')then raise exception'post-deadline submission must match the last valid autosave';end if;
  perform public.assert_word_efficiency_document_schema(attempt_record.document_autosave,effective_capabilities);perform public.assert_word_efficiency_capability_changes(attempt_record.document_autosave,baseline_document,effective_capabilities);p_document:=attempt_record.document_autosave;
 end if;
 update public.word_efficiency_attempts as attempt_rows set document_autosave=p_document,final_document_snapshot=p_document,status='submitted',submitted_at=now(),updated_at=now()where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()and attempt_rows.status='active'and attempt_rows.final_document_snapshot is null;
 if not found then raise exception'attempt unavailable or already submitted';end if;
 for rule in select grading_rules.question_id,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks,grading_rules.additional_criteria from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=attempt_record.version_id loop
  update public.word_efficiency_question_scores as question_scores set awarded_marks=round(public.evaluate_word_efficiency_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria)*question_scores.maximum_marks/rule.allocated_marks,2),grading_status='graded',updated_at=now()where question_scores.attempt_id=p_attempt_id and question_scores.question_id=rule.question_id and question_scores.awarded_marks is null and question_scores.graded_by is null;
 end loop;
 if exists(select 1 from public.word_efficiency_tests as test_rows where test_rows.id=attempt_record.test_id and test_rows.auto_publish_results)then
  perform public.word_efficiency_auto_publish_attempt(p_attempt_id);
 end if;
end $$;

revoke all on function public.submit_word_efficiency_document(uuid,jsonb) from public,anon;
grant execute on function public.submit_word_efficiency_document(uuid,jsonb) to authenticated;
revoke all on function public.word_efficiency_refresh_published_result(uuid),public.word_efficiency_auto_publish_attempt(uuid) from public,anon,authenticated;
revoke all on function public.regrade_word_efficiency_version(uuid),public.override_word_efficiency_question_marks(uuid,uuid,numeric,text),public.check_word_efficiency_auto_grading(uuid),public.set_word_efficiency_auto_publish(uuid,boolean),public.list_word_efficiency_grade_changes(uuid) from public,anon;
grant execute on function public.regrade_word_efficiency_version(uuid),public.override_word_efficiency_question_marks(uuid,uuid,numeric,text),public.check_word_efficiency_auto_grading(uuid),public.set_word_efficiency_auto_publish(uuid,boolean),public.list_word_efficiency_grade_changes(uuid) to authenticated;

commit;

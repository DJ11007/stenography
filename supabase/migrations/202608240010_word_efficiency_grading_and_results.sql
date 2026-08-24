begin;

alter table public.word_efficiency_attempts
 add column evaluation_status text check(evaluation_status is null or evaluation_status in('draft','published')),
 add column overall_teacher_feedback text check(overall_teacher_feedback is null or char_length(overall_teacher_feedback)<=10000),
 add column private_teacher_note text check(private_teacher_note is null or char_length(private_teacher_note)<=10000),
 add column evaluated_by uuid references public.profiles(id)on delete restrict,
 add column evaluated_at timestamptz,
 add column result_published_at timestamptz;

create or replace function public.save_word_efficiency_grading(p_attempt_id uuid,p_payload jsonb,p_publish boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;score_item jsonb;score_record public.word_efficiency_question_scores%rowtype;score_count integer;payload_count integer;awarded numeric;total_awarded numeric;maximum_total numeric;passing numeric;percentage numeric;published_at timestamptz;
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object'or exists(select 1 from jsonb_object_keys(p_payload)as payload_keys(key_name)where payload_keys.key_name<>all(array['scores','overallFeedback','privateNote']))then raise exception'invalid grading payload';end if;
 if jsonb_typeof(p_payload->'scores')<>'array'or jsonb_array_length(p_payload->'scores')not between 1 and 500 then raise exception'invalid grading scores';end if;
 if jsonb_typeof(coalesce(p_payload->'overallFeedback','null'::jsonb))not in('string','null')or length(coalesce(p_payload->>'overallFeedback',''))>10000 or jsonb_typeof(coalesce(p_payload->'privateNote','null'::jsonb))not in('string','null')or length(coalesce(p_payload->>'privateNote',''))>10000 then raise exception'invalid grading feedback';end if;
 select attempt_rows.* into attempt_record from public.word_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id for update;
 if not found or attempt_record.status not in('submitted','completed')then raise exception'submitted attempt unavailable';end if;
 if attempt_record.evaluation_status='published'or attempt_record.result is not null then raise exception'published result is immutable';end if;
 select count(*)into score_count from public.word_efficiency_question_scores as score_rows where score_rows.attempt_id=p_attempt_id;
 payload_count:=jsonb_array_length(p_payload->'scores');if payload_count<>score_count then raise exception'every question score is required';end if;
 if(select count(distinct score_values.score_item->>'questionId')from jsonb_array_elements(p_payload->'scores')as score_values(score_item))<>payload_count then raise exception'duplicate grading question';end if;
 for score_item in select score_values.score_value from jsonb_array_elements(p_payload->'scores')as score_values(score_value)loop
  if jsonb_typeof(score_item)<>'object'or not(score_item?&array['questionId','awardedMarks','feedback','privateNote'])or exists(select 1 from jsonb_object_keys(score_item)as score_keys(key_name)where score_keys.key_name<>all(array['questionId','awardedMarks','feedback','privateNote']))then raise exception'invalid question grading row';end if;
  select score_rows.* into score_record from public.word_efficiency_question_scores as score_rows where score_rows.attempt_id=p_attempt_id and score_rows.question_id=(score_item->>'questionId')::uuid for update;
  if not found then raise exception'grading question does not belong to attempt';end if;
  if jsonb_typeof(score_item->'awardedMarks')='null'then awarded:=null;elsif jsonb_typeof(score_item->'awardedMarks')='number'then awarded:=(score_item->>'awardedMarks')::numeric;else raise exception'invalid awarded marks';end if;
  if awarded is not null and(awarded<0 or awarded>score_record.maximum_marks)then raise exception'awarded marks exceed question maximum';end if;
  if p_publish and awarded is null then raise exception'all questions must be graded before publishing';end if;
  if jsonb_typeof(score_item->'feedback')not in('string','null')or length(coalesce(score_item->>'feedback',''))>5000 or jsonb_typeof(score_item->'privateNote')not in('string','null')or length(coalesce(score_item->>'privateNote',''))>5000 then raise exception'invalid question feedback';end if;
  update public.word_efficiency_question_scores as score_rows set awarded_marks=awarded,teacher_comment=nullif(btrim(score_item->>'feedback'),''),grading_note_snapshot=nullif(btrim(score_item->>'privateNote'),''),grading_status=case when awarded is null then'ungraded'when p_publish then'graded'else'in_progress'end,graded_by=case when awarded is null then null else auth.uid()end,graded_at=case when awarded is null then null else now()end,updated_at=now()where score_rows.id=score_record.id;
 end loop;
 select coalesce(sum(score_rows.awarded_marks),0),sum(score_rows.maximum_marks)into total_awarded,maximum_total from public.word_efficiency_question_scores as score_rows where score_rows.attempt_id=p_attempt_id;
 select version_rows.passing_marks into passing from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;
 percentage:=case when maximum_total>0 then round(total_awarded*100/maximum_total,2)else 0 end;
 if p_publish then
  published_at:=now();
  update public.word_efficiency_attempts as attempt_rows set evaluation_status='published',overall_teacher_feedback=nullif(btrim(p_payload->>'overallFeedback'),''),private_teacher_note=nullif(btrim(p_payload->>'privateNote'),''),evaluated_by=auth.uid(),evaluated_at=published_at,result_published_at=published_at,result=jsonb_build_object('marks',total_awarded,'maximum_marks',maximum_total,'percentage',percentage,'passed',case when passing is null then null else total_awarded>=passing end,'passing_marks',passing,'evaluation_status','published','evaluated_at',published_at,'overall_feedback',nullif(btrim(p_payload->>'overallFeedback'),'')),status='completed',updated_at=published_at where attempt_rows.id=p_attempt_id and attempt_rows.status='submitted'and attempt_rows.result is null;
  if not found then raise exception'attempt result could not be published';end if;
 else
  update public.word_efficiency_attempts as attempt_rows set evaluation_status='draft',overall_teacher_feedback=nullif(btrim(p_payload->>'overallFeedback'),''),private_teacher_note=nullif(btrim(p_payload->>'privateNote'),''),evaluated_by=auth.uid(),evaluated_at=now(),updated_at=now()where attempt_rows.id=p_attempt_id and attempt_rows.status='submitted'and attempt_rows.result is null;
 end if;
 return jsonb_build_object('status',case when p_publish then'published'else'draft'end,'marks',case when p_publish then total_awarded else null end,'maximum_marks',maximum_total,'percentage',case when p_publish then percentage else null end);
end $$;

create or replace function public.get_word_efficiency_attempt_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;version_record public.word_efficiency_versions%rowtype;result_rows jsonb;is_published boolean;
begin
 if not public.is_active_word_efficiency_student()then raise exception'active student account required';end if;
 select attempt_rows.* into attempt_record from public.word_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid();if not found or attempt_record.status not in('submitted','completed')then raise exception'attempt result unavailable';end if;
 select version_rows.* into version_record from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;if not found then raise exception'test version unavailable';end if;
 is_published:=attempt_record.result is not null and(attempt_record.evaluation_status='published'or attempt_record.status='completed');
 if is_published then select coalesce(jsonb_agg(jsonb_build_object('number',score_rows.question_number,'instruction',question_rows.instruction,'maximumMarks',score_rows.maximum_marks,'awardedMarks',score_rows.awarded_marks,'feedback',score_rows.teacher_comment,'gradingStatus',case when score_rows.awarded_marks is null then'not_graded'else'graded'end)order by question_rows.display_order),'[]'::jsonb)into result_rows from public.word_efficiency_question_scores as score_rows join public.word_efficiency_questions as question_rows on question_rows.id=score_rows.question_id where score_rows.attempt_id=p_attempt_id;else result_rows:='[]'::jsonb;end if;
 return jsonb_build_object('title',attempt_record.snapshot->>'title','language',attempt_record.snapshot->>'language','status',case when is_published then'published'else'pending'end,'submittedAt',attempt_record.submitted_at,'evaluatedAt',case when is_published then attempt_record.result_published_at end,'maximumMarks',version_record.maximum_marks,'marksObtained',case when is_published then attempt_record.result->'marks'else null end,'percentage',case when is_published then attempt_record.result->'percentage'else null end,'passingMarks',case when is_published then to_jsonb(version_record.passing_marks)else null end,'passed',case when is_published then attempt_record.result->'passed'else null end,'overallFeedback',case when is_published then attempt_record.overall_teacher_feedback end,'questions',result_rows);
end $$;

revoke all on function public.save_word_efficiency_grading(uuid,jsonb,boolean),public.get_word_efficiency_attempt_result(uuid)from public;
do $$begin if exists(select 1 from pg_catalog.pg_roles as role_rows where role_rows.rolname='authenticated')then execute'revoke all on function public.save_word_efficiency_grading(uuid,jsonb,boolean),public.get_word_efficiency_attempt_result(uuid) from authenticated';execute'grant execute on function public.save_word_efficiency_grading(uuid,jsonb,boolean),public.get_word_efficiency_attempt_result(uuid) to authenticated';end if;end$$;

commit;

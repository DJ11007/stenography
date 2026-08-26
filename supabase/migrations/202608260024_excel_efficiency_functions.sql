begin;

-- Cell shape shared by the working-matter (schema 1) and editor (schema 2)
-- documents: {value, formula, bold, italic, underline, fontColor, fillColor,
-- border, numberFormat, align}. Cell refs are bounded to columns A-Z and
-- rows 1-200 -- generous for the small exam-style sheets this tool targets.
create or replace function public.assert_excel_efficiency_cells(cells jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare cell_ref text;cell_value jsonb;cell_count integer:=0;
begin
 if jsonb_typeof(cells)<>'object' then raise exception 'Sheet cells must be an object'; end if;
 for cell_ref,cell_value in select * from jsonb_each(cells) loop
  cell_count:=cell_count+1; if cell_count>5000 then raise exception 'Sheet has too many cells'; end if;
  if cell_ref!~'^[A-Z]{1,2}[0-9]{1,3}$' then raise exception 'Invalid cell reference %',cell_ref; end if;
  if jsonb_typeof(cell_value)<>'object' or not(cell_value?&array['value','formula','bold','italic','underline','fontColor','fillColor','border','numberFormat','align']) or exists(select 1 from jsonb_object_keys(cell_value) as cell_keys(key_name) where cell_keys.key_name<>all(array['value','formula','bold','italic','underline','fontColor','fillColor','border','numberFormat','align'])) then raise exception 'Invalid cell fields at %',cell_ref; end if;
  if jsonb_typeof(cell_value->'value') not in('string','number','null') or (jsonb_typeof(cell_value->'value')='string' and length(cell_value->>'value')>1000) then raise exception 'Invalid cell value at %',cell_ref; end if;
  if jsonb_typeof(cell_value->'formula') not in('string','null') or (jsonb_typeof(cell_value->'formula')='string' and(length(cell_value->>'formula')>200 or cell_value->>'formula' !~ '^=[A-Za-z0-9():,+\-*/.\s]{0,200}$')) then raise exception 'Invalid formula at %',cell_ref; end if;
  if jsonb_typeof(cell_value->'bold')<>'boolean' or jsonb_typeof(cell_value->'italic')<>'boolean' or jsonb_typeof(cell_value->'underline')<>'boolean' then raise exception 'Invalid cell style flags at %',cell_ref; end if;
  if jsonb_typeof(cell_value->'fontColor') not in('string','null') or(jsonb_typeof(cell_value->'fontColor')='string' and cell_value->>'fontColor' !~ '^[0-9A-Fa-f]{6}$') then raise exception 'Invalid font color at %',cell_ref; end if;
  if jsonb_typeof(cell_value->'fillColor') not in('string','null') or(jsonb_typeof(cell_value->'fillColor')='string' and cell_value->>'fillColor' !~ '^[0-9A-Fa-f]{6}$') then raise exception 'Invalid fill color at %',cell_ref; end if;
  if jsonb_typeof(cell_value->'border') not in('string','null') or(jsonb_typeof(cell_value->'border')='string' and length(cell_value->>'border')>50) then raise exception 'Invalid border at %',cell_ref; end if;
  if jsonb_typeof(cell_value->'numberFormat') not in('string','null') or(jsonb_typeof(cell_value->'numberFormat')='string' and cell_value->>'numberFormat' not in('General','Number','Currency','Percentage')) then raise exception 'Invalid number format at %',cell_ref; end if;
  if jsonb_typeof(cell_value->'align') not in('string','null') or(jsonb_typeof(cell_value->'align')='string' and cell_value->>'align' not in('left','center','right')) then raise exception 'Invalid alignment at %',cell_ref; end if;
 end loop;
end $$;

create or replace function public.assert_excel_efficiency_working_matter(m jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
begin
 if m is null or jsonb_typeof(m)<>'object' or pg_column_size(m)>2097152 then raise exception 'Working matter must be a bounded JSON object'; end if;
 if m->>'schemaVersion'<>'1' then raise exception 'Working matter schema is incompatible'; end if;
 if m->>'language' not in('English','Hindi') then raise exception 'Working matter language is invalid'; end if;
 if jsonb_typeof(m->'rows')<>'number' or(m->>'rows')::integer not between 1 and 200 then raise exception 'Invalid row count'; end if;
 if jsonb_typeof(m->'cols')<>'number' or(m->>'cols')::integer not between 1 and 26 then raise exception 'Invalid column count'; end if;
 perform public.assert_excel_efficiency_cells(coalesce(m->'cells','{}'::jsonb));
end $$;

create or replace function public.excel_efficiency_initial_editor_document(m jsonb)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
 select jsonb_build_object('schemaVersion','2','rows',m->'rows','cols',m->'cols','cells',coalesce(m->'cells','{}'::jsonb),'operations','[]'::jsonb,'savedAt','1970-01-01T00:00:00.000Z')
$$;

create or replace function public.assert_excel_efficiency_document_schema(d jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
begin
 if d is null or jsonb_typeof(d)<>'object' or pg_column_size(d)>2097152 then raise exception 'Document snapshot must be a bounded JSON object'; end if;
 if d->>'schemaVersion'<>'2' then raise exception 'Document schema is incompatible'; end if;
 if not(d?&array['schemaVersion','rows','cols','cells','operations','savedAt']) or exists(select 1 from jsonb_object_keys(d) as document_keys(key_name) where document_keys.key_name<>all(array['schemaVersion','rows','cols','cells','operations','savedAt'])) then raise exception 'Unknown document field'; end if;
 if jsonb_typeof(d->'rows')<>'number' or(d->>'rows')::integer not between 1 and 200 then raise exception 'Invalid row count'; end if;
 if jsonb_typeof(d->'cols')<>'number' or(d->>'cols')::integer not between 1 and 26 then raise exception 'Invalid column count'; end if;
 if jsonb_typeof(d->'operations')<>'array' or jsonb_array_length(d->'operations')>256 or exists(select 1 from jsonb_array_elements_text(d->'operations') op where length(op)>60) then raise exception 'Invalid operation history'; end if;
 if jsonb_typeof(d->'savedAt')<>'string' or length(d->>'savedAt')>64 or(d->>'savedAt')::timestamptz is null then raise exception 'Invalid saved timestamp'; end if;
 perform public.assert_excel_efficiency_cells(coalesce(d->'cells','{}'::jsonb));
end $$;

create or replace function public.excel_grading_target_value(document jsonb,target text)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare parts text[];
begin
 if document is null or target is null or target=''then return null; end if;
 parts:=string_to_array(target,'.');
 if array_length(parts,1)<>3 or parts[1]<>'cells' then return null; end if;
 if parts[3] not in('value','formula') then return null; end if;
 return document#>array['cells',parts[2],parts[3]];
end $$;

create or replace function public.evaluate_excel_grading_rule(final_document jsonb,target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric)
returns numeric language plpgsql immutable set search_path=pg_catalog,public as $$
declare actual jsonb;operation_applied boolean;
begin
 actual:=public.excel_grading_target_value(final_document,target);
 if actual is not null and expected_value is not null and actual=expected_value then return allocated_marks; end if;
 operation_applied:=exists(select 1 from jsonb_array_elements_text(coalesce(final_document->'operations','[]'::jsonb)) op where op=expected_operation);
 if operation_applied then return coalesce(partial_marks,0); end if;
 return 0;
end $$;

create or replace function public.save_excel_efficiency_test(p_test_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare tid uuid;vid uuid;vnum integer;publish boolean;q jsonb;duration integer;question_total numeric;matter jsonb;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 publish:=coalesce((p_payload->>'publish')::boolean,false);
 matter:=p_payload->'working_matter_snapshot';
 perform public.assert_excel_efficiency_working_matter(matter);
 if nullif(btrim(p_payload->>'instructions_markdown'),'') is null then raise exception 'instructions required'; end if;
 if jsonb_array_length(coalesce(p_payload->'duration_options','[]'::jsonb))<1 then raise exception 'duration required'; end if;
 for duration in select value::integer from jsonb_array_elements_text(p_payload->'duration_options') loop if duration<60 or duration>14400 then raise exception 'invalid duration'; end if; end loop;
 if jsonb_array_length(coalesce(p_payload->'questions','[]'::jsonb))<1 then raise exception 'questions required'; end if;
 select coalesce(sum((item->>'marks')::numeric),0) into question_total from jsonb_array_elements(p_payload->'questions') item;
 if jsonb_array_length(p_payload->'questions')<>(p_payload->>'question_count')::integer or question_total<>(p_payload->>'maximum_marks')::numeric then raise exception 'question count or marks mismatch'; end if;
 if p_test_id is null then
  insert into public.excel_efficiency_tests(slug,title,language,status,created_by) values(p_payload->>'slug',p_payload->>'title',p_payload->>'language',case when publish then 'published' else 'draft' end,auth.uid()) returning id into tid;
 else
  select id into tid from public.excel_efficiency_tests where id=p_test_id for update; if tid is null then raise exception 'test unavailable'; end if;
  update public.excel_efficiency_tests set slug=p_payload->>'slug',title=p_payload->>'title',language=p_payload->>'language',status=case when publish then 'published' else 'draft' end,updated_at=now() where id=tid;
 end if;
 select coalesce(max(version_number),0)+1 into vnum from public.excel_efficiency_versions where test_id=tid;
 insert into public.excel_efficiency_versions(test_id,version_number,title,language,description,instructions_markdown,question_count,maximum_marks,duration_options,passing_marks,working_matter_snapshot,created_by)
 values(tid,vnum,p_payload->>'title',p_payload->>'language',coalesce(p_payload->>'description',''),p_payload->>'instructions_markdown',(p_payload->>'question_count')::integer,(p_payload->>'maximum_marks')::numeric,array(select value::integer from jsonb_array_elements_text(p_payload->'duration_options')),nullif(p_payload->>'passing_marks','')::numeric,matter,auth.uid()) returning id into vid;
 for q in select value from jsonb_array_elements(p_payload->'questions') loop
  insert into public.excel_efficiency_questions(version_id,question_number,instruction,marks,section,display_order,is_visible) values(vid,(q->>'number')::integer,q->>'instruction',(q->>'marks')::numeric,nullif(q->>'section',''),coalesce((q->>'display_order')::integer,(q->>'number')::integer),coalesce((q->>'is_visible')::boolean,true));
 end loop;
 update public.excel_efficiency_tests set current_version_id=vid,current_version_number=vnum,published_at=case when publish then coalesce(published_at,now()) else published_at end where id=tid;
 return tid;
end $$;

create or replace function public.save_excel_efficiency_grading_rules(p_version_id uuid,p_rules jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare item jsonb;question_record public.excel_efficiency_questions%rowtype;expected jsonb;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if jsonb_typeof(p_rules)<>'array' or jsonb_array_length(p_rules)>500 then raise exception 'invalid grading rules'; end if;
 if exists(select 1 from public.excel_efficiency_attempts where version_id=p_version_id) then raise exception 'grading rules are immutable after an attempt is prepared'; end if;
 delete from public.excel_efficiency_grading_rules where version_id=p_version_id;
 for item in select value from jsonb_array_elements(p_rules) loop
  if jsonb_typeof(item)<>'object' or not(item?&array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks']) or exists(select 1 from jsonb_object_keys(item) k where k<>all(array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks'])) then raise exception 'invalid grading rule'; end if;
  select * into question_record from public.excel_efficiency_questions where version_id=p_version_id and question_number=(item->>'questionNumber')::integer;
  if not found then raise exception 'grading rule question does not belong to version'; end if;
  begin expected:=(item->>'expectedValue')::jsonb; exception when others then expected:=to_jsonb(item->>'expectedValue'); end;
  if(item->>'allocatedMarks')::numeric>question_record.marks then raise exception 'grading rule marks exceed question marks'; end if;
  insert into public.excel_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks) values(p_version_id,question_record.id,btrim(item->>'exactTarget'),btrim(item->>'expectedOperation'),expected,(item->>'allocatedMarks')::numeric,case when jsonb_typeof(item->'partialMarks')='null' then null else(item->>'partialMarks')::numeric end);
 end loop;
end $$;

create or replace function public.prepare_excel_efficiency_attempt(p_test_id uuid,p_duration_seconds integer,p_show_questions boolean)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.excel_efficiency_tests%rowtype;v public.excel_efficiency_versions%rowtype;aid uuid;questions jsonb;original jsonb;question_total numeric;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 select * into t from public.excel_efficiency_tests where id=p_test_id and status='published'; if not found then raise exception 'test unavailable'; end if;
 select * into v from public.excel_efficiency_versions where id=t.current_version_id;
 if not p_duration_seconds=any(v.duration_options) then raise exception 'duration unavailable'; end if;
 perform public.assert_excel_efficiency_working_matter(v.working_matter_snapshot);
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'number',q.question_number,'display_order',q.display_order,'instruction',case when q.is_visible then q.instruction end,'marks',q.marks,'section',q.section,'is_visible',q.is_visible) order by q.display_order),'[]'::jsonb),round(coalesce(sum(q.marks),0),2) into questions,question_total from public.excel_efficiency_questions q where q.version_id=v.id;
 original:=public.excel_efficiency_initial_editor_document(v.working_matter_snapshot);
 insert into public.excel_efficiency_attempts(test_id,version_id,student_id,selected_duration_seconds,snapshot,status,original_document_snapshot,started_at)
 values(t.id,v.id,auth.uid(),p_duration_seconds,jsonb_build_object('test_id',t.id,'test_version_id',v.id,'title',v.title,'language',v.language,'instructions_markdown',v.instructions_markdown,'duration_seconds',p_duration_seconds,'question_count',v.question_count,'maximum_marks',question_total,'questions',questions,'show_questions',coalesce(p_show_questions,false)),'active',original,now())
 returning id into aid;
 insert into public.excel_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks,grading_status)
 select aid,q.id,q.question_number,q.marks,'ungraded' from public.excel_efficiency_questions q where q.version_id=v.id;
 return aid;
end $$;

create or replace function public.autosave_excel_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.excel_efficiency_attempts%rowtype;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 select attempt_rows.* into attempt_record from public.excel_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid() for update;
 if not found or attempt_record.status<>'active' or attempt_record.started_at is null or attempt_record.final_document_snapshot is not null then raise exception 'attempt unavailable'; end if;
 if now()>attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds) then raise exception 'autosave deadline expired'; end if;
 perform public.assert_excel_efficiency_document_schema(p_document);
 update public.excel_efficiency_attempts as attempt_rows set document_autosave=p_document,updated_at=now() where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid() and attempt_rows.final_document_snapshot is null;
end $$;

create or replace function public.submit_excel_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.excel_efficiency_attempts%rowtype;rule record;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 select attempt_rows.* into attempt_record from public.excel_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid() for update;
 if not found or attempt_record.status<>'active' or attempt_record.started_at is null or attempt_record.final_document_snapshot is not null then raise exception 'attempt unavailable or already submitted'; end if;
 if now()>attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds+300) then raise exception 'submission grace expired'; end if;
 if now()<=attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds) then
  perform public.assert_excel_efficiency_document_schema(p_document);
 else
  if attempt_record.document_autosave is null or p_document is distinct from attempt_record.document_autosave then raise exception 'post-deadline submission must match the last valid autosave'; end if;
  perform public.assert_excel_efficiency_document_schema(attempt_record.document_autosave);
  p_document:=attempt_record.document_autosave;
 end if;
 update public.excel_efficiency_attempts as attempt_rows set document_autosave=p_document,final_document_snapshot=p_document,status='submitted',submitted_at=now(),updated_at=now() where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid() and attempt_rows.status='active' and attempt_rows.final_document_snapshot is null;
 if not found then raise exception 'attempt unavailable or already submitted'; end if;
 for rule in select grading_rules.question_id,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks from public.excel_efficiency_grading_rules as grading_rules where grading_rules.version_id=attempt_record.version_id loop
  update public.excel_efficiency_question_scores as question_scores set awarded_marks=public.evaluate_excel_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks),grading_status='graded',updated_at=now() where question_scores.attempt_id=p_attempt_id and question_scores.question_id=rule.question_id and question_scores.awarded_marks is null and question_scores.graded_by is null;
 end loop;
end $$;

create or replace function public.save_excel_efficiency_grading(p_attempt_id uuid,p_payload jsonb,p_publish boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.excel_efficiency_attempts%rowtype;score_item jsonb;score_record public.excel_efficiency_question_scores%rowtype;score_count integer;payload_count integer;awarded numeric;total_awarded numeric;maximum_total numeric;passing numeric;percentage numeric;published_at timestamptz;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) as payload_keys(key_name) where payload_keys.key_name<>all(array['scores','overallFeedback','privateNote'])) then raise exception 'invalid grading payload'; end if;
 if jsonb_typeof(p_payload->'scores')<>'array' or jsonb_array_length(p_payload->'scores') not between 1 and 100 then raise exception 'invalid grading scores'; end if;
 select attempt_rows.* into attempt_record from public.excel_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id for update;
 if not found or attempt_record.status not in('submitted','completed') then raise exception 'submitted attempt unavailable'; end if;
 if attempt_record.evaluation_status='published' or attempt_record.result is not null then raise exception 'published result is immutable'; end if;
 select count(*) into score_count from public.excel_efficiency_question_scores as score_rows where score_rows.attempt_id=p_attempt_id;
 payload_count:=jsonb_array_length(p_payload->'scores'); if payload_count<>score_count then raise exception 'every question score is required'; end if;
 for score_item in select value from jsonb_array_elements(p_payload->'scores') loop
  if jsonb_typeof(score_item)<>'object' or not(score_item?&array['questionId','awardedMarks','feedback']) then raise exception 'invalid question grading row'; end if;
  select score_rows.* into score_record from public.excel_efficiency_question_scores as score_rows where score_rows.attempt_id=p_attempt_id and score_rows.question_id=(score_item->>'questionId')::uuid for update;
  if not found then raise exception 'grading question does not belong to attempt'; end if;
  if jsonb_typeof(score_item->'awardedMarks')='null' then awarded:=null; elsif jsonb_typeof(score_item->'awardedMarks')='number' then awarded:=(score_item->>'awardedMarks')::numeric; else raise exception 'invalid awarded marks'; end if;
  if awarded is not null and(awarded<0 or awarded>score_record.maximum_marks) then raise exception 'awarded marks exceed question maximum'; end if;
  if p_publish and awarded is null then raise exception 'all questions must be graded before publishing'; end if;
  update public.excel_efficiency_question_scores as score_rows set awarded_marks=awarded,teacher_comment=nullif(btrim(score_item->>'feedback'),''),grading_status=case when awarded is null then'ungraded' when p_publish then'graded' else'in_progress' end,graded_by=case when awarded is null then null else auth.uid() end,graded_at=case when awarded is null then null else now() end,updated_at=now() where score_rows.id=score_record.id;
 end loop;
 select coalesce(sum(score_rows.awarded_marks),0),sum(score_rows.maximum_marks) into total_awarded,maximum_total from public.excel_efficiency_question_scores as score_rows where score_rows.attempt_id=p_attempt_id;
 select version_rows.passing_marks into passing from public.excel_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;
 percentage:=case when maximum_total>0 then round(total_awarded*100/maximum_total,2) else 0 end;
 if p_publish then
  published_at:=now();
  update public.excel_efficiency_attempts as attempt_rows set evaluation_status='published',overall_teacher_feedback=nullif(btrim(p_payload->>'overallFeedback'),''),private_teacher_note=nullif(btrim(p_payload->>'privateNote'),''),evaluated_by=auth.uid(),evaluated_at=published_at,result_published_at=published_at,result=jsonb_build_object('marks',total_awarded,'maximum_marks',maximum_total,'percentage',percentage,'passed',case when passing is null then null else total_awarded>=passing end,'passing_marks',passing,'evaluation_status','published','evaluated_at',published_at,'overall_feedback',nullif(btrim(p_payload->>'overallFeedback'),'')),status='completed',updated_at=published_at where attempt_rows.id=p_attempt_id and attempt_rows.status='submitted' and attempt_rows.result is null;
  if not found then raise exception 'attempt result could not be published'; end if;
 else
  update public.excel_efficiency_attempts as attempt_rows set evaluation_status='draft',overall_teacher_feedback=nullif(btrim(p_payload->>'overallFeedback'),''),private_teacher_note=nullif(btrim(p_payload->>'privateNote'),''),evaluated_by=auth.uid(),evaluated_at=now(),updated_at=now() where attempt_rows.id=p_attempt_id and attempt_rows.status='submitted' and attempt_rows.result is null;
 end if;
 return jsonb_build_object('status',case when p_publish then'published' else'draft' end,'marks',case when p_publish then total_awarded else null end,'maximum_marks',maximum_total,'percentage',case when p_publish then percentage else null end);
end $$;

create or replace function public.get_excel_efficiency_attempt_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public as $$
declare attempt_record public.excel_efficiency_attempts%rowtype;version_record public.excel_efficiency_versions%rowtype;result_rows jsonb;is_published boolean;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 select attempt_rows.* into attempt_record from public.excel_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid(); if not found or attempt_record.status not in('submitted','completed') then raise exception 'attempt result unavailable'; end if;
 select version_rows.* into version_record from public.excel_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id; if not found then raise exception 'test version unavailable'; end if;
 is_published:=attempt_record.result is not null and(attempt_record.evaluation_status='published' or attempt_record.status='completed');
 if is_published then select coalesce(jsonb_agg(jsonb_build_object('number',score_rows.question_number,'instruction',question_rows.instruction,'section',question_rows.section,'maximumMarks',score_rows.maximum_marks,'awardedMarks',score_rows.awarded_marks,'feedback',score_rows.teacher_comment,'gradingStatus',case when score_rows.awarded_marks is null then'not_graded' else'graded' end) order by question_rows.display_order),'[]'::jsonb) into result_rows from public.excel_efficiency_question_scores as score_rows join public.excel_efficiency_questions as question_rows on question_rows.id=score_rows.question_id where score_rows.attempt_id=p_attempt_id; else result_rows:='[]'::jsonb; end if;
 return jsonb_build_object('title',attempt_record.snapshot->>'title','language',attempt_record.snapshot->>'language','status',case when is_published then'published' else'pending' end,'submittedAt',attempt_record.submitted_at,'evaluatedAt',case when is_published then attempt_record.result_published_at end,'maximumMarks',version_record.maximum_marks,'marksObtained',case when is_published then attempt_record.result->'marks' else null end,'percentage',case when is_published then attempt_record.result->'percentage' else null end,'passingMarks',case when is_published then to_jsonb(version_record.passing_marks) else null end,'passed',case when is_published then attempt_record.result->'passed' else null end,'overallFeedback',case when is_published then attempt_record.overall_teacher_feedback end,'questions',result_rows);
end $$;

create or replace function public.set_excel_efficiency_status(p_test_id uuid,p_status text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$ begin if not public.is_aal2_admin() then raise exception 'not authorized'; end if; if p_status not in('published','unpublished','archived') then raise exception 'invalid status'; end if; update public.excel_efficiency_tests set status=p_status,archived_at=case when p_status='archived' then now() end,published_at=case when p_status='published' then coalesce(published_at,now()) else published_at end,updated_at=now() where id=p_test_id; end $$;

create or replace function public.delete_excel_efficiency_test(p_test_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$ begin if not public.is_aal2_admin() then raise exception 'not authorized'; end if; if exists(select 1 from public.excel_efficiency_attempts where test_id=p_test_id) then return false; end if; update public.excel_efficiency_tests set current_version_id=null where id=p_test_id; delete from public.excel_efficiency_grading_rules where version_id in(select id from public.excel_efficiency_versions where test_id=p_test_id); delete from public.excel_efficiency_questions where version_id in(select id from public.excel_efficiency_versions where test_id=p_test_id); delete from public.excel_efficiency_versions where test_id=p_test_id; delete from public.excel_efficiency_tests where id=p_test_id; return found; end $$;

revoke all on function public.assert_excel_efficiency_cells(jsonb),public.assert_excel_efficiency_working_matter(jsonb),public.excel_efficiency_initial_editor_document(jsonb),public.assert_excel_efficiency_document_schema(jsonb),public.excel_grading_target_value(jsonb,text),public.evaluate_excel_grading_rule(jsonb,text,text,jsonb,numeric,numeric),public.save_excel_efficiency_test(uuid,jsonb),public.save_excel_efficiency_grading_rules(uuid,jsonb),public.prepare_excel_efficiency_attempt(uuid,integer,boolean),public.autosave_excel_efficiency_document(uuid,jsonb),public.submit_excel_efficiency_document(uuid,jsonb),public.save_excel_efficiency_grading(uuid,jsonb,boolean),public.get_excel_efficiency_attempt_result(uuid),public.set_excel_efficiency_status(uuid,text),public.delete_excel_efficiency_test(uuid) from public,anon,authenticated;
grant execute on function public.save_excel_efficiency_test(uuid,jsonb),public.save_excel_efficiency_grading_rules(uuid,jsonb),public.prepare_excel_efficiency_attempt(uuid,integer,boolean),public.autosave_excel_efficiency_document(uuid,jsonb),public.submit_excel_efficiency_document(uuid,jsonb),public.save_excel_efficiency_grading(uuid,jsonb,boolean),public.get_excel_efficiency_attempt_result(uuid),public.set_excel_efficiency_status(uuid,text),public.delete_excel_efficiency_test(uuid) to authenticated;

commit;

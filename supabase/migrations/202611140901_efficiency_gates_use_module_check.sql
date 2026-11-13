begin;

-- Word/Excel Efficiency's own attempt-start gates already call
-- assert_student_access_allowed() (the global lock check) -- now also pass
-- 'efficiency' so a student without the Efficiency module enabled is
-- blocked here too, same as Typing/Stenography are via recordManagedAttempt
-- and recordPracticeAttempt. Body is otherwise byte-identical to the live
-- function (confirmed via pg_get_functiondef before writing this).
create or replace function public.prepare_word_efficiency_attempt(p_test_id uuid, p_duration_seconds integer, p_delivery text, p_live boolean default true)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare test_record public.word_efficiency_tests%rowtype;version_record public.word_efficiency_versions%rowtype;new_attempt_id uuid;question_snapshot jsonb;question_total numeric;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;
 perform public.assert_student_access_allowed(p_module := 'efficiency');
 select test_rows.* into test_record from public.word_efficiency_tests as test_rows where test_rows.id=p_test_id and test_rows.status='published';
 if not found then raise exception 'test unavailable';end if;
 if (test_record.is_live and coalesce(p_live,true)) then
  if now()<test_record.live_starts_at or now()>test_record.live_ends_at then raise exception 'This live test is not currently open.';end if;
  if exists(select 1 from public.word_efficiency_attempts where test_id=test_record.id and student_id=auth.uid() and is_live_attempt)then raise exception 'You have already attempted this live test.';end if;
 end if;
 select version_rows.* into version_record from public.word_efficiency_versions as version_rows where version_rows.id=test_record.current_version_id;
 if not found then raise exception 'published version unavailable';end if;
 if not p_duration_seconds=any(version_record.duration_options)then raise exception 'duration unavailable';end if; if (test_record.is_live and coalesce(p_live,true)) and p_duration_seconds<>version_record.duration_options[1] then raise exception 'a live test runs for its set duration';end if;
 if p_delivery not in('onscreen','pdf','realfile')or(p_delivery='onscreen'and not version_record.delivery_onscreen)or(p_delivery='pdf'and not version_record.delivery_pdf)or(p_delivery='realfile'and not version_record.delivery_realfile)then raise exception 'delivery unavailable';end if;
 perform public.assert_word_efficiency_working_matter(version_record.working_matter_snapshot);
 perform public.assert_word_efficiency_editor_capabilities(version_record.editor_capabilities);
 select coalesce(jsonb_agg(jsonb_build_object('id',question_rows.id,'question_version_id',question_rows.id,'number',question_rows.question_number,'display_order',question_rows.display_order,'instruction',case when p_delivery in('onscreen','realfile')and question_rows.is_visible then question_rows.instruction end,'marks',question_rows.marks,'section',question_rows.section,'is_visible',question_rows.is_visible)order by question_rows.display_order),'[]'::jsonb),round(coalesce(sum(question_rows.marks),0),2)
 into question_snapshot,question_total from public.word_efficiency_questions as question_rows where question_rows.version_id=version_record.id;
 if jsonb_array_length(question_snapshot)<>version_record.question_count or question_total<>version_record.maximum_marks then raise exception 'published question allocation is inconsistent';end if;
 insert into public.word_efficiency_attempts(test_id,version_id,student_id,delivery_method,selected_duration_seconds,snapshot,is_live_attempt)
 values(test_record.id,version_record.id,auth.uid(),p_delivery,p_duration_seconds,jsonb_build_object('test_id',test_record.id,'test_version_id',version_record.id,'instructions_version_id',version_record.id,'question_version_id',version_record.id,'title',version_record.title,'language',version_record.language,'instructions_markdown',version_record.instructions_markdown,'delivery_method',p_delivery,'duration_seconds',p_duration_seconds,'question_count',version_record.question_count,'maximum_marks',question_total,'questions',question_snapshot,'editor_capabilities',version_record.editor_capabilities,'pdf_path',case when p_delivery='pdf'then version_record.pdf_path end,'pdf_file_name',case when p_delivery='pdf'then version_record.pdf_file_name end,'pdf_size_bytes',case when p_delivery='pdf'then version_record.pdf_size_bytes end,'pdf_page_count',case when p_delivery='pdf'then version_record.pdf_page_count end,'pdf_uploaded_at',case when p_delivery='pdf'then version_record.pdf_uploaded_at end),(test_record.is_live and coalesce(p_live,true)))returning word_efficiency_attempts.id into new_attempt_id;
 insert into public.word_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks)select new_attempt_id,question_rows.id,question_rows.question_number,question_rows.marks from public.word_efficiency_questions as question_rows where question_rows.version_id=version_record.id;
 return new_attempt_id;
end $$;

create or replace function public.prepare_excel_efficiency_attempt(p_test_id uuid, p_duration_seconds integer, p_show_questions boolean, p_live boolean default true)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare t public.excel_efficiency_tests%rowtype;v public.excel_efficiency_versions%rowtype;aid uuid;questions jsonb;original jsonb;question_total numeric;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 perform public.assert_student_access_allowed(p_module := 'efficiency');
 select * into t from public.excel_efficiency_tests where id=p_test_id and status='published'; if not found then raise exception 'test unavailable'; end if;
 if (t.is_live and coalesce(p_live,true)) then
  if now()<t.live_starts_at or now()>t.live_ends_at then raise exception 'This live test is not currently open.'; end if;
  if exists(select 1 from public.excel_efficiency_attempts where test_id=t.id and student_id=auth.uid() and is_live_attempt) then raise exception 'You have already attempted this live test.'; end if;
 end if;
 select * into v from public.excel_efficiency_versions where id=t.current_version_id;
 if not p_duration_seconds=any(v.duration_options) then raise exception 'duration unavailable'; end if; if (t.is_live and coalesce(p_live,true)) and p_duration_seconds<>v.duration_options[1] then raise exception 'a live test runs for its set duration'; end if;
 perform public.assert_excel_efficiency_working_matter(v.working_matter_snapshot);
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'number',q.question_number,'display_order',q.display_order,'instruction',case when q.is_visible then q.instruction end,'marks',q.marks,'section',q.section,'is_visible',q.is_visible) order by q.display_order),'[]'::jsonb),round(coalesce(sum(q.marks),0),2) into questions,question_total from public.excel_efficiency_questions q where q.version_id=v.id;
 original:=public.excel_efficiency_initial_editor_document(v.working_matter_snapshot);
 insert into public.excel_efficiency_attempts(test_id,version_id,student_id,selected_duration_seconds,snapshot,status,original_document_snapshot,started_at,is_live_attempt)
 values(t.id,v.id,auth.uid(),p_duration_seconds,jsonb_build_object('test_id',t.id,'test_version_id',v.id,'title',v.title,'language',v.language,'instructions_markdown',v.instructions_markdown,'duration_seconds',p_duration_seconds,'question_count',v.question_count,'maximum_marks',question_total,'questions',questions,'show_questions',case when not v.delivery_onscreen then false when not v.student_question_toggle then true else coalesce(p_show_questions,true) end,'delivery_onscreen',v.delivery_onscreen,'question_toggle',v.delivery_onscreen and v.student_question_toggle),'active',original,now(),(t.is_live and coalesce(p_live,true)))
 returning id into aid;
 insert into public.excel_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks,grading_status)
 select aid,q.id,q.question_number,q.marks,'ungraded' from public.excel_efficiency_questions q where q.version_id=v.id;
 return aid;
end $$;

commit;

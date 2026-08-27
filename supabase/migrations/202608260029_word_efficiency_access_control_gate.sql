begin;

-- Word Efficiency has a real "start an attempt" RPC, unlike the general typing/
-- practice/exam flow which only records a completed attempt after the fact.
-- That makes this the correct, hard choke point: a locked student is stopped
-- before they can even prepare a document, not just after they finish typing.
create or replace function public.prepare_word_efficiency_attempt(p_test_id uuid,p_duration_seconds integer,p_delivery text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare test_record public.word_efficiency_tests%rowtype;version_record public.word_efficiency_versions%rowtype;new_attempt_id uuid;question_snapshot jsonb;question_total numeric;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;
 perform public.assert_student_access_allowed();
 select test_rows.* into test_record from public.word_efficiency_tests as test_rows where test_rows.id=p_test_id and test_rows.status='published';
 if not found then raise exception 'test unavailable';end if;
 select version_rows.* into version_record from public.word_efficiency_versions as version_rows where version_rows.id=test_record.current_version_id;
 if not found then raise exception 'published version unavailable';end if;
 if not p_duration_seconds=any(version_record.duration_options)then raise exception 'duration unavailable';end if;
 if p_delivery not in('onscreen','pdf')or(p_delivery='onscreen'and not version_record.delivery_onscreen)or(p_delivery='pdf'and not version_record.delivery_pdf)then raise exception 'delivery unavailable';end if;
 perform public.assert_word_efficiency_working_matter(version_record.working_matter_snapshot);
 perform public.assert_word_efficiency_editor_capabilities(version_record.editor_capabilities);
 select coalesce(jsonb_agg(jsonb_build_object('id',question_rows.id,'question_version_id',question_rows.id,'number',question_rows.question_number,'display_order',question_rows.display_order,'instruction',case when p_delivery='onscreen'and question_rows.is_visible then question_rows.instruction end,'marks',question_rows.marks,'section',question_rows.section,'is_visible',question_rows.is_visible)order by question_rows.display_order),'[]'::jsonb),round(coalesce(sum(question_rows.marks),0),2)
 into question_snapshot,question_total from public.word_efficiency_questions as question_rows where question_rows.version_id=version_record.id;
 if jsonb_array_length(question_snapshot)<>version_record.question_count or question_total<>version_record.maximum_marks then raise exception 'published question allocation is inconsistent';end if;
 insert into public.word_efficiency_attempts(test_id,version_id,student_id,delivery_method,selected_duration_seconds,snapshot)
 values(test_record.id,version_record.id,auth.uid(),p_delivery,p_duration_seconds,jsonb_build_object('test_id',test_record.id,'test_version_id',version_record.id,'instructions_version_id',version_record.id,'question_version_id',version_record.id,'title',version_record.title,'language',version_record.language,'instructions_markdown',version_record.instructions_markdown,'delivery_method',p_delivery,'duration_seconds',p_duration_seconds,'question_count',version_record.question_count,'maximum_marks',question_total,'questions',question_snapshot,'editor_capabilities',version_record.editor_capabilities,'pdf_path',case when p_delivery='pdf'then version_record.pdf_path end,'pdf_file_name',case when p_delivery='pdf'then version_record.pdf_file_name end,'pdf_size_bytes',case when p_delivery='pdf'then version_record.pdf_size_bytes end,'pdf_page_count',case when p_delivery='pdf'then version_record.pdf_page_count end,'pdf_uploaded_at',case when p_delivery='pdf'then version_record.pdf_uploaded_at end))returning word_efficiency_attempts.id into new_attempt_id;
 insert into public.word_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks)select new_attempt_id,question_rows.id,question_rows.question_number,question_rows.marks from public.word_efficiency_questions as question_rows where question_rows.version_id=version_record.id;
 return new_attempt_id;
end $$;

commit;

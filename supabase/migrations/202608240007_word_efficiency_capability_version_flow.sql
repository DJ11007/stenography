begin;

-- New immutable versions must contain the hierarchy the administrator saved.
-- Historical v1 versions remain untouched and are normalized only when read.
create or replace function public.normalize_new_word_efficiency_version_capabilities()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if new.editor_capabilities is null or jsonb_typeof(new.editor_capabilities)<>'object' or new.editor_capabilities->>'schemaVersion'<>'2' then
  raise exception 'New Word Efficiency versions require schema-v2 editor capabilities';
 end if;
 perform public.assert_word_efficiency_editor_capabilities(new.editor_capabilities);
 return new;
end $$;

create or replace function public.prepare_word_efficiency_attempt(p_test_id uuid,p_duration_seconds integer,p_delivery text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare test_record public.word_efficiency_tests%rowtype;version_record public.word_efficiency_versions%rowtype;new_attempt_id uuid;question_snapshot jsonb;question_total numeric;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;
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

create or replace function public.initialize_word_efficiency_document(p_attempt_id uuid,p_show_questions boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare working_matter jsonb;stored_capabilities jsonb;effective_capabilities jsonb;prepared_capabilities jsonb;original_snapshot jsonb;initial_editor_document jsonb;
begin
 if not public.is_active_word_efficiency_student()then raise exception'active student account required';end if;
 select version_rows.working_matter_snapshot,version_rows.editor_capabilities,attempt_rows.snapshot->'editor_capabilities',attempt_rows.original_document_snapshot
 into working_matter,stored_capabilities,prepared_capabilities,original_snapshot
 from public.word_efficiency_attempts as attempt_rows join public.word_efficiency_versions as version_rows on version_rows.id=attempt_rows.version_id
 where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()and attempt_rows.status='prepared' for update of attempt_rows;
 if not found then raise exception'attempt unavailable';end if;
 effective_capabilities:=case when stored_capabilities->>'schemaVersion'='2'then stored_capabilities else public.normalize_word_efficiency_editor_capabilities(stored_capabilities)end;
 if prepared_capabilities is not null and prepared_capabilities is distinct from stored_capabilities then raise exception'attempt editor capabilities do not match its immutable version';end if;
 if original_snapshot is not null then return original_snapshot;end if;
 perform public.assert_word_efficiency_working_matter(working_matter);perform public.assert_word_efficiency_editor_capabilities(effective_capabilities);
 initial_editor_document:=public.word_efficiency_initial_editor_document(working_matter);perform public.assert_word_efficiency_document_schema(initial_editor_document,effective_capabilities);
 update public.word_efficiency_attempts as attempt_rows set original_document_snapshot=coalesce(attempt_rows.original_document_snapshot,working_matter),document_autosave=null,snapshot=coalesce(attempt_rows.snapshot,'{}'::jsonb)||jsonb_build_object('working_matter',working_matter,'editor_capabilities',effective_capabilities,'initial_editor_document',initial_editor_document,'show_questions',coalesce(p_show_questions,false)),updated_at=now()
 where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()and attempt_rows.status='prepared'and attempt_rows.original_document_snapshot is null;
 return working_matter;
end $$;

revoke all on function public.normalize_new_word_efficiency_version_capabilities(),public.prepare_word_efficiency_attempt(uuid,integer,text),public.initialize_word_efficiency_document(uuid,boolean)from public,anon,authenticated;
grant execute on function public.prepare_word_efficiency_attempt(uuid,integer,text),public.initialize_word_efficiency_document(uuid,boolean)to authenticated;

commit;

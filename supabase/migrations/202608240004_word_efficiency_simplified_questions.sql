begin;

-- Keep legacy columns and historical values intact, but new immutable question
-- rows no longer accept sample/source text or private grading notes.
create or replace function public.clear_new_word_efficiency_question_extras()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin new.sample_text:=null;new.grading_note:=null;return new;end $$;

create trigger clear_new_word_efficiency_question_extras
before insert on public.word_efficiency_questions
for each row execute function public.clear_new_word_efficiency_question_extras();

create or replace function public.prepare_word_efficiency_attempt(p_test_id uuid,p_duration_seconds integer,p_delivery text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.word_efficiency_tests%rowtype;v public.word_efficiency_versions%rowtype;aid uuid;questions jsonb;question_total numeric;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;
 select * into t from public.word_efficiency_tests where id=p_test_id and status='published';if not found then raise exception 'test unavailable';end if;select * into v from public.word_efficiency_versions where id=t.current_version_id;
 if not p_duration_seconds=any(v.duration_options)then raise exception 'duration unavailable';end if;if p_delivery not in('onscreen','pdf')or(p_delivery='onscreen'and not v.delivery_onscreen)or(p_delivery='pdf'and not v.delivery_pdf)then raise exception 'delivery unavailable';end if;
 perform public.assert_word_efficiency_working_matter(v.working_matter_snapshot);perform public.assert_word_efficiency_editor_capabilities(v.editor_capabilities);
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'question_version_id',q.id,'number',q.question_number,'display_order',q.display_order,'instruction',case when p_delivery='onscreen'and q.is_visible then q.instruction end,'marks',q.marks,'section',q.section,'is_visible',q.is_visible)order by q.display_order),'[]'::jsonb),round(coalesce(sum(q.marks),0),2)into questions,question_total from public.word_efficiency_questions q where q.version_id=v.id;
 if jsonb_array_length(questions)<>v.question_count or question_total<>v.maximum_marks then raise exception 'published question allocation is inconsistent';end if;
 insert into public.word_efficiency_attempts(test_id,version_id,student_id,delivery_method,selected_duration_seconds,snapshot)values(t.id,v.id,auth.uid(),p_delivery,p_duration_seconds,jsonb_build_object('test_id',t.id,'test_version_id',v.id,'instructions_version_id',v.id,'question_version_id',v.id,'title',v.title,'language',v.language,'instructions_markdown',v.instructions_markdown,'delivery_method',p_delivery,'duration_seconds',p_duration_seconds,'question_count',v.question_count,'maximum_marks',question_total,'questions',questions,'pdf_path',case when p_delivery='pdf'then v.pdf_path end,'pdf_file_name',case when p_delivery='pdf'then v.pdf_file_name end,'pdf_size_bytes',case when p_delivery='pdf'then v.pdf_size_bytes end,'pdf_page_count',case when p_delivery='pdf'then v.pdf_page_count end,'pdf_uploaded_at',case when p_delivery='pdf'then v.pdf_uploaded_at end))returning id into aid;
 insert into public.word_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks)select aid,q.id,q.question_number,q.marks from public.word_efficiency_questions q where q.version_id=v.id;
 return aid;
end $$;

revoke all on function public.clear_new_word_efficiency_question_extras(),public.prepare_word_efficiency_attempt(uuid,integer,text)from public,anon;
grant execute on function public.prepare_word_efficiency_attempt(uuid,integer,text)to authenticated;

commit;

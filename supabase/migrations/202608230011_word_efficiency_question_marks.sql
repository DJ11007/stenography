begin;

alter table public.word_efficiency_questions
  add column section text,
  add column display_order integer,
  add column is_visible boolean not null default true,
  add column grading_note text;

update public.word_efficiency_questions set display_order=question_number where display_order is null;
alter table public.word_efficiency_questions alter column display_order set not null;
alter table public.word_efficiency_questions add constraint word_efficiency_question_order_positive check(display_order>0);
alter table public.word_efficiency_questions add constraint word_efficiency_question_order_unique unique(version_id,display_order);
alter table public.word_efficiency_questions add constraint word_efficiency_question_marks_upper check(marks<=1000);
alter table public.word_efficiency_questions drop constraint if exists word_efficiency_questions_instruction_check;
alter table public.word_efficiency_questions alter column instruction drop not null;
alter table public.word_efficiency_questions add constraint word_efficiency_question_instruction_length check(char_length(instruction)<=10000);

create table public.word_efficiency_question_scores(
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.word_efficiency_attempts(id) on delete restrict,
  question_id uuid not null references public.word_efficiency_questions(id) on delete restrict,
  question_number integer not null check(question_number>0),
  maximum_marks numeric(8,2) not null check(maximum_marks>0 and maximum_marks<=1000),
  awarded_marks numeric(8,2) check(awarded_marks is null or (awarded_marks>=0 and awarded_marks<=maximum_marks)),
  teacher_comment text,
  grading_status text not null default 'ungraded' check(grading_status in ('ungraded','in_progress','graded')),
  grading_note_snapshot text,
  graded_by uuid references public.profiles(id) on delete restrict,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(attempt_id,question_id)
);
alter table public.word_efficiency_question_scores enable row level security;
create policy "AAL2 admins manage Word question scores" on public.word_efficiency_question_scores for all to authenticated using(public.is_aal2_admin()) with check(public.is_aal2_admin());
revoke all on public.word_efficiency_question_scores from anon;
grant select,insert,update on public.word_efficiency_question_scores to authenticated;

create or replace function public.save_word_efficiency_test(p_test_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare tid uuid;vid uuid;vnum integer;publish boolean;onscreen boolean;pdf boolean;q jsonb;duration integer;question_total numeric;question_count integer;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized';end if;
 publish:=coalesce((p_payload->>'publish')::boolean,false);onscreen:=coalesce((p_payload->>'delivery_onscreen')::boolean,false);pdf:=coalesce((p_payload->>'delivery_pdf')::boolean,false);
 if nullif(btrim(p_payload->>'instructions_markdown'),'') is null then raise exception 'instructions required';end if;
 if not onscreen and not pdf then raise exception 'delivery method required';end if;
 if jsonb_array_length(coalesce(p_payload->'duration_options','[]'::jsonb))<1 then raise exception 'duration required';end if;
 for duration in select value::integer from jsonb_array_elements_text(p_payload->'duration_options') loop if duration<60 or duration>14400 then raise exception 'invalid duration';end if;end loop;
 question_count:=jsonb_array_length(coalesce(p_payload->'questions','[]'::jsonb));
 if question_count<1 or question_count>500 then raise exception 'questions required';end if;
 if question_count<>(p_payload->>'question_count')::integer then raise exception 'question count mismatch';end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'questions') item where nullif(item->>'number','') is null or (item->>'number')::integer<1 or nullif(item->>'display_order','') is null or (item->>'display_order')::integer<1 or nullif(item->>'marks','') is null or (item->>'marks')::numeric<=0 or (item->>'marks')::numeric>1000) then raise exception 'invalid question number, order, or marks';end if;
 if (select count(distinct (item->>'number')::integer) from jsonb_array_elements(p_payload->'questions') item)<>question_count then raise exception 'duplicate question number';end if;
 if (select count(distinct (item->>'display_order')::integer) from jsonb_array_elements(p_payload->'questions') item)<>question_count or exists(select 1 from generate_series(1,question_count) expected where not exists(select 1 from jsonb_array_elements(p_payload->'questions') item where (item->>'display_order')::integer=expected)) then raise exception 'invalid question order';end if;
 if onscreen and exists(select 1 from jsonb_array_elements(p_payload->'questions') item where coalesce((item->>'is_visible')::boolean,true) and nullif(btrim(item->>'instruction'),'') is null) then raise exception 'visible question text required';end if;
 if pdf and (nullif(p_payload->>'pdf_path','') is null or nullif(p_payload->>'pdf_file_name','') is null or coalesce((p_payload->>'pdf_size_bytes')::bigint,0)<=0) then raise exception 'valid PDF required';end if;
 select round(coalesce(sum((item->>'marks')::numeric),0),2) into question_total from jsonb_array_elements(p_payload->'questions') item;
 if question_total<>(p_payload->>'maximum_marks')::numeric then raise exception 'question marks total mismatch';end if;
 if p_test_id is null then insert into public.word_efficiency_tests(slug,title,language,status,created_by) values(p_payload->>'slug',p_payload->>'title',p_payload->>'language',case when publish then 'published' else 'draft' end,auth.uid()) returning id into tid;
 else select id into tid from public.word_efficiency_tests where id=p_test_id for update;if tid is null then raise exception 'test unavailable';end if;update public.word_efficiency_tests set slug=p_payload->>'slug',title=p_payload->>'title',language=p_payload->>'language',status=case when publish then 'published' else 'draft' end,updated_at=now() where id=tid;end if;
 select coalesce(max(version_number),0)+1 into vnum from public.word_efficiency_versions where test_id=tid;
 insert into public.word_efficiency_versions(test_id,version_number,title,language,description,instructions_markdown,delivery_onscreen,delivery_pdf,question_count,maximum_marks,duration_options,passing_marks,pdf_path,pdf_file_name,pdf_size_bytes,pdf_page_count,pdf_uploaded_at,created_by) values(tid,vnum,p_payload->>'title',p_payload->>'language',coalesce(p_payload->>'description',''),p_payload->>'instructions_markdown',onscreen,pdf,question_count,question_total,array(select value::integer from jsonb_array_elements_text(p_payload->'duration_options')),nullif(p_payload->>'passing_marks','')::numeric,nullif(p_payload->>'pdf_path',''),nullif(p_payload->>'pdf_file_name',''),nullif(p_payload->>'pdf_size_bytes','')::bigint,nullif(p_payload->>'pdf_page_count','')::integer,case when pdf then coalesce((p_payload->>'pdf_uploaded_at')::timestamptz,now()) end,auth.uid()) returning id into vid;
 for q in select value from jsonb_array_elements(p_payload->'questions') loop insert into public.word_efficiency_questions(version_id,question_number,instruction,marks,sample_text,section,display_order,is_visible,grading_note) values(vid,(q->>'number')::integer,coalesce(q->>'instruction',''),(q->>'marks')::numeric,nullif(q->>'sample_text',''),nullif(q->>'section',''),(q->>'display_order')::integer,coalesce((q->>'is_visible')::boolean,true),nullif(q->>'grading_note',''));end loop;
 update public.word_efficiency_tests set current_version_id=vid,current_version_number=vnum,published_at=case when publish then coalesce(published_at,now()) else published_at end where id=tid;return tid;
end $$;

create or replace function public.prepare_word_efficiency_attempt(p_test_id uuid,p_duration_seconds integer,p_delivery text)
returns uuid language plpgsql security definer set search_path=public as $$
declare t public.word_efficiency_tests%rowtype;v public.word_efficiency_versions%rowtype;aid uuid;questions jsonb;question_total numeric;
begin
 select * into t from public.word_efficiency_tests where id=p_test_id and status='published';if not found then raise exception 'test unavailable';end if;select * into v from public.word_efficiency_versions where id=t.current_version_id;
 if not p_duration_seconds=any(v.duration_options) then raise exception 'duration unavailable';end if;if p_delivery not in('onscreen','pdf') or(p_delivery='onscreen' and not v.delivery_onscreen)or(p_delivery='pdf' and not v.delivery_pdf)then raise exception 'delivery unavailable';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'question_version_id',q.id,'number',q.question_number,'display_order',q.display_order,'instruction',case when p_delivery='onscreen' and q.is_visible then q.instruction end,'marks',q.marks,'sample_text',case when p_delivery='onscreen' and q.is_visible then q.sample_text end,'section',q.section,'is_visible',q.is_visible)order by q.display_order),'[]'::jsonb),round(coalesce(sum(q.marks),0),2) into questions,question_total from public.word_efficiency_questions q where q.version_id=v.id;
 if jsonb_array_length(questions)<>v.question_count or question_total<>v.maximum_marks then raise exception 'published question allocation is inconsistent';end if;
 insert into public.word_efficiency_attempts(test_id,version_id,student_id,delivery_method,selected_duration_seconds,snapshot)values(t.id,v.id,auth.uid(),p_delivery,p_duration_seconds,jsonb_build_object('test_id',t.id,'test_version_id',v.id,'instructions_version_id',v.id,'question_version_id',v.id,'title',v.title,'language',v.language,'instructions_markdown',v.instructions_markdown,'delivery_method',p_delivery,'duration_seconds',p_duration_seconds,'question_count',v.question_count,'maximum_marks',question_total,'questions',questions,'pdf_path',case when p_delivery='pdf' then v.pdf_path end,'pdf_file_name',case when p_delivery='pdf' then v.pdf_file_name end,'pdf_size_bytes',case when p_delivery='pdf' then v.pdf_size_bytes end,'pdf_page_count',case when p_delivery='pdf' then v.pdf_page_count end,'pdf_uploaded_at',case when p_delivery='pdf' then v.pdf_uploaded_at end))returning id into aid;
 insert into public.word_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks,grading_note_snapshot)select aid,q.id,q.question_number,q.marks,q.grading_note from public.word_efficiency_questions q where q.version_id=v.id;return aid;
end $$;

create or replace function public.set_word_efficiency_status(p_test_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare v public.word_efficiency_versions%rowtype;actual_count integer;actual_total numeric;
begin if not public.is_aal2_admin()then raise exception 'not authorized';end if;if p_status not in('published','unpublished','archived')then raise exception 'invalid status';end if;if p_status='published'then select v.* into v from public.word_efficiency_versions v join public.word_efficiency_tests t on t.current_version_id=v.id where t.id=p_test_id;select count(*),round(coalesce(sum(marks),0),2)into actual_count,actual_total from public.word_efficiency_questions where version_id=v.id;if actual_count<>v.question_count or actual_total<>v.maximum_marks then raise exception 'question allocation is inconsistent';end if;end if;update public.word_efficiency_tests set status=p_status,archived_at=case when p_status='archived'then now()end,published_at=case when p_status='published'then coalesce(published_at,now())else published_at end,updated_at=now()where id=p_test_id;end $$;

commit;

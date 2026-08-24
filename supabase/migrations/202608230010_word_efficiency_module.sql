begin;

create table public.word_efficiency_tests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  language text not null check (language in ('English','Hindi')),
  status text not null default 'draft' check (status in ('draft','published','unpublished','archived')),
  current_version_id uuid,
  current_version_number integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.word_efficiency_versions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.word_efficiency_tests(id) on delete restrict,
  version_number integer not null check (version_number>0),
  title text not null,
  language text not null check (language in ('English','Hindi')),
  description text not null default '',
  instructions_markdown text not null check (char_length(btrim(instructions_markdown)) between 10 and 20000),
  delivery_onscreen boolean not null,
  delivery_pdf boolean not null,
  question_count integer not null check (question_count between 1 and 500),
  maximum_marks numeric(8,2) not null check (maximum_marks>0 and maximum_marks<=10000),
  duration_options integer[] not null check (cardinality(duration_options) between 1 and 12),
  passing_marks numeric(8,2),
  pdf_path text,
  pdf_file_name text,
  pdf_size_bytes bigint,
  pdf_page_count integer,
  pdf_uploaded_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(test_id,version_number),
  check (delivery_onscreen or delivery_pdf),
  check (passing_marks is null or (passing_marks>=0 and passing_marks<=maximum_marks)),
  check (not delivery_pdf or (pdf_path is not null and pdf_file_name is not null and pdf_size_bytes>0))
);

alter table public.word_efficiency_tests add constraint word_efficiency_current_version_fk foreign key(current_version_id) references public.word_efficiency_versions(id) on delete restrict;

create table public.word_efficiency_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.word_efficiency_versions(id) on delete restrict,
  question_number integer not null check(question_number>0),
  instruction text not null check(char_length(btrim(instruction)) between 1 and 10000),
  marks numeric(8,2) not null check(marks>0),
  sample_text text,
  unique(version_id,question_number)
);

create table public.word_efficiency_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.word_efficiency_tests(id) on delete restrict,
  version_id uuid not null references public.word_efficiency_versions(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  delivery_method text not null check(delivery_method in ('onscreen','pdf')),
  selected_duration_seconds integer not null check(selected_duration_seconds between 60 and 14400),
  snapshot jsonb not null,
  status text not null default 'prepared' check(status in ('prepared','active','paused','submitted','completed')),
  autosave jsonb not null default '{}'::jsonb,
  result jsonb,
  prepared_at timestamptz not null default now(),
  started_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index word_efficiency_catalogue on public.word_efficiency_tests(language,status,published_at desc,id);
create index word_efficiency_attempt_student on public.word_efficiency_attempts(student_id,prepared_at desc);
create index word_efficiency_attempt_test on public.word_efficiency_attempts(test_id,prepared_at desc);
create index word_efficiency_question_version on public.word_efficiency_questions(version_id,question_number);

alter table public.word_efficiency_tests enable row level security;
alter table public.word_efficiency_versions enable row level security;
alter table public.word_efficiency_questions enable row level security;
alter table public.word_efficiency_attempts enable row level security;

create policy "Published Word tests are student readable" on public.word_efficiency_tests for select to authenticated using ((status='published' and current_version_id is not null) or public.is_aal2_admin());
create policy "AAL2 admins manage Word tests" on public.word_efficiency_tests for all to authenticated using(public.is_aal2_admin()) with check(public.is_aal2_admin());
create policy "Published Word versions are student readable" on public.word_efficiency_versions for select to authenticated using (public.is_aal2_admin() or exists(select 1 from public.word_efficiency_tests t where t.id=public.word_efficiency_versions.test_id and t.current_version_id=public.word_efficiency_versions.id and t.status='published'));
create policy "AAL2 admins insert Word versions" on public.word_efficiency_versions for insert to authenticated with check(public.is_aal2_admin() and created_by=auth.uid());
create policy "Published Word questions are student readable" on public.word_efficiency_questions for select to authenticated using (public.is_aal2_admin() or exists(select 1 from public.word_efficiency_tests t join public.word_efficiency_versions v on v.id=t.current_version_id where v.id=public.word_efficiency_questions.version_id and t.status='published'));
create policy "AAL2 admins insert Word questions" on public.word_efficiency_questions for insert to authenticated with check(public.is_aal2_admin());
create policy "Students read own Word attempts" on public.word_efficiency_attempts for select to authenticated using(student_id=auth.uid() or public.is_aal2_admin());
create policy "Students create own Word attempts" on public.word_efficiency_attempts for insert to authenticated with check(student_id=auth.uid());
create policy "AAL2 admins read Word attempts" on public.word_efficiency_attempts for select to authenticated using(public.is_aal2_admin());

revoke update,delete on public.word_efficiency_versions,public.word_efficiency_questions from authenticated;
revoke update,delete on public.word_efficiency_attempts from authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('word-efficiency-pdfs','word-efficiency-pdfs',false,15728640,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=15728640,allowed_mime_types=array['application/pdf'];

create policy "AAL2 admins manage Word PDFs" on storage.objects for all to authenticated using(bucket_id='word-efficiency-pdfs' and public.is_aal2_admin()) with check(bucket_id='word-efficiency-pdfs' and public.is_aal2_admin());
create policy "Students read assigned Word PDF" on storage.objects for select to authenticated using(bucket_id='word-efficiency-pdfs' and exists(select 1 from public.word_efficiency_attempts a where a.student_id=auth.uid() and a.delivery_method='pdf' and a.snapshot->>'pdf_path'=name));

create or replace function public.save_word_efficiency_test(p_test_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare tid uuid; vid uuid; vnum integer; publish boolean; onscreen boolean; pdf boolean; q jsonb; duration integer; question_total numeric;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  publish:=coalesce((p_payload->>'publish')::boolean,false); onscreen:=coalesce((p_payload->>'delivery_onscreen')::boolean,false); pdf:=coalesce((p_payload->>'delivery_pdf')::boolean,false);
  if nullif(btrim(p_payload->>'instructions_markdown'),'') is null then raise exception 'instructions required'; end if;
  if not onscreen and not pdf then raise exception 'delivery method required'; end if;
  if jsonb_array_length(coalesce(p_payload->'duration_options','[]'::jsonb))<1 then raise exception 'duration required'; end if;
  for duration in select value::integer from jsonb_array_elements_text(p_payload->'duration_options') loop if duration<60 or duration>14400 then raise exception 'invalid duration'; end if; end loop;
  if onscreen and jsonb_array_length(coalesce(p_payload->'questions','[]'::jsonb))<1 then raise exception 'questions required'; end if;
  if pdf and (nullif(p_payload->>'pdf_path','') is null or nullif(p_payload->>'pdf_file_name','') is null or coalesce((p_payload->>'pdf_size_bytes')::bigint,0)<=0) then raise exception 'valid PDF required'; end if;
  select coalesce(sum((item->>'marks')::numeric),0) into question_total from jsonb_array_elements(coalesce(p_payload->'questions','[]'::jsonb)) item;
  if onscreen and (jsonb_array_length(p_payload->'questions')<>(p_payload->>'question_count')::integer or question_total<>(p_payload->>'maximum_marks')::numeric) then raise exception 'question count or marks mismatch'; end if;
  if p_test_id is null then
    insert into public.word_efficiency_tests(slug,title,language,status,created_by) values(p_payload->>'slug',p_payload->>'title',p_payload->>'language',case when publish then 'published' else 'draft' end,auth.uid()) returning id into tid;
  else
    select id into tid from public.word_efficiency_tests where id=p_test_id for update; if tid is null then raise exception 'test unavailable'; end if;
    update public.word_efficiency_tests set slug=p_payload->>'slug',title=p_payload->>'title',language=p_payload->>'language',status=case when publish then 'published' else 'draft' end,updated_at=now() where id=tid;
  end if;
  select coalesce(max(version_number),0)+1 into vnum from public.word_efficiency_versions where test_id=tid;
  insert into public.word_efficiency_versions(test_id,version_number,title,language,description,instructions_markdown,delivery_onscreen,delivery_pdf,question_count,maximum_marks,duration_options,passing_marks,pdf_path,pdf_file_name,pdf_size_bytes,pdf_page_count,pdf_uploaded_at,created_by)
  values(tid,vnum,p_payload->>'title',p_payload->>'language',coalesce(p_payload->>'description',''),p_payload->>'instructions_markdown',onscreen,pdf,(p_payload->>'question_count')::integer,(p_payload->>'maximum_marks')::numeric,array(select value::integer from jsonb_array_elements_text(p_payload->'duration_options')),nullif(p_payload->>'passing_marks','')::numeric,nullif(p_payload->>'pdf_path',''),nullif(p_payload->>'pdf_file_name',''),nullif(p_payload->>'pdf_size_bytes','')::bigint,nullif(p_payload->>'pdf_page_count','')::integer,case when pdf then coalesce((p_payload->>'pdf_uploaded_at')::timestamptz,now()) end,auth.uid()) returning id into vid;
  if onscreen then for q in select value from jsonb_array_elements(p_payload->'questions') loop insert into public.word_efficiency_questions(version_id,question_number,instruction,marks,sample_text) values(vid,(q->>'number')::integer,q->>'instruction',(q->>'marks')::numeric,nullif(q->>'sample_text','')); end loop; end if;
  update public.word_efficiency_tests set current_version_id=vid,current_version_number=vnum,published_at=case when publish then coalesce(published_at,now()) else published_at end where id=tid;
  return tid;
end $$;

create or replace function public.prepare_word_efficiency_attempt(p_test_id uuid,p_duration_seconds integer,p_delivery text)
returns uuid language plpgsql security definer set search_path=public as $$
declare t public.word_efficiency_tests%rowtype; v public.word_efficiency_versions%rowtype; aid uuid; questions jsonb;
begin
  select * into t from public.word_efficiency_tests where id=p_test_id and status='published'; if not found then raise exception 'test unavailable'; end if;
  select * into v from public.word_efficiency_versions where id=t.current_version_id;
  if not p_duration_seconds=any(v.duration_options) then raise exception 'duration unavailable'; end if;
  if p_delivery not in ('onscreen','pdf') or (p_delivery='onscreen' and not v.delivery_onscreen) or (p_delivery='pdf' and not v.delivery_pdf) then raise exception 'delivery unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'number',q.question_number,'instruction',q.instruction,'marks',q.marks,'sample_text',q.sample_text) order by q.question_number),'[]'::jsonb) into questions from public.word_efficiency_questions q where q.version_id=v.id;
  insert into public.word_efficiency_attempts(test_id,version_id,student_id,delivery_method,selected_duration_seconds,snapshot)
  values(t.id,v.id,auth.uid(),p_delivery,p_duration_seconds,jsonb_build_object('test_id',t.id,'test_version_id',v.id,'instructions_version_id',v.id,'question_version_id',v.id,'title',v.title,'language',v.language,'instructions_markdown',v.instructions_markdown,'delivery_method',p_delivery,'duration_seconds',p_duration_seconds,'question_count',v.question_count,'maximum_marks',v.maximum_marks,'questions',questions,'pdf_path',case when p_delivery='pdf' then v.pdf_path end,'pdf_file_name',case when p_delivery='pdf' then v.pdf_file_name end,'pdf_size_bytes',case when p_delivery='pdf' then v.pdf_size_bytes end,'pdf_page_count',case when p_delivery='pdf' then v.pdf_page_count end,'pdf_uploaded_at',case when p_delivery='pdf' then v.pdf_uploaded_at end)) returning id into aid;
  return aid;
end $$;

create or replace function public.start_word_efficiency_attempt(p_attempt_id uuid)
returns timestamptz language plpgsql security definer set search_path=public as $$ declare stamp timestamptz; begin update public.word_efficiency_attempts set status='active',started_at=coalesce(started_at,now()),updated_at=now() where id=p_attempt_id and student_id=auth.uid() and status in ('prepared','active') returning started_at into stamp; if stamp is null then raise exception 'attempt unavailable'; end if; return stamp; end $$;

create or replace function public.set_word_efficiency_status(p_test_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$ begin if not public.is_aal2_admin() then raise exception 'not authorized'; end if; if p_status not in ('published','unpublished','archived') then raise exception 'invalid status'; end if; update public.word_efficiency_tests set status=p_status,archived_at=case when p_status='archived' then now() end,published_at=case when p_status='published' then coalesce(published_at,now()) else published_at end,updated_at=now() where id=p_test_id; end $$;

create or replace function public.delete_word_efficiency_test(p_test_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$ begin if not public.is_aal2_admin() then raise exception 'not authorized'; end if; if exists(select 1 from public.word_efficiency_attempts where test_id=p_test_id) then return false; end if; update public.word_efficiency_tests set current_version_id=null where id=p_test_id; delete from public.word_efficiency_questions where version_id in(select id from public.word_efficiency_versions where test_id=p_test_id); delete from public.word_efficiency_versions where test_id=p_test_id; delete from public.word_efficiency_tests where id=p_test_id; return found; end $$;

revoke all on function public.save_word_efficiency_test(uuid,jsonb),public.prepare_word_efficiency_attempt(uuid,integer,text),public.start_word_efficiency_attempt(uuid),public.set_word_efficiency_status(uuid,text),public.delete_word_efficiency_test(uuid) from public,anon;
grant execute on function public.save_word_efficiency_test(uuid,jsonb),public.prepare_word_efficiency_attempt(uuid,integer,text),public.start_word_efficiency_attempt(uuid),public.set_word_efficiency_status(uuid,text),public.delete_word_efficiency_test(uuid) to authenticated;
commit;

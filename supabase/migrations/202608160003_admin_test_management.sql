-- Additive, versioned admin test-management foundation.
-- Phase 1 is read-only and fails before any schema or data change.
begin;
set transaction read only;
do $$
declare missing text[]; extension_count integer; managed_table_count integer;
begin
  if to_regclass('public.tests') is null or to_regclass('public.profiles') is null then raise exception 'Preflight failed: public.tests and public.profiles are required'; end if;
  select array_agg(required.name) into missing from (values ('id'),('title'),('slug'),('test_type'),('language'),('status'),('duration_seconds'),('instructions'),('content'),('settings'),('created_by'),('published_at'),('created_at'),('updated_at')) required(name)
    where not exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='tests' and c.column_name=required.name);
  if missing is not null then raise exception 'Preflight failed: public.tests is missing required columns: %', array_to_string(missing, ', '); end if;
  if to_regtype('public.test_status') is null or to_regtype('public.test_type') is null then raise exception 'Preflight failed: public.test_status and public.test_type enums are required'; end if;
  if exists(select 1 from (values ('draft'),('published'),('archived')) e(label) where not exists(select 1 from pg_enum pe join pg_type pt on pt.oid=pe.enumtypid join pg_namespace pn on pn.oid=pt.typnamespace where pn.nspname='public' and pt.typname='test_status' and pe.enumlabel=e.label)) then raise exception 'Preflight failed: public.test_status must contain draft, published and archived'; end if;
  if exists(select 1 from (values ('typing'),('stenography')) e(label) where not exists(select 1 from pg_enum pe join pg_type pt on pt.oid=pe.enumtypid join pg_namespace pn on pn.oid=pt.typnamespace where pn.nspname='public' and pt.typname='test_type' and pe.enumlabel=e.label)) then raise exception 'Preflight failed: public.test_type must contain typing and stenography'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'Preflight failed: public.is_admin() is required'; end if;
  if exists(select 1 from (values ('Anyone can view published tests'),('Admins can create tests'),('Admins can update tests'),('Admins can delete tests')) p(name) where not exists(select 1 from pg_policies where schemaname='public' and tablename='tests' and policyname=p.name)) then raise exception 'Preflight failed: one or more required public.tests policies are missing or renamed'; end if;
  select count(*) into extension_count from information_schema.columns where table_schema='public' and table_name='tests' and column_name in ('description','mode','input_system_id','visibility','current_version_number','assignment_scope','archived_at','current_version_id');
  select count(*) into managed_table_count from (values ('test_versions'),('test_attempts'),('admin_test_audit_log')) t(name) where to_regclass('public.'||t.name) is not null;
  if extension_count not in (0,8) or managed_table_count not in (0,3) or (extension_count=0) <> (managed_table_count=0) then raise exception 'Preflight failed: partial admin-test migration detected (extension columns %, managed tables %). Inspect before rerunning', extension_count, managed_table_count; end if;
  if managed_table_count=3 and exists(select 1 from (values ('id'),('test_id'),('version_number'),('title'),('language'),('duration_seconds'),('passage'),('configuration'),('created_by')) c(name) where not exists(select 1 from information_schema.columns ic where ic.table_schema='public' and ic.table_name='test_versions' and ic.column_name=c.name)) then raise exception 'Preflight failed: existing public.test_versions has an incomplete shape'; end if;
  if exists(select 1 from public.tests where language is null or language not in ('English','Hindi')) then raise exception 'Preflight failed: every existing test must have language English or Hindi'; end if;
  if exists(select 1 from public.tests where duration_seconds is null or duration_seconds <= 0 or duration_seconds > 7200) then raise exception 'Preflight failed: existing test duration_seconds must be between 1 and 7200'; end if;
  if exists(select 1 from public.tests where nullif(content->>'passage','') is null or char_length(content->>'passage') < 20 or char_length(content->>'passage') > 100000) then raise exception 'Preflight failed: every existing test needs content.passage between 20 and 100000 characters'; end if;
end $$;
commit;

-- PostgreSQL requires a newly added enum value to be committed before later use.
alter type public.test_status add value if not exists 'unpublished';

-- Phase 2 is atomic: schema, backfill, functions, privileges and policies.
begin;
do $$ begin create type public.test_mode as enum ('learn', 'practice', 'exam', 'stenography'); exception when duplicate_object then null; end $$;
do $$ begin create type public.test_visibility as enum ('public', 'private'); exception when duplicate_object then null; end $$;

alter table public.tests add column if not exists description text;
alter table public.tests add column if not exists mode public.test_mode not null default 'practice';
alter table public.tests add column if not exists input_system_id text not null default 'english-qwerty';
alter table public.tests add column if not exists visibility public.test_visibility not null default 'private';
alter table public.tests add column if not exists current_version_number integer not null default 0;
alter table public.tests add column if not exists assignment_scope jsonb not null default '{}'::jsonb;
alter table public.tests add column if not exists archived_at timestamptz;

create table if not exists public.test_versions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  title text not null,
  description text,
  language text not null check (language in ('English', 'Hindi')),
  mode public.test_mode not null,
  input_system_id text not null,
  duration_seconds integer not null check (duration_seconds between 1 and 7200),
  passage text not null check (char_length(passage) between 20 and 100000),
  required_wpm numeric(6,2) not null check (required_wpm between 0 and 300),
  required_accuracy numeric(5,2) not null check (required_accuracy between 0 and 100),
  backspace_mode text not null check (backspace_mode in ('full', 'word', 'disabled')),
  word_method text not null check (word_method in ('characters', 'spaces')),
  highlight_mode text not null check (highlight_mode in ('character', 'word', 'none')),
  visibility public.test_visibility not null,
  passage_characters integer not null check (passage_characters >= 0),
  passage_words integer not null check (passage_words >= 0),
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(test_id, version_number)
);

alter table public.tests add column if not exists current_version_id uuid references public.test_versions(id) on delete restrict;

-- Durable legacy marker: managed tests always have a current version. Only
-- published rows that are still entirely unmanaged inherit public visibility.
update public.tests set visibility='public'::public.test_visibility
where status='published'
  and current_version_id is null
  and current_version_number=0;

-- Backfill exactly one version only for tests that have no version at all.
insert into public.test_versions(test_id,version_number,title,description,language,mode,input_system_id,duration_seconds,passage,required_wpm,required_accuracy,backspace_mode,word_method,highlight_mode,visibility,passage_characters,passage_words,configuration,created_by,created_at)
select t.id,1,t.title,coalesce(t.description,t.instructions),t.language,
  case when t.test_type='stenography' then 'stenography'::public.test_mode else 'practice'::public.test_mode end,
  coalesce(nullif(t.settings->>'inputSystemId',''),case when t.language='Hindi' then 'hindi-unicode-mangal' else 'english-qwerty' end),
  t.duration_seconds,t.content->>'passage',
  case when coalesce(t.settings->>'requiredWpm','') ~ '^[0-9]+([.][0-9]+)?$' then least((t.settings->>'requiredWpm')::numeric,300) else 0 end,
  case when coalesce(t.settings->>'requiredAccuracy','') ~ '^[0-9]+([.][0-9]+)?$' then least((t.settings->>'requiredAccuracy')::numeric,100) else 0 end,
  case when t.settings->>'backspaceMode' in ('full','word','disabled') then t.settings->>'backspaceMode' else 'full' end,
  case when t.settings->>'wordMethod' in ('characters','spaces') then t.settings->>'wordMethod' else 'characters' end,
  case when t.settings->>'highlightMode' in ('character','word','none') then t.settings->>'highlightMode' when t.settings->>'highlightMode'='highlight' then 'character' else 'character' end,
  t.visibility,char_length(t.content->>'passage'),case when btrim(t.content->>'passage')='' then 0 else cardinality(regexp_split_to_array(btrim(t.content->>'passage'),'\s+')) end,
  coalesce(t.settings,'{}'::jsonb)||jsonb_build_object('legacy_content',t.content,'legacy_test_type',t.test_type,'legacy_status',t.status),
  t.created_by,t.created_at
from public.tests t
where not exists(select 1 from public.test_versions v where v.test_id=t.id);

update public.tests t set current_version_id=v.id,current_version_number=v.version_number
from public.test_versions v where v.test_id=t.id and v.version_number=1 and t.current_version_id is null;

do $$ begin
  if exists(select 1 from public.tests t where t.current_version_id is null or t.current_version_number < 1 or not exists(select 1 from public.test_versions v where v.id=t.current_version_id and v.test_id=t.id)) then
    raise exception 'Backfill failed: every test must reference a valid immutable version';
  end if;
end $$;
create index if not exists tests_admin_catalog on public.tests(status, mode, language, updated_at desc);
create index if not exists tests_student_catalog on public.tests(status, visibility, published_at desc);
create index if not exists test_versions_test on public.test_versions(test_id, version_number desc);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete restrict,
  test_version_id uuid not null references public.test_versions(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  snapshot jsonb not null,
  result jsonb not null,
  started_at timestamptz not null,
  submitted_at timestamptz not null default now()
);
create index if not exists test_attempts_test on public.test_attempts(test_id, submitted_at desc);
create index if not exists test_attempts_student on public.test_attempts(student_id, submitted_at desc);

create table if not exists public.admin_test_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  test_id uuid references public.tests(id) on delete set null,
  test_version_id uuid references public.test_versions(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_test_audit_test on public.admin_test_audit_log(test_id, created_at desc);

alter table public.test_versions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.admin_test_audit_log enable row level security;

create or replace function public.is_aal2_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt()->>'aal') = 'aal2', false) and public.is_admin();
$$;

alter policy "Anyone can view published tests" on public.tests
  using ((status = 'published' and visibility = 'public') or public.is_aal2_admin());
alter policy "Admins can create tests" on public.tests
  with check (public.is_aal2_admin() and created_by = auth.uid());
alter policy "Admins can update tests" on public.tests
  using (public.is_aal2_admin()) with check (public.is_aal2_admin());
alter policy "Admins can delete tests" on public.tests
  using (public.is_aal2_admin());

drop policy if exists "Published versions are readable" on public.test_versions;
create policy "Published versions are readable" on public.test_versions for select
  using (exists (select 1 from public.tests t where t.id = test_id and t.current_version_id = id and t.status = 'published' and t.visibility = 'public') or public.is_aal2_admin());
drop policy if exists "AAL2 admins create immutable versions" on public.test_versions;
create policy "AAL2 admins create immutable versions" on public.test_versions for insert to authenticated
  with check (public.is_aal2_admin() and created_by = auth.uid());

drop policy if exists "Students insert own attempts" on public.test_attempts;
create policy "Students insert own attempts" on public.test_attempts for insert to authenticated
  with check (student_id = auth.uid() and exists (select 1 from public.tests t where t.id = test_id and t.current_version_id = test_version_id and t.status = 'published' and t.visibility = 'public'));
drop policy if exists "Students read own attempts" on public.test_attempts;
create policy "Students read own attempts" on public.test_attempts for select to authenticated
  using (student_id = auth.uid() or public.is_aal2_admin());
drop policy if exists "AAL2 admins read audit events" on public.admin_test_audit_log;
create policy "AAL2 admins read audit events" on public.admin_test_audit_log for select to authenticated
  using (public.is_aal2_admin());
drop policy if exists "AAL2 admins create audit events" on public.admin_test_audit_log;
create policy "AAL2 admins create audit events" on public.admin_test_audit_log for insert to authenticated
  with check (public.is_aal2_admin() and actor_user_id = auth.uid());

revoke update, delete on public.test_versions from authenticated;
revoke update, delete on public.test_attempts from authenticated;
revoke update, delete on public.admin_test_audit_log from authenticated;

create or replace function public.save_managed_test(p_test_id uuid, p_payload jsonb, p_publish boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_test_id uuid; v_version integer; v_version_id uuid; v_status public.test_status;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  v_status := case when p_publish then 'published'::public.test_status else 'draft'::public.test_status end;
  if p_test_id is null then
    insert into public.tests(title, slug, test_type, language, status, duration_seconds, instructions, content, settings, created_by, description, mode, input_system_id, visibility)
    values (p_payload->>'title', p_payload->>'slug', case when p_payload->>'mode' = 'stenography' then 'stenography'::public.test_type else 'typing'::public.test_type end,
      p_payload->>'language', v_status, (p_payload->>'duration_seconds')::integer, nullif(p_payload->>'description',''),
      jsonb_build_object('passage', p_payload->>'passage'), p_payload, auth.uid(), nullif(p_payload->>'description',''),
      (p_payload->>'mode')::public.test_mode, p_payload->>'input_system_id', (p_payload->>'visibility')::public.test_visibility)
    returning id into v_test_id;
  else
    if not exists(select 1 from public.tests where id = p_test_id) then raise exception 'test unavailable'; end if;
    v_test_id := p_test_id;
    update public.tests set title=p_payload->>'title', slug=p_payload->>'slug', language=p_payload->>'language',
      duration_seconds=(p_payload->>'duration_seconds')::integer, description=nullif(p_payload->>'description',''),
      mode=(p_payload->>'mode')::public.test_mode, input_system_id=p_payload->>'input_system_id',
      visibility=(p_payload->>'visibility')::public.test_visibility, status=v_status,
      content=jsonb_build_object('passage', p_payload->>'passage'), settings=p_payload, updated_at=now()
    where id=v_test_id;
  end if;
  select coalesce(max(version_number),0)+1 into v_version from public.test_versions where test_id=v_test_id;
  insert into public.test_versions(test_id,version_number,title,description,language,mode,input_system_id,duration_seconds,passage,required_wpm,required_accuracy,backspace_mode,word_method,highlight_mode,visibility,passage_characters,passage_words,configuration,created_by)
  values(v_test_id,v_version,p_payload->>'title',nullif(p_payload->>'description',''),p_payload->>'language',(p_payload->>'mode')::public.test_mode,p_payload->>'input_system_id',(p_payload->>'duration_seconds')::integer,p_payload->>'passage',(p_payload->>'required_wpm')::numeric,(p_payload->>'required_accuracy')::numeric,p_payload->>'backspace_mode',p_payload->>'word_method',p_payload->>'highlight_mode',(p_payload->>'visibility')::public.test_visibility,(p_payload->>'passage_characters')::integer,(p_payload->>'passage_words')::integer,p_payload,auth.uid()) returning id into v_version_id;
  update public.tests set current_version_id=v_version_id,current_version_number=v_version,
    published_at=case when p_publish then coalesce(published_at,now()) else published_at end where id=v_test_id;
  insert into public.admin_test_audit_log(actor_user_id,test_id,test_version_id,action,metadata)
    values(auth.uid(),v_test_id,v_version_id,case when p_test_id is null then 'test_created' else 'test_version_created' end,jsonb_build_object('published',p_publish,'version',v_version));
  return v_test_id;
end; $$;

create or replace function public.set_managed_test_status(p_test_id uuid, p_status public.test_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_status not in ('draft','published','unpublished','archived') then raise exception 'invalid status'; end if;
  if p_status='published' and not exists(select 1 from public.tests where id=p_test_id and current_version_id is not null) then raise exception 'version required'; end if;
  update public.tests set status=p_status,
    published_at=case when p_status='published' then coalesce(published_at,now()) else published_at end,
    archived_at=case when p_status='archived' then now() else null end, updated_at=now() where id=p_test_id;
  if not found then raise exception 'test unavailable'; end if;
  insert into public.admin_test_audit_log(actor_user_id,test_id,action,metadata) values(auth.uid(),p_test_id,'test_status_changed',jsonb_build_object('status',p_status));
end; $$;

create or replace function public.duplicate_managed_test(p_test_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare source public.tests%rowtype; payload jsonb; new_id uuid;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  select * into source from public.tests where id=p_test_id;
  select configuration into payload from public.test_versions where id=source.current_version_id;
  if payload is null then raise exception 'version unavailable'; end if;
  payload := jsonb_set(jsonb_set(payload,'{title}',to_jsonb((payload->>'title') || ' Copy')),'{slug}',to_jsonb((payload->>'slug') || '-copy-' || substr(gen_random_uuid()::text,1,6)));
  new_id := public.save_managed_test(null,payload,false);
  insert into public.admin_test_audit_log(actor_user_id,test_id,action,metadata) values(auth.uid(),new_id,'test_duplicated',jsonb_build_object('source_test_id',p_test_id));
  return new_id;
end; $$;

create or replace function public.delete_managed_test_if_safe(p_test_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if exists(select 1 from public.test_attempts where test_id=p_test_id) then return false; end if;
  insert into public.admin_test_audit_log(actor_user_id,test_id,action) values(auth.uid(),p_test_id,'test_deleted');
  update public.tests set current_version_id=null where id=p_test_id;
  delete from public.test_versions where test_id=p_test_id;
  delete from public.tests where id=p_test_id;
  return found;
end; $$;

revoke all on function public.save_managed_test(uuid,jsonb,boolean) from public,anon;
revoke all on function public.set_managed_test_status(uuid,public.test_status) from public,anon;
revoke all on function public.duplicate_managed_test(uuid) from public,anon;
revoke all on function public.delete_managed_test_if_safe(uuid) from public,anon;
grant execute on function public.save_managed_test(uuid,jsonb,boolean) to authenticated;
grant execute on function public.set_managed_test_status(uuid,public.test_status) to authenticated;
grant execute on function public.duplicate_managed_test(uuid) to authenticated;
grant execute on function public.delete_managed_test_if_safe(uuid) to authenticated;
commit;

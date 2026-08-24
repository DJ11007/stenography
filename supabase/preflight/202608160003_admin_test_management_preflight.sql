-- Read-only preflight. It reports structure and counts only; no identities,
-- credentials, settings payloads or passage content are selected.
with required_tables(name) as (values ('profiles'),('tests')),
required_columns(name) as (values ('id'),('title'),('slug'),('test_type'),('language'),('status'),('duration_seconds'),('instructions'),('content'),('settings'),('created_by'),('published_at'),('created_at'),('updated_at')),
required_enums(name) as (values ('test_status'),('test_type')),
required_functions(name,signature) as (values ('is_admin','public.is_admin()'))
select 'required_table' as category,name as item,(to_regclass('public.'||name) is not null)::text as value from required_tables
union all
select 'required_tests_column',name,exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='tests' and c.column_name=required_columns.name)::text from required_columns
union all
select 'required_enum',name,(to_regtype('public.'||name) is not null)::text from required_enums
union all
select 'existing_enum_label',pt.typname,pe.enumlabel from pg_enum pe join pg_type pt on pt.oid=pe.enumtypid join pg_namespace pn on pn.oid=pt.typnamespace where pn.nspname='public' and pt.typname in ('test_status','test_type')
union all
select 'required_function',name,(to_regprocedure(signature) is not null)::text from required_functions
union all
select 'existing_tests_policy',policyname,coalesce(cmd,'') from pg_policies where schemaname='public' and tablename='tests'
union all
select 'test_count_by_status',status::text,count(*)::text from public.tests group by status
union all
select 'published_test_count','published',count(*)::text from public.tests where status='published'
union all
select 'managed_table_presence',name,(to_regclass('public.'||name) is not null)::text from (values ('test_versions'),('test_attempts'),('admin_test_audit_log')) t(name)
union all
select 'managed_tests_column_presence',name,exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='tests' and c.column_name=t.name)::text from (values ('description'),('mode'),('input_system_id'),('visibility'),('current_version_number'),('assignment_scope'),('archived_at'),('current_version_id')) t(name)
order by category,item;

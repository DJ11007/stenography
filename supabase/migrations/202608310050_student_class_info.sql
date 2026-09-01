begin;

-- A simple, admin-set free-text label per student (e.g. "LDC", "Batch 2")
-- for the admin's own organizational use -- deliberately NOT a new
-- teacher role, login, or student-grouping/enrollment system (the user
-- explicitly asked for just a label on top of the existing single-admin
-- model, not real multi-tenant class ownership). No RLS change needed:
-- this is a plain column on the existing profiles row, covered by
-- whatever select policy already lets a student read their own profile
-- and an admin read/manage any profile.

alter table public.profiles add column if not exists class_info text;

create or replace function public.admin_set_student_class_info(p_student_id uuid, p_class_info text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_aal2_admin() then raise exception 'not authorized';end if;
 update public.profiles set class_info=nullif(trim(p_class_info),''), updated_at=now() where id=p_student_id and role='student';
 if not found then raise exception 'student not found';end if;
end $$;

revoke all on function public.admin_set_student_class_info(uuid,text) from public,anon;
grant execute on function public.admin_set_student_class_info(uuid,text) to authenticated;

commit;

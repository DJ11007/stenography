-- Student photos (Live Exam Center candidate panel, the student profile): a private storage bucket where a student
-- keeps their own photo under "<their id>/…" and an admin can add or change anyone's, the photo's path on the
-- profile, and set_profile_photo to record it (a student only their own; an admin anyone's).
-- Images only (JPEG / PNG / WebP), up to 2 MB. Safe to run twice.
begin;

alter table public.profiles add column if not exists photo_path text;
alter table public.profiles drop constraint if exists profiles_photo_path_shape;
alter table public.profiles add constraint profiles_photo_path_shape check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$');

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('student-photos', 'student-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Students manage own photo" on storage.objects;
create policy "Students manage own photo" on storage.objects for all to authenticated
  using (bucket_id = 'student-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'student-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "AAL2 admins manage student photos" on storage.objects;
create policy "AAL2 admins manage student photos" on storage.objects for all to authenticated
  using (bucket_id = 'student-photos' and public.is_aal2_admin())
  with check (bucket_id = 'student-photos' and public.is_aal2_admin());

create or replace function public.set_profile_photo(p_student_id uuid, p_path text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or (p_student_id <> auth.uid() and not public.is_aal2_admin()) then raise exception 'not authorized'; end if;
  if p_path is not null and (left(p_path, 37) <> p_student_id::text || '/' or p_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$') then raise exception 'invalid photo path'; end if;
  update public.profiles set photo_path = p_path where id = p_student_id;
  if not found then raise exception 'student not found'; end if;
end $$;
revoke all on function public.set_profile_photo(uuid, text) from public, anon;
grant execute on function public.set_profile_photo(uuid, text) to authenticated;

commit;

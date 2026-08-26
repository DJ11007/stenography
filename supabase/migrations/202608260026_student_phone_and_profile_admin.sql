begin;

-- Admin asked to see students' phone numbers alongside their profile, but no
-- phone was ever collected at signup. Add an optional column and start
-- capturing it going forward (existing students will simply show none).
alter table public.profiles add column if not exists phone text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    lower(new.email),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  );
  return new;
end;
$$;

commit;

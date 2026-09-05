-- Students no longer get sign-in access purely from confirming their email --
-- an admin must manually approve the account first. New profile rows default
-- to unapproved; existing accounts and all admins are grandfathered in so
-- nobody who could already sign in gets locked out by this migration.
alter table public.profiles add column approved boolean not null default false;

update public.profiles set approved = true where role = 'admin' or created_at < now();

-- Students could already update their own `is_active`-protected profile row;
-- pin `approved` the same way so a student can never flip their own approval
-- state via a direct table update, only an admin (via the "manage profiles"
-- policy) can.
drop policy if exists "Users can update their own name" on public.profiles;
create policy "Users can update their own name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and is_active = (select is_active from public.profiles where id = auth.uid())
    and approved = (select approved from public.profiles where id = auth.uid())
  );

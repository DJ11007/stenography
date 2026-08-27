-- A simple admin-posted announcements feed ("Classroom"), plus a single site-wide
-- Live Class link the admin can turn on/off, mirroring the homepage-content pattern.

create table if not exists public.classroom_updates(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  is_published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.classroom_updates enable row level security;
create index if not exists classroom_updates_public_listing on public.classroom_updates(is_published,display_order,created_at desc);

create table if not exists public.live_class_settings(
  id boolean primary key default true,
  url text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint live_class_settings_singleton check (id)
);
alter table public.live_class_settings enable row level security;
insert into public.live_class_settings(id,url,is_active) values (true,null,false) on conflict(id) do nothing;

-- Public reads --------------------------------------------------------------

create or replace function public.list_published_classroom_updates(p_limit integer default 20)
returns setof public.classroom_updates
language sql stable security definer set search_path=public as $$
  select * from public.classroom_updates where is_published order by display_order,created_at desc limit greatest(1,least(coalesce(p_limit,20),100));
$$;

create or replace function public.get_live_class_link()
returns public.live_class_settings
language sql stable security definer set search_path=public as $$
  select * from public.live_class_settings where id=true;
$$;

grant execute on function public.list_published_classroom_updates(integer),public.get_live_class_link() to anon,authenticated;

-- Admin: classroom updates ----------------------------------------------------

create or replace function public.admin_list_classroom_updates()
returns setof public.classroom_updates
language sql stable security definer set search_path=public as $$
  select * from public.classroom_updates order by display_order,created_at desc;
$$;

create or replace function public.admin_save_classroom_update(
  p_id uuid,p_title text,p_body text,p_is_published boolean,p_display_order integer
) returns public.classroom_updates
language plpgsql security definer set search_path=public as $$
declare row public.classroom_updates;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if trim(coalesce(p_title,''))='' then raise exception 'Title is required.'; end if;
  if p_id is null then
    insert into public.classroom_updates(title,body,is_published,display_order,created_by)
    values(p_title,coalesce(p_body,''),coalesce(p_is_published,true),coalesce(p_display_order,0),auth.uid())
    returning * into row;
  else
    update public.classroom_updates set
      title=p_title,body=coalesce(p_body,''),is_published=coalesce(p_is_published,true),
      display_order=coalesce(p_display_order,0),updated_at=now()
    where id=p_id returning * into row;
    if row.id is null then raise exception 'Update not found.'; end if;
  end if;
  return row;
end;
$$;

create or replace function public.admin_delete_classroom_update(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  delete from public.classroom_updates where id=p_id;
end;
$$;

create or replace function public.admin_set_live_class_link(p_url text,p_is_active boolean) returns public.live_class_settings
language plpgsql security definer set search_path=public as $$
declare row public.live_class_settings;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if coalesce(p_is_active,false) and (p_url is null or trim(p_url)='' or p_url !~ '^https?://') then
    raise exception 'A valid http:// or https:// link is required to activate the live class.';
  end if;
  update public.live_class_settings set url=nullif(trim(coalesce(p_url,'')),''),is_active=coalesce(p_is_active,false),updated_at=now(),updated_by=auth.uid()
  where id=true returning * into row;
  return row;
end;
$$;

revoke all on function public.admin_list_classroom_updates(),public.admin_save_classroom_update(uuid,text,text,boolean,integer),public.admin_delete_classroom_update(uuid),public.admin_set_live_class_link(text,boolean) from public,anon;
grant execute on function public.admin_list_classroom_updates(),public.admin_save_classroom_update(uuid,text,text,boolean,integer),public.admin_delete_classroom_update(uuid),public.admin_set_live_class_link(text,boolean) to authenticated;

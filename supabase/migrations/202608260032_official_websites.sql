-- A curated, admin-managed directory of official examination-authority websites
-- (RSSB, RPSC, SSC, etc.). Unlike vacancy notices, clicking these intentionally
-- navigates the student away to the real official site.

create table if not exists public.official_websites(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  description text not null default '',
  is_published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.official_websites enable row level security;

create or replace function public.list_published_official_websites()
returns setof public.official_websites
language sql stable security definer set search_path=public as $$
  select * from public.official_websites where is_published order by display_order,created_at;
$$;

create or replace function public.admin_list_official_websites()
returns setof public.official_websites
language sql stable security definer set search_path=public as $$
  select * from public.official_websites order by display_order,created_at;
$$;

create or replace function public.admin_save_official_website(
  p_id uuid,p_name text,p_url text,p_description text,p_is_published boolean,p_display_order integer
) returns public.official_websites
language plpgsql security definer set search_path=public as $$
declare row public.official_websites;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if trim(coalesce(p_name,''))='' then raise exception 'Name is required.'; end if;
  if p_url !~ '^https?://' then raise exception 'Website link must start with http:// or https://.'; end if;
  if p_id is null then
    insert into public.official_websites(name,url,description,is_published,display_order,created_by)
    values(p_name,p_url,coalesce(p_description,''),coalesce(p_is_published,true),coalesce(p_display_order,0),auth.uid())
    returning * into row;
  else
    update public.official_websites set
      name=p_name,url=p_url,description=coalesce(p_description,''),
      is_published=coalesce(p_is_published,true),display_order=coalesce(p_display_order,0),updated_at=now()
    where id=p_id returning * into row;
    if row.id is null then raise exception 'Official website not found.'; end if;
  end if;
  return row;
end;
$$;

create or replace function public.admin_delete_official_website(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  delete from public.official_websites where id=p_id;
end;
$$;

revoke all on function public.admin_list_official_websites(),public.admin_save_official_website(uuid,text,text,text,boolean,integer),public.admin_delete_official_website(uuid) from public,anon;
grant execute on function public.admin_list_official_websites(),public.admin_save_official_website(uuid,text,text,text,boolean,integer),public.admin_delete_official_website(uuid) to authenticated;
grant execute on function public.list_published_official_websites() to anon,authenticated;

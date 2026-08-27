-- Sarkari-Result-style richer vacancy detail sections: a post-wise vacancy breakdown table
-- and a "useful links" table (zone-wise results, score cards, etc.), both admin-authored.

alter table public.vacancy_notices add column if not exists vacancy_breakdown jsonb not null default '[]'::jsonb;
alter table public.vacancy_notices add column if not exists useful_links jsonb not null default '[]'::jsonb;

-- CHECK constraints cannot contain a bare subquery, so the per-element validation
-- lives in these two IMMUTABLE helper functions instead.
create or replace function public.valid_vacancy_breakdown(p_value jsonb) returns boolean
language sql immutable as $$
  select coalesce(bool_and(
    jsonb_typeof(item)='object'
    and item ? 'postName' and jsonb_typeof(item->'postName')='string'
    and item ? 'totalPosts' and jsonb_typeof(item->'totalPosts')='string'
    and item ? 'eligibility' and jsonb_typeof(item->'eligibility')='string'
  ), true) from jsonb_array_elements(p_value) as item
$$;

create or replace function public.valid_useful_links(p_value jsonb) returns boolean
language sql immutable as $$
  select coalesce(bool_and(
    jsonb_typeof(item)='object'
    and item ? 'label' and jsonb_typeof(item->'label')='string'
    and item ? 'url' and jsonb_typeof(item->'url')='string' and (item->>'url') ~ '^https?://'
  ), true) from jsonb_array_elements(p_value) as item
$$;

alter table public.vacancy_notices drop constraint if exists vacancy_notices_vacancy_breakdown_shape;
alter table public.vacancy_notices add constraint vacancy_notices_vacancy_breakdown_shape check (
  jsonb_typeof(vacancy_breakdown)='array' and public.valid_vacancy_breakdown(vacancy_breakdown)
);

alter table public.vacancy_notices drop constraint if exists vacancy_notices_useful_links_shape;
alter table public.vacancy_notices add constraint vacancy_notices_useful_links_shape check (
  jsonb_typeof(useful_links)='array' and public.valid_useful_links(useful_links)
);

drop function if exists public.admin_save_vacancy_notice(uuid,text,text,text,text,text,text[],text[],text[],text[],text,text,boolean,integer,text);

create or replace function public.admin_save_vacancy_notice(
  p_id uuid,p_category text,p_title text,p_organization text,p_summary text,p_status text,
  p_important_dates text[],p_application_fees text[],p_eligibility text[],p_age_limit text[],
  p_notification_url text,p_official_url text,p_is_published boolean,p_display_order integer,p_slug text default null,
  p_vacancy_breakdown jsonb default '[]'::jsonb,p_useful_links jsonb default '[]'::jsonb
) returns public.vacancy_notices
language plpgsql security definer set search_path=public as $$
declare row public.vacancy_notices; base_slug text; final_slug text; suffix integer:=0;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_category not in ('jobs','admit-cards','results') then raise exception 'Invalid category.'; end if;
  if trim(coalesce(p_title,''))='' then raise exception 'Title is required.'; end if;
  if p_notification_url is not null and p_notification_url!='' and p_notification_url !~ '^https?://' then raise exception 'Notification link must start with http:// or https://.'; end if;
  if p_official_url is not null and p_official_url!='' and p_official_url !~ '^https?://' then raise exception 'Official link must start with http:// or https://.'; end if;
  if jsonb_typeof(coalesce(p_vacancy_breakdown,'[]'::jsonb))!='array' then raise exception 'Invalid vacancy breakdown.'; end if;
  if jsonb_typeof(coalesce(p_useful_links,'[]'::jsonb))!='array' then raise exception 'Invalid useful links.'; end if;
  if p_id is not null then
    update public.vacancy_notices set
      category=p_category,title=p_title,organization=coalesce(p_organization,''),summary=coalesce(p_summary,''),status=coalesce(p_status,''),
      important_dates=coalesce(p_important_dates,'{}'),application_fees=coalesce(p_application_fees,'{}'),
      eligibility=coalesce(p_eligibility,'{}'),age_limit=coalesce(p_age_limit,'{}'),
      notification_url=nullif(trim(coalesce(p_notification_url,'')),''),official_url=nullif(trim(coalesce(p_official_url,'')),''),
      is_published=coalesce(p_is_published,true),display_order=coalesce(p_display_order,0),
      vacancy_breakdown=coalesce(p_vacancy_breakdown,'[]'::jsonb),useful_links=coalesce(p_useful_links,'[]'::jsonb),
      updated_at=now()
    where id=p_id returning * into row;
    if row.id is null then raise exception 'Vacancy notice not found.'; end if;
    return row;
  end if;
  base_slug:=coalesce(nullif(public.slugify_homepage_text(p_slug),''),nullif(public.slugify_homepage_text(p_title),''),'vacancy');
  final_slug:=base_slug;
  while exists(select 1 from public.vacancy_notices where slug=final_slug) loop
    suffix:=suffix+1; final_slug:=base_slug||'-'||suffix;
  end loop;
  insert into public.vacancy_notices(slug,category,title,organization,summary,status,important_dates,application_fees,eligibility,age_limit,notification_url,official_url,is_published,display_order,created_by,vacancy_breakdown,useful_links)
  values(final_slug,p_category,p_title,coalesce(p_organization,''),coalesce(p_summary,''),coalesce(p_status,''),coalesce(p_important_dates,'{}'),coalesce(p_application_fees,'{}'),coalesce(p_eligibility,'{}'),coalesce(p_age_limit,'{}'),nullif(trim(coalesce(p_notification_url,'')),''),nullif(trim(coalesce(p_official_url,'')),''),coalesce(p_is_published,true),coalesce(p_display_order,0),auth.uid(),coalesce(p_vacancy_breakdown,'[]'::jsonb),coalesce(p_useful_links,'[]'::jsonb))
  returning * into row;
  return row;
end;
$$;

revoke all on function public.admin_save_vacancy_notice(uuid,text,text,text,text,text,text[],text[],text[],text[],text,text,boolean,integer,text,jsonb,jsonb) from public,anon;
grant execute on function public.admin_save_vacancy_notice(uuid,text,text,text,text,text,text[],text[],text[],text[],text,text,boolean,integer,text,jsonb,jsonb) to authenticated;

-- Admin-manageable homepage content: course packages, vacancy notices (jobs/admit-cards/results),
-- and moderated student feedback. All access goes through SECURITY DEFINER functions; the
-- underlying tables have RLS enabled with no direct policies.

create table if not exists public.course_packages(
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Samradhi Complete Course',
  duration_label text not null,
  price_label text not null,
  original_price_label text,
  features text[] not null default '{}',
  coupon_code text,
  coupon_description text,
  is_popular boolean not null default false,
  is_published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.course_packages enable row level security;

create table if not exists public.vacancy_notices(
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null check (category in ('jobs','admit-cards','results')),
  title text not null,
  organization text not null default '',
  summary text not null default '',
  status text not null default '',
  important_dates text[] not null default '{}',
  application_fees text[] not null default '{}',
  eligibility text[] not null default '{}',
  age_limit text[] not null default '{}',
  notification_url text,
  official_url text,
  is_published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.vacancy_notices enable row level security;
create index if not exists vacancy_notices_public_listing on public.vacancy_notices(category,is_published,display_order,created_at desc);

create table if not exists public.student_feedback(
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  rating integer check (rating between 1 and 5),
  message text not null,
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  moderated_by uuid references auth.users(id),
  moderated_at timestamptz
);
alter table public.student_feedback enable row level security;
create index if not exists student_feedback_public_listing on public.student_feedback(is_approved,created_at desc);

create or replace function public.slugify_homepage_text(p_value text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_value,'')),'[^a-z0-9]+','-','g'))
$$;

-- Public reads --------------------------------------------------------------

create or replace function public.list_published_course_packages()
returns setof public.course_packages
language sql stable security definer set search_path=public as $$
  select * from public.course_packages where is_published order by display_order,created_at;
$$;

create or replace function public.list_published_vacancy_notices(p_category text default null,p_limit integer default null)
returns setof public.vacancy_notices
language sql stable security definer set search_path=public as $$
  select * from public.vacancy_notices
  where is_published and (p_category is null or category=p_category)
  order by display_order,created_at desc
  limit coalesce(p_limit,2147483647);
$$;

create or replace function public.get_published_vacancy_notice(p_slug text)
returns public.vacancy_notices
language sql stable security definer set search_path=public as $$
  select * from public.vacancy_notices where slug=p_slug and is_published;
$$;

create or replace function public.list_approved_feedback(p_limit integer default 20)
returns setof public.student_feedback
language sql stable security definer set search_path=public as $$
  select * from public.student_feedback where is_approved order by created_at desc limit greatest(1,least(coalesce(p_limit,20),100));
$$;

-- Student write (their own feedback only) ------------------------------------

create or replace function public.submit_student_feedback(p_message text,p_rating integer default null)
returns public.student_feedback
language plpgsql security definer set search_path=public as $$
declare
  clean_message text:=trim(coalesce(p_message,''));
  name text;
  row public.student_feedback;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  if length(clean_message)<10 or length(clean_message)>1000 then raise exception 'Feedback must be between 10 and 1000 characters.'; end if;
  if p_rating is not null and (p_rating<1 or p_rating>5) then raise exception 'Rating must be between 1 and 5.'; end if;
  select coalesce(full_name,email,'Samradhi student') into name from public.profiles where id=auth.uid();
  insert into public.student_feedback(student_id,display_name,rating,message,is_approved)
  values(auth.uid(),coalesce(name,'Samradhi student'),p_rating,clean_message,false)
  returning * into row;
  return row;
end;
$$;
revoke all on function public.submit_student_feedback(text,integer) from public,anon;
grant execute on function public.submit_student_feedback(text,integer) to authenticated;

-- Admin: course packages -----------------------------------------------------

create or replace function public.admin_list_course_packages()
returns setof public.course_packages
language sql stable security definer set search_path=public as $$
  select * from public.course_packages order by display_order,created_at;
$$;

create or replace function public.admin_save_course_package(
  p_id uuid,p_title text,p_duration_label text,p_price_label text,p_original_price_label text,
  p_features text[],p_coupon_code text,p_coupon_description text,p_is_popular boolean,
  p_is_published boolean,p_display_order integer
) returns public.course_packages
language plpgsql security definer set search_path=public as $$
declare row public.course_packages;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if trim(coalesce(p_duration_label,''))='' then raise exception 'Duration is required.'; end if;
  if trim(coalesce(p_price_label,''))='' then raise exception 'Price is required.'; end if;
  if p_id is null then
    insert into public.course_packages(title,duration_label,price_label,original_price_label,features,coupon_code,coupon_description,is_popular,is_published,display_order,created_by)
    values(coalesce(nullif(trim(p_title),''),'Samradhi Complete Course'),p_duration_label,p_price_label,nullif(trim(coalesce(p_original_price_label,'')),''),coalesce(p_features,'{}'),nullif(trim(coalesce(p_coupon_code,'')),''),nullif(trim(coalesce(p_coupon_description,'')),''),coalesce(p_is_popular,false),coalesce(p_is_published,true),coalesce(p_display_order,0),auth.uid())
    returning * into row;
  else
    update public.course_packages set
      title=coalesce(nullif(trim(p_title),''),'Samradhi Complete Course'),
      duration_label=p_duration_label,price_label=p_price_label,
      original_price_label=nullif(trim(coalesce(p_original_price_label,'')),''),
      features=coalesce(p_features,'{}'),
      coupon_code=nullif(trim(coalesce(p_coupon_code,'')),''),
      coupon_description=nullif(trim(coalesce(p_coupon_description,'')),''),
      is_popular=coalesce(p_is_popular,false),is_published=coalesce(p_is_published,true),
      display_order=coalesce(p_display_order,0),updated_at=now()
    where id=p_id returning * into row;
    if row.id is null then raise exception 'Course package not found.'; end if;
  end if;
  return row;
end;
$$;

create or replace function public.admin_delete_course_package(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  delete from public.course_packages where id=p_id;
end;
$$;

revoke all on function public.admin_list_course_packages(),public.admin_save_course_package(uuid,text,text,text,text,text[],text,text,boolean,boolean,integer),public.admin_delete_course_package(uuid) from public,anon;
grant execute on function public.admin_list_course_packages(),public.admin_save_course_package(uuid,text,text,text,text,text[],text,text,boolean,boolean,integer),public.admin_delete_course_package(uuid) to authenticated;

-- Admin: vacancy notices ------------------------------------------------------

create or replace function public.admin_list_vacancy_notices()
returns setof public.vacancy_notices
language sql stable security definer set search_path=public as $$
  select * from public.vacancy_notices order by category,display_order,created_at desc;
$$;

create or replace function public.admin_save_vacancy_notice(
  p_id uuid,p_category text,p_title text,p_organization text,p_summary text,p_status text,
  p_important_dates text[],p_application_fees text[],p_eligibility text[],p_age_limit text[],
  p_notification_url text,p_official_url text,p_is_published boolean,p_display_order integer,p_slug text default null
) returns public.vacancy_notices
language plpgsql security definer set search_path=public as $$
declare row public.vacancy_notices; base_slug text; final_slug text; suffix integer:=0;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_category not in ('jobs','admit-cards','results') then raise exception 'Invalid category.'; end if;
  if trim(coalesce(p_title,''))='' then raise exception 'Title is required.'; end if;
  if p_notification_url is not null and p_notification_url!='' and p_notification_url !~ '^https?://' then raise exception 'Notification link must start with http:// or https://.'; end if;
  if p_official_url is not null and p_official_url!='' and p_official_url !~ '^https?://' then raise exception 'Official link must start with http:// or https://.'; end if;
  if p_id is not null then
    update public.vacancy_notices set
      category=p_category,title=p_title,organization=coalesce(p_organization,''),summary=coalesce(p_summary,''),status=coalesce(p_status,''),
      important_dates=coalesce(p_important_dates,'{}'),application_fees=coalesce(p_application_fees,'{}'),
      eligibility=coalesce(p_eligibility,'{}'),age_limit=coalesce(p_age_limit,'{}'),
      notification_url=nullif(trim(coalesce(p_notification_url,'')),''),official_url=nullif(trim(coalesce(p_official_url,'')),''),
      is_published=coalesce(p_is_published,true),display_order=coalesce(p_display_order,0),updated_at=now()
    where id=p_id returning * into row;
    if row.id is null then raise exception 'Vacancy notice not found.'; end if;
    return row;
  end if;
  base_slug:=coalesce(nullif(public.slugify_homepage_text(p_slug),''),nullif(public.slugify_homepage_text(p_title),''),'vacancy');
  final_slug:=base_slug;
  while exists(select 1 from public.vacancy_notices where slug=final_slug) loop
    suffix:=suffix+1; final_slug:=base_slug||'-'||suffix;
  end loop;
  insert into public.vacancy_notices(slug,category,title,organization,summary,status,important_dates,application_fees,eligibility,age_limit,notification_url,official_url,is_published,display_order,created_by)
  values(final_slug,p_category,p_title,coalesce(p_organization,''),coalesce(p_summary,''),coalesce(p_status,''),coalesce(p_important_dates,'{}'),coalesce(p_application_fees,'{}'),coalesce(p_eligibility,'{}'),coalesce(p_age_limit,'{}'),nullif(trim(coalesce(p_notification_url,'')),''),nullif(trim(coalesce(p_official_url,'')),''),coalesce(p_is_published,true),coalesce(p_display_order,0),auth.uid())
  returning * into row;
  return row;
end;
$$;

create or replace function public.admin_delete_vacancy_notice(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  delete from public.vacancy_notices where id=p_id;
end;
$$;

revoke all on function public.admin_list_vacancy_notices(),public.admin_save_vacancy_notice(uuid,text,text,text,text,text,text[],text[],text[],text[],text,text,boolean,integer,text),public.admin_delete_vacancy_notice(uuid) from public,anon;
grant execute on function public.admin_list_vacancy_notices(),public.admin_save_vacancy_notice(uuid,text,text,text,text,text,text[],text[],text[],text[],text,text,boolean,integer,text),public.admin_delete_vacancy_notice(uuid) to authenticated;

-- Admin: feedback moderation --------------------------------------------------

create or replace function public.admin_list_feedback()
returns setof public.student_feedback
language sql stable security definer set search_path=public as $$
  select * from public.student_feedback order by created_at desc;
$$;

create or replace function public.admin_set_feedback_approved(p_id uuid,p_approved boolean) returns public.student_feedback
language plpgsql security definer set search_path=public as $$
declare row public.student_feedback;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  update public.student_feedback set is_approved=coalesce(p_approved,false),moderated_by=auth.uid(),moderated_at=now() where id=p_id returning * into row;
  if row.id is null then raise exception 'Feedback not found.'; end if;
  return row;
end;
$$;

create or replace function public.admin_delete_feedback(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  delete from public.student_feedback where id=p_id;
end;
$$;

revoke all on function public.admin_list_feedback(),public.admin_set_feedback_approved(uuid,boolean),public.admin_delete_feedback(uuid) from public,anon;
grant execute on function public.admin_list_feedback(),public.admin_set_feedback_approved(uuid,boolean),public.admin_delete_feedback(uuid) to authenticated;

grant execute on function public.list_published_course_packages(),public.list_published_vacancy_notices(text,integer),public.get_published_vacancy_notice(text),public.list_approved_feedback(integer) to anon,authenticated;

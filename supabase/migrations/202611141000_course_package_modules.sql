begin;

-- Real requested follow-up to the per-module student access control: course
-- packages on the homepage are pure marketing text with no link to what a
-- purchase actually unlocks. This tags each package with which of the three
-- real modules (Typing / Stenography / Efficiency -- the exact set
-- profiles.can_access_typing/stenography/efficiency gate) it grants, purely
-- so the admin knows which checkboxes to flip on a student's access after
-- processing a WhatsApp-confirmed purchase, and so a prospective student can
-- see what's actually included before buying. Not itself an access-control
-- mechanism -- there's still no payment gateway, so nothing here
-- automatically changes a student's access.
alter table public.course_packages add column if not exists modules text[] not null default '{}';
alter table public.course_packages add constraint course_packages_modules_known_values check (modules <@ array['typing','stenography','efficiency']::text[]);

-- Full redefinition: admin_save_course_package's parameter list grows (a new
-- p_modules argument), so the old signature is dropped first -- `create or
-- replace` alone would leave both overloads active (same precedent as
-- 202608270037's own drop for this exact function, one migration earlier).
drop function if exists public.admin_save_course_package(uuid,text,text,text,text,text,text[],text,text,boolean,boolean,integer);

create or replace function public.admin_save_course_package(
  p_id uuid,p_title text,p_category text,p_duration_label text,p_price_label text,p_original_price_label text,
  p_features text[],p_coupon_code text,p_coupon_description text,p_is_popular boolean,
  p_is_published boolean,p_display_order integer,p_modules text[]
) returns public.course_packages
language plpgsql security definer set search_path=public as $$
declare row public.course_packages; clean_category text:=coalesce(nullif(btrim(p_category),''),'Typing'); clean_modules text[];
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if char_length(clean_category)<2 or char_length(clean_category)>40 then raise exception 'Category must be between 2 and 40 characters.'; end if;
  if trim(coalesce(p_duration_label,''))='' then raise exception 'Duration is required.'; end if;
  if trim(coalesce(p_price_label,''))='' then raise exception 'Price is required.'; end if;
  select coalesce(array_agg(distinct m),'{}') into clean_modules from unnest(coalesce(p_modules,'{}')) as m where m = any(array['typing','stenography','efficiency']);
  if p_id is null then
    insert into public.course_packages(title,category,duration_label,price_label,original_price_label,features,coupon_code,coupon_description,is_popular,is_published,display_order,modules,created_by)
    values(coalesce(nullif(trim(p_title),''),'Samradhi Complete Course'),clean_category,p_duration_label,p_price_label,nullif(trim(coalesce(p_original_price_label,'')),''),coalesce(p_features,'{}'),nullif(trim(coalesce(p_coupon_code,'')),''),nullif(trim(coalesce(p_coupon_description,'')),''),coalesce(p_is_popular,false),coalesce(p_is_published,true),coalesce(p_display_order,0),clean_modules,auth.uid())
    returning * into row;
  else
    update public.course_packages set
      title=coalesce(nullif(trim(p_title),''),'Samradhi Complete Course'),
      category=clean_category,
      duration_label=p_duration_label,price_label=p_price_label,
      original_price_label=nullif(trim(coalesce(p_original_price_label,'')),''),
      features=coalesce(p_features,'{}'),
      coupon_code=nullif(trim(coalesce(p_coupon_code,'')),''),
      coupon_description=nullif(trim(coalesce(p_coupon_description,'')),''),
      is_popular=coalesce(p_is_popular,false),is_published=coalesce(p_is_published,true),
      display_order=coalesce(p_display_order,0),modules=clean_modules,updated_at=now()
    where id=p_id returning * into row;
    if row.id is null then raise exception 'Course package not found.'; end if;
  end if;
  return row;
end;
$$;

revoke all on function public.admin_save_course_package(uuid,text,text,text,text,text,text[],text,text,boolean,boolean,integer,text[]) from public,anon;
grant execute on function public.admin_save_course_package(uuid,text,text,text,text,text,text[],text,text,boolean,boolean,integer,text[]) to authenticated;

commit;

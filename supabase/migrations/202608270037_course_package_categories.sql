begin;

-- Course packages gain a category (Typing / Efficiency / Stenography / etc.)
-- so the homepage "Buy Now" button can group pricing plans by subject
-- instead of showing one flat list. Free text rather than an enum: the
-- admin is expected to add more categories over time as more course types
-- are offered, without needing a migration each time.

alter table public.course_packages add column if not exists category text not null default 'Typing';
alter table public.course_packages add constraint course_packages_category_length check (char_length(btrim(category)) between 2 and 40);

-- Full redefinition: admin_save_course_package's parameter list changes
-- (a new p_category argument), so the old signature is dropped first --
-- `create or replace` alone would leave both overloads active.
drop function if exists public.admin_save_course_package(uuid,text,text,text,text,text[],text,text,boolean,boolean,integer);

create or replace function public.admin_save_course_package(
  p_id uuid,p_title text,p_category text,p_duration_label text,p_price_label text,p_original_price_label text,
  p_features text[],p_coupon_code text,p_coupon_description text,p_is_popular boolean,
  p_is_published boolean,p_display_order integer
) returns public.course_packages
language plpgsql security definer set search_path=public as $$
declare row public.course_packages; clean_category text:=coalesce(nullif(btrim(p_category),''),'Typing');
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if char_length(clean_category)<2 or char_length(clean_category)>40 then raise exception 'Category must be between 2 and 40 characters.'; end if;
  if trim(coalesce(p_duration_label,''))='' then raise exception 'Duration is required.'; end if;
  if trim(coalesce(p_price_label,''))='' then raise exception 'Price is required.'; end if;
  if p_id is null then
    insert into public.course_packages(title,category,duration_label,price_label,original_price_label,features,coupon_code,coupon_description,is_popular,is_published,display_order,created_by)
    values(coalesce(nullif(trim(p_title),''),'Samradhi Complete Course'),clean_category,p_duration_label,p_price_label,nullif(trim(coalesce(p_original_price_label,'')),''),coalesce(p_features,'{}'),nullif(trim(coalesce(p_coupon_code,'')),''),nullif(trim(coalesce(p_coupon_description,'')),''),coalesce(p_is_popular,false),coalesce(p_is_published,true),coalesce(p_display_order,0),auth.uid())
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
      display_order=coalesce(p_display_order,0),updated_at=now()
    where id=p_id returning * into row;
    if row.id is null then raise exception 'Course package not found.'; end if;
  end if;
  return row;
end;
$$;

revoke all on function public.admin_save_course_package(uuid,text,text,text,text,text,text[],text,text,boolean,boolean,integer) from public,anon;
grant execute on function public.admin_save_course_package(uuid,text,text,text,text,text,text[],text,text,boolean,boolean,integer) to authenticated;

commit;

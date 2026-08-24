begin;

create or replace function public.save_section_managed_test(
  p_test_id uuid,
  p_payload jsonb,
  p_publish boolean,
  p_mode public.test_mode
)
returns uuid language plpgsql security definer set search_path = public as $$
declare existing_mode public.test_mode;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_payload->>'mode' is distinct from p_mode::text then
    raise exception 'section mode mismatch: expected %', p_mode;
  end if;
  if coalesce((p_payload->>'is_live')::boolean, false) then
    raise exception 'section tests cannot be configured as live tests';
  end if;
  if p_mode = 'learn' and (p_payload->>'visibility' is distinct from 'public' or not p_publish) then
    raise exception 'learning tests must be public and published';
  end if;
  if p_test_id is not null then
    select mode into existing_mode from public.tests where id = p_test_id;
    if not found then raise exception 'test unavailable'; end if;
    if existing_mode is distinct from p_mode then
      raise exception 'test belongs to % and cannot be edited from the % section', existing_mode, p_mode;
    end if;
  end if;
  return public.save_managed_test(p_test_id, p_payload, p_publish);
end; $$;

revoke all on function public.save_section_managed_test(uuid,jsonb,boolean,public.test_mode) from public, anon;
grant execute on function public.save_section_managed_test(uuid,jsonb,boolean,public.test_mode) to authenticated;

do $$
declare target public.tests%rowtype; candidate_count integer; attempt_count integer;
begin
  select count(*) into candidate_count from public.tests where title = 'TEST 1';
  if candidate_count <> 1 then
    raise exception 'Guarded TEST 1 deletion expected exactly one exact-title record, found %', candidate_count;
  end if;
  select * into strict target from public.tests where title = 'TEST 1';
  if target.current_version_id is null then raise exception 'TEST 1 is not a managed test'; end if;
  select count(*) into attempt_count from public.test_attempts where test_id = target.id;
  raise notice 'Verified TEST 1: id=%, slug=%, mode=%, status=%, attempts=%', target.id, target.slug, target.mode, target.status, attempt_count;
  if attempt_count <> 0 then raise exception 'TEST 1 has % attempts and was not deleted', attempt_count; end if;
  insert into public.admin_test_audit_log(actor_user_id,test_id,action,metadata)
    values(target.created_by,target.id,'test_deleted',jsonb_build_object('reason','exact TEST 1 removal','verified_attempts',attempt_count));
  update public.tests set current_version_id = null where id = target.id;
  delete from public.test_versions where test_id = target.id;
  delete from public.tests where id = target.id and title = 'TEST 1';
  if not found then raise exception 'Guarded TEST 1 deletion did not delete its verified record'; end if;
end $$;

commit;

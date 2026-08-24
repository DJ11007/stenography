-- Preserve the historical version and publish a new immutable version whose
-- configuration explicitly records the already-correct legacy encoding.
do $$
declare
  target_test constant uuid := '5e1404d3-8bad-4de6-a4ba-73562ba0fc6e';
  expected_version constant uuid := '312d84cd-b8c6-4c33-894d-7575ec105152';
  source_version public.test_versions%rowtype;
  next_version integer;
  replacement_id uuid;
begin
  select version.* into source_version
  from public.test_versions as version
  join public.tests as test on test.current_version_id = version.id
  where test.id = target_test and version.id = expected_version
  for update of version;

  if not found then
    raise exception 'Kruti Dev repair preflight failed: expected current version is unavailable';
  end if;
  if source_version.input_system_id <> 'hindi-krutidev-010'
     or source_version.passage not like '%Òkjr bl o"kZ fCjDl v/;{krk fuÒk jgk gSA%' then
    raise exception 'Kruti Dev repair preflight failed: encoding or passage does not match';
  end if;

  select coalesce(max(version_number),0)+1 into next_version
  from public.test_versions where test_id = target_test;

  insert into public.test_versions(
    test_id,version_number,title,description,language,mode,input_system_id,
    duration_seconds,passage,required_wpm,required_accuracy,backspace_mode,
    word_method,highlight_mode,visibility,passage_characters,passage_words,
    configuration,created_by
  ) values (
    source_version.test_id,next_version,source_version.title,source_version.description,
    source_version.language,source_version.mode,source_version.input_system_id,
    source_version.duration_seconds,source_version.passage,source_version.required_wpm,
    source_version.required_accuracy,source_version.backspace_mode,source_version.word_method,
    source_version.highlight_mode,source_version.visibility,source_version.passage_characters,
    source_version.passage_words,source_version.configuration || jsonb_build_object(
      'passage_encoding','krutidev-legacy',
      'font_asset','/fonts/KrutiDev010.ttf',
      'repair_reason','explicit encoding marker; historical passage bytes preserved'
    ),source_version.created_by
  ) returning id into replacement_id;

  update public.tests
  set current_version_id=replacement_id,current_version_number=next_version,
      input_system_id='hindi-krutidev-010',
      settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object('passage_encoding','krutidev-legacy'),
      updated_at=now()
  where id=target_test and current_version_id=expected_version;

  if not found then raise exception 'Kruti Dev repair failed to advance current version'; end if;

  if source_version.created_by is not null then
    insert into public.admin_test_audit_log(actor_user_id,test_id,test_version_id,action,metadata)
    values(source_version.created_by,target_test,replacement_id,'test_version_created',
      jsonb_build_object('version',next_version,'passage_encoding','krutidev-legacy','historical_version_preserved',true));
  end if;
end $$;

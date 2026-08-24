-- Preserve the corrected long Kruti Dev passage in a new immutable version.
-- Application regression tests prove that decoding with token isolation and
-- re-encoding produces these exact 5,408 legacy characters.
do $$
declare
  target_test constant uuid := '5e1404d3-8bad-4de6-a4ba-73562ba0fc6e';
  expected_version constant uuid := '506fdfc0-60dc-4263-93b5-03bf2ef1bfc5';
  source_version public.test_versions%rowtype;
  next_version integer;
  replacement_id uuid;
begin
  select version.* into source_version
  from public.test_versions as version
  join public.tests as test on test.current_version_id=version.id
  where test.id=target_test and version.id=expected_version
  for update of version;

  if not found then raise exception 'Long Kruti Dev reconversion preflight failed'; end if;
  if source_version.input_system_id<>'hindi-krutidev-010'
     or char_length(source_version.passage)<>2916
     or position('—f=e' in source_version.passage)=0 then
    raise exception 'Affected Kruti Dev test no longer matches its reviewed source';
  end if;

  select coalesce(max(version_number),0)+1 into next_version
  from public.test_versions where test_id=target_test;

  insert into public.test_versions(
    test_id,version_number,title,description,language,mode,input_system_id,duration_seconds,
    passage,required_wpm,required_accuracy,backspace_mode,word_method,highlight_mode,
    visibility,passage_characters,passage_words,configuration,created_by
  ) values (
    source_version.test_id,next_version,source_version.title,source_version.description,
    source_version.language,source_version.mode,source_version.input_system_id,
    source_version.duration_seconds,source_version.passage,source_version.required_wpm,
    source_version.required_accuracy,source_version.backspace_mode,source_version.word_method,
    source_version.highlight_mode,source_version.visibility,source_version.passage_characters,
    source_version.passage_words,source_version.configuration||jsonb_build_object(
      'passage_encoding','krutidev-legacy',
      'converter_version','token-isolated-v2',
      'repair_reason','long-passage matra and reph operations isolated per token'
    ),source_version.created_by
  ) returning id into replacement_id;

  update public.tests set current_version_id=replacement_id,current_version_number=next_version,updated_at=now()
  where id=target_test and current_version_id=expected_version;
  if not found then raise exception 'Long Kruti Dev repair failed to advance version'; end if;

  if source_version.created_by is not null then
    insert into public.admin_test_audit_log(actor_user_id,test_id,test_version_id,action,metadata)
    values(source_version.created_by,target_test,replacement_id,'test_version_created',
      jsonb_build_object('version',next_version,'converter_version','token-isolated-v2','historical_version_preserved',true));
  end if;
end $$;

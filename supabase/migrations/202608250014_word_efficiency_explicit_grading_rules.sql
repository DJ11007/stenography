begin;

create table public.word_efficiency_grading_rules(
 id uuid primary key default gen_random_uuid(),
 version_id uuid not null references public.word_efficiency_versions(id) on delete cascade,
 question_id uuid not null references public.word_efficiency_questions(id) on delete cascade,
 exact_target text not null check(char_length(btrim(exact_target))between 1 and 300),
 expected_operation text not null check(char_length(btrim(expected_operation))between 1 and 100),
 expected_value jsonb not null,
 allocated_marks numeric(10,2)not null check(allocated_marks>0),
 partial_marks numeric(10,2)check(partial_marks is null or partial_marks between 0 and allocated_marks),
 created_at timestamptz not null default now(),
 unique(version_id,question_id),
 unique(id,version_id)
);

alter table public.word_efficiency_grading_rules enable row level security;
revoke all on table public.word_efficiency_grading_rules from public;

create or replace function public.save_word_efficiency_grading_rules(p_version_id uuid,p_rules jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare item jsonb;question_record public.word_efficiency_questions%rowtype;expected jsonb;
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 if jsonb_typeof(p_rules)<>'array'or jsonb_array_length(p_rules)>500 then raise exception'invalid grading rules';end if;
 if exists(select 1 from public.word_efficiency_attempts where version_id=p_version_id)then raise exception'grading rules are immutable after an attempt is prepared';end if;
 delete from public.word_efficiency_grading_rules where version_id=p_version_id;
 for item in select value from jsonb_array_elements(p_rules)loop
  if jsonb_typeof(item)<>'object'or not(item?&array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks'])or exists(select 1 from jsonb_object_keys(item)k where k<>all(array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks']))then raise exception'invalid grading rule';end if;
  select*into question_record from public.word_efficiency_questions where version_id=p_version_id and question_number=(item->>'questionNumber')::integer;
  if not found then raise exception'grading rule question does not belong to version';end if;
  begin expected:=(item->>'expectedValue')::jsonb;exception when others then expected:=to_jsonb(item->>'expectedValue');end;
  if(item->>'allocatedMarks')::numeric>question_record.marks then raise exception'grading rule marks exceed question marks';end if;
  insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks)values(p_version_id,question_record.id,btrim(item->>'exactTarget'),btrim(item->>'expectedOperation'),expected,(item->>'allocatedMarks')::numeric,case when jsonb_typeof(item->'partialMarks')='null'then null else(item->>'partialMarks')::numeric end);
 end loop;
end$$;

revoke all on function public.save_word_efficiency_grading_rules(uuid,jsonb)from public;
do $$begin if exists(select 1 from pg_catalog.pg_roles where rolname='authenticated')then execute'revoke all on function public.save_word_efficiency_grading_rules(uuid,jsonb) from authenticated';execute'grant execute on function public.save_word_efficiency_grading_rules(uuid,jsonb) to authenticated';end if;end$$;

commit;

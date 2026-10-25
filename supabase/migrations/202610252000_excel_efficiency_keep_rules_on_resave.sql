-- Saving an Excel Efficiency test in admin makes a new version. The admin form carries one simple rule per
-- question, so the marking written for a paper (several parts, rule criteria) was lost on every save, e.g.
-- when the question paper PDF was uploaded afterwards. Questions whose wording and marks are unchanged now
-- keep the previous version's rules exactly.
begin;

create or replace function public.copy_excel_efficiency_grading_rules(p_from_version uuid, p_to_version uuid)
returns integer language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare copied integer;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if p_from_version is null or p_to_version is null or p_from_version = p_to_version then return 0; end if;
 if (select test_id from public.excel_efficiency_versions where id = p_from_version) is distinct from (select test_id from public.excel_efficiency_versions where id = p_to_version) then
  raise exception 'versions belong to different tests';
 end if;
 if exists (select 1 from public.excel_efficiency_attempts where version_id = p_to_version) then raise exception 'grading rules are immutable after an attempt is prepared'; end if;

 create temporary table if not exists pg_temp.excel_rule_question_map (old_id uuid, new_id uuid) on commit drop;
 delete from pg_temp.excel_rule_question_map;
 insert into pg_temp.excel_rule_question_map
 select o.id, n.id from public.excel_efficiency_questions o
 join public.excel_efficiency_questions n on n.version_id = p_to_version and n.question_number = o.question_number
  and btrim(n.instruction) = btrim(o.instruction) and n.marks = o.marks
 where o.version_id = p_from_version and exists (select 1 from public.excel_efficiency_grading_rules r where r.question_id = o.id);

 delete from public.excel_efficiency_grading_rules r using pg_temp.excel_rule_question_map m where r.version_id = p_to_version and r.question_id = m.new_id;
 insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
 select p_to_version, m.new_id, r.exact_target, r.expected_operation, r.expected_value, r.allocated_marks, r.partial_marks, r.additional_criteria, r.part_label
 from public.excel_efficiency_grading_rules r join pg_temp.excel_rule_question_map m on m.old_id = r.question_id
 where r.version_id = p_from_version;
 get diagnostics copied = row_count;
 return copied;
end $function$;

revoke all on function public.copy_excel_efficiency_grading_rules(uuid, uuid) from public, anon;
grant execute on function public.copy_excel_efficiency_grading_rules(uuid, uuid) to authenticated;

commit;

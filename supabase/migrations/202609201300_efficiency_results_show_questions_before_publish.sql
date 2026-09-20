begin;

-- Real requested change: a student who just submitted saw a bare "Submitted
-- -- evaluation pending" card with no question list at all -- the admin
-- wanted every student to see the full Result Summary + Detailed Result
-- table immediately (matching a reference product's layout), with each
-- question's own row present and "Not graded" in its marks column until
-- the teacher actually publishes grading, rather than the whole table
-- being withheld until then. get_word/excel_efficiency_attempt_result
-- previously returned questions:'[]' entirely when not yet published --
-- now the question list (instruction/section/maximumMarks) is always
-- returned; only the awarded marks/feedback/grading status stay gated
-- behind is_published, exactly as the overall marksObtained/percentage/
-- passed fields already were.
create or replace function public.get_word_efficiency_attempt_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;version_record public.word_efficiency_versions%rowtype;test_record public.word_efficiency_tests%rowtype;result_rows jsonb;is_published boolean;
begin
 if not public.is_active_word_efficiency_student()then raise exception'active student account required';end if;
 select attempt_rows.* into attempt_record from public.word_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid();if not found or attempt_record.status not in('submitted','completed')then raise exception'attempt result unavailable';end if;
 select version_rows.* into version_record from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;if not found then raise exception'test version unavailable';end if;
 select test_rows.* into test_record from public.word_efficiency_tests as test_rows where test_rows.id=attempt_record.test_id;
 is_published:=attempt_record.result is not null and(attempt_record.evaluation_status='published'or attempt_record.status='completed')and(not attempt_record.is_live_attempt or test_record.results_publish_at is null or now()>=test_record.results_publish_at);
 select coalesce(jsonb_agg(jsonb_build_object('number',score_rows.question_number,'instruction',question_rows.instruction,'section',question_rows.section,'maximumMarks',score_rows.maximum_marks,'awardedMarks',case when is_published then score_rows.awarded_marks else null end,'feedback',case when is_published then score_rows.teacher_comment else null end,'gradingStatus',case when not is_published or score_rows.awarded_marks is null then'not_graded'else'graded'end)order by question_rows.display_order),'[]'::jsonb)into result_rows from public.word_efficiency_question_scores as score_rows join public.word_efficiency_questions as question_rows on question_rows.id=score_rows.question_id where score_rows.attempt_id=p_attempt_id;
 return jsonb_build_object('title',attempt_record.snapshot->>'title','language',attempt_record.snapshot->>'language','status',case when is_published then'published'else'pending'end,'submittedAt',attempt_record.submitted_at,'evaluatedAt',case when is_published then attempt_record.result_published_at end,'maximumMarks',version_record.maximum_marks,'marksObtained',case when is_published then attempt_record.result->'marks'else null end,'percentage',case when is_published then attempt_record.result->'percentage'else null end,'passingMarks',case when is_published then to_jsonb(version_record.passing_marks)else null end,'passed',case when is_published then attempt_record.result->'passed'else null end,'overallFeedback',case when is_published then attempt_record.overall_teacher_feedback end,'questions',result_rows);
end $$;

create or replace function public.get_excel_efficiency_attempt_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public as $$
declare attempt_record public.excel_efficiency_attempts%rowtype;version_record public.excel_efficiency_versions%rowtype;test_record public.excel_efficiency_tests%rowtype;result_rows jsonb;is_published boolean;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 select attempt_rows.* into attempt_record from public.excel_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid(); if not found or attempt_record.status not in('submitted','completed') then raise exception 'attempt result unavailable'; end if;
 select version_rows.* into version_record from public.excel_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id; if not found then raise exception 'test version unavailable'; end if;
 select test_rows.* into test_record from public.excel_efficiency_tests as test_rows where test_rows.id=attempt_record.test_id;
 is_published:=attempt_record.result is not null and(attempt_record.evaluation_status='published' or attempt_record.status='completed')and(not attempt_record.is_live_attempt or test_record.results_publish_at is null or now()>=test_record.results_publish_at);
 select coalesce(jsonb_agg(jsonb_build_object('number',score_rows.question_number,'instruction',question_rows.instruction,'section',question_rows.section,'maximumMarks',score_rows.maximum_marks,'awardedMarks',case when is_published then score_rows.awarded_marks else null end,'feedback',case when is_published then score_rows.teacher_comment else null end,'gradingStatus',case when not is_published or score_rows.awarded_marks is null then'not_graded' else'graded' end) order by question_rows.display_order),'[]'::jsonb) into result_rows from public.excel_efficiency_question_scores as score_rows join public.excel_efficiency_questions as question_rows on question_rows.id=score_rows.question_id where score_rows.attempt_id=p_attempt_id;
 return jsonb_build_object('title',attempt_record.snapshot->>'title','language',attempt_record.snapshot->>'language','status',case when is_published then'published' else'pending' end,'submittedAt',attempt_record.submitted_at,'evaluatedAt',case when is_published then attempt_record.result_published_at end,'maximumMarks',version_record.maximum_marks,'marksObtained',case when is_published then attempt_record.result->'marks' else null end,'percentage',case when is_published then attempt_record.result->'percentage' else null end,'passingMarks',case when is_published then to_jsonb(version_record.passing_marks) else null end,'passed',case when is_published then attempt_record.result->'passed' else null end,'overallFeedback',case when is_published then attempt_record.overall_teacher_feedback end,'questions',result_rows);
end $$;

commit;

-- Every Word and Excel efficiency test offers 10, 15, 20, 25 and 30 minutes (student's choice on the
-- instructions page). 10 minutes stays first: live tests run for the first option, so their length is unchanged.
-- (Applied to production as migration "efficiency_duration_slots_10_to_30".)
update public.word_efficiency_versions set duration_options = array[600,900,1200,1500,1800] where duration_options is distinct from array[600,900,1200,1500,1800];
update public.excel_efficiency_versions set duration_options = array[600,900,1200,1500,1800] where duration_options is distinct from array[600,900,1200,1500,1800];

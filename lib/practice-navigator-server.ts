import { createClient } from "./supabase/server";
import { normalizePracticePage, practicePageBounds, PRACTICE_PAGE_SIZE } from "./practice-navigator";
export { normalizePracticePage, practicePageBounds, practicePageCount, PRACTICE_PAGE_SIZE } from "./practice-navigator";

export type PracticeNavigatorFilters={page:number;query?:string;language?:"English"|"Hindi";inputSystemId?:string;duration?:number;source?:"admin"|"preset"};
export type PracticeNavigatorItem={id:string;slug:string;title:string;language:string;inputSystemId:string;durationSeconds:number;source:"admin"|"preset";status:"Not attempted"|"In progress"|"Completed";bestWpm:number|null;accuracy:number|null};

export async function getPracticeSelector(filters:{mode:"practice"|"stenography";language:"English"|"Hindi";inputSystemId?:string;sort?:"newest"|"oldest"}){
 const supabase=await createClient();let query=supabase.from("tests").select("id,slug,title,language,input_system_id,duration_seconds").eq("mode",filters.mode).eq("status","published").eq("visibility","public").eq("is_live",false).eq("language",filters.language);if(filters.inputSystemId)query=query.eq("input_system_id",filters.inputSystemId);
 const oldest=filters.sort==="oldest";
 const{data,error}=await query.order("published_at",{ascending:oldest}).order("id",{ascending:true});if(error){console.error("Practice selector query failed",{code:error.code,message:error.message});throw new Error(`Practice test selector could not be loaded (${error.code||"database error"}).`);}return(data??[]).map((test,index)=>({...test,index:index+1,inputSystemId:test.input_system_id,durationSeconds:test.duration_seconds}));
}

export async function getPracticeNavigator(filters:PracticeNavigatorFilters){
 const supabase=await createClient();let query=supabase.from("tests").select("id,slug,title,language,input_system_id,duration_seconds",{count:"exact"}).eq("mode","practice").eq("status","published").eq("visibility","public").eq("is_live",false);
 if(filters.language)query=query.eq("language",filters.language);if(filters.inputSystemId)query=query.eq("input_system_id",filters.inputSystemId);if(filters.duration)query=query.eq("duration_seconds",filters.duration);if(filters.query)query=query.or(`title.ilike.%${filters.query.replace(/[%_,()]/g,"")}%,slug.ilike.%${filters.query.replace(/[%_,()]/g,"")}%`);
 const requested=normalizePracticePage(filters.page);const from=(requested-1)*PRACTICE_PAGE_SIZE;const{data,error,count}=await query.order("published_at",{ascending:false}).order("id",{ascending:true}).range(from,from+PRACTICE_PAGE_SIZE-1);if(error){console.error("Practice navigator query failed",{code:error.code,message:error.message});throw new Error(`Practice tests could not be loaded (${error.code||"database error"}).`);}const total=count??0;const bounds=practicePageBounds(requested,total);
 const ids=(data??[]).map(test=>test.id);const{data:attempts}=ids.length?await supabase.from("test_attempts").select("test_id,result,started_at,submitted_at").in("test_id",ids):{data:[]};const summaries=new Map<string,{bestWpm:number;accuracy:number}>();for(const attempt of attempts??[]){const wpm=Number(attempt.result?.netWpm??0),accuracy=Number(attempt.result?.accuracy??0),old=summaries.get(attempt.test_id);if(!old||wpm>old.bestWpm)summaries.set(attempt.test_id,{bestWpm:wpm,accuracy});}
 const items:PracticeNavigatorItem[]=(data??[]).map(test=>{const result=summaries.get(test.id);return{id:test.id,slug:test.slug,title:test.title,language:test.language,inputSystemId:test.input_system_id,durationSeconds:test.duration_seconds,source:"admin",status:result?"Completed":"Not attempted",bestWpm:result?.bestWpm??null,accuracy:result?.accuracy??null};});return{items,total,...bounds};
}

import { createClient } from "./supabase/server";
import { normalizeExamCategoryPage, examCategoryPageBounds, EXAM_CATEGORY_PAGE_SIZE } from "./exam-category-navigator";
export { normalizeExamCategoryPage, examCategoryPageBounds, examCategoryPageCount, EXAM_CATEGORY_PAGE_SIZE } from "./exam-category-navigator";

export type ExamCategoryNavigatorItem={id:string;slug:string;title:string;publishedAt:string|null};
export type ExamCategoryNavigatorFilters={categorySlug:string;language:"English"|"Hindi";page:unknown;sort?:"newest"|"oldest"};

// Admin-uploaded exercises tied to one of the 25 hardcoded exam categories
// (lib/exam-categories.ts) via the exam_category key inside tests.settings --
// no dedicated column exists, matching the zero-migration jsonb pattern
// already used for task_category/audio_path/pdf_path/dictation_categories.
// "settings->>exam_category" is a PostgREST jsonb-path filter forwarded
// verbatim by supabase-js's .eq(); confirmed valid syntax, but this is the
// first place in this codebase's JS (not raw SQL) that uses one.
export async function getExamCategoryNavigator(filters:ExamCategoryNavigatorFilters){
 const supabase=await createClient();const oldest=filters.sort==="oldest";
 const query=supabase.from("tests").select("id,slug,title,published_at",{count:"exact"}).eq("mode","exam").eq("status","published").eq("visibility","public").eq("is_live",false).eq("language",filters.language).eq("settings->>exam_category",filters.categorySlug);
 const requested=normalizeExamCategoryPage(filters.page);const from=(requested-1)*EXAM_CATEGORY_PAGE_SIZE;const{data,error,count}=await query.order("published_at",{ascending:oldest}).order("id",{ascending:true}).range(from,from+EXAM_CATEGORY_PAGE_SIZE-1);
 if(error){console.error("Exam category navigator query failed",{code:error.code,message:error.message});throw new Error(`Exam exercises could not be loaded (${error.code||"database error"}).`);}
 const total=count??0;const bounds=examCategoryPageBounds(requested,total);
 const items:ExamCategoryNavigatorItem[]=(data??[]).map(test=>({id:test.id,slug:test.slug,title:test.title,publishedAt:test.published_at}));
 return{items,total,...bounds};
}

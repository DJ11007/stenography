export const EXAM_CATEGORY_PAGE_SIZE=50;
export function normalizeExamCategoryPage(value:unknown){const page=Number(value);return Number.isSafeInteger(page)&&page>0?page:1;}
export function examCategoryPageCount(total:number){return Math.max(1,Math.ceil(Math.max(0,total)/EXAM_CATEGORY_PAGE_SIZE));}
export function examCategoryPageBounds(page:number,total:number){const pages=examCategoryPageCount(total);const safe=Math.min(Math.max(1,page),pages);return{page:safe,from:(safe-1)*EXAM_CATEGORY_PAGE_SIZE,to:Math.min(total,safe*EXAM_CATEGORY_PAGE_SIZE)-1,pages};}

export const PRACTICE_PAGE_SIZE=25;
export function normalizePracticePage(value:unknown){const page=Number(value);return Number.isSafeInteger(page)&&page>0?page:1;}
export function practicePageCount(total:number){return Math.max(1,Math.ceil(Math.max(0,total)/PRACTICE_PAGE_SIZE));}
export function practicePageBounds(page:number,total:number){const pages=practicePageCount(total);const safe=Math.min(Math.max(1,page),pages);return{page:safe,from:(safe-1)*PRACTICE_PAGE_SIZE,to:Math.min(total,safe*PRACTICE_PAGE_SIZE)-1,pages};}
export function resolvePracticeSelection<T extends {slug:string}>(items:T[],requestedSlug?:string){const requestedIndex=items.findIndex((item)=>item.slug===requestedSlug);const selectedIndex=requestedIndex>=0?requestedIndex:0;return{selectedIndex,selected:items[selectedIndex],fellBack:requestedIndex<0};}

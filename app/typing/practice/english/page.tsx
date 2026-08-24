import { practiceMetadata } from "../_components/category-catalogue";
import { PracticeNavigator } from "../_components/practice-navigator";
export const metadata=practiceMetadata("English Typing","Published English practice tests with exact typing targets.");
export default async function EnglishTypingPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){return <PracticeNavigator language="English" params={await searchParams}/>;}

import { HindiCatalogue, practiceMetadata } from "../_components/category-catalogue";
import { PracticeNavigator } from "../_components/practice-navigator";
export const metadata=practiceMetadata("Hindi Typing","Choose a Hindi keyboard and view compatible published practice tests.");
export default async function HindiTypingPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=await searchParams;return params.input?<PracticeNavigator language="Hindi" params={params} requireInput/>:<HindiCatalogue title="Hindi Typing" description="Choose the exact keyboard and font required for your Hindi typing test." mode="practice"/>;}

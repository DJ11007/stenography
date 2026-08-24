import { practiceMetadata } from "../_components/category-catalogue";
import { PracticeNavigator } from "../_components/practice-navigator";
export const metadata=practiceMetadata("English Stenography","Published English stenography tests only.");
export default async function EnglishStenoPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){return <PracticeNavigator mode="stenography" language="English" params={await searchParams}/>;}

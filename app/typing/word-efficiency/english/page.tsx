import type { Metadata } from "next";
import { WordTestCatalogue } from "../_components/word-test-catalogue";
export const metadata:Metadata={title:"English Word Efficiency | Samradhi Classes",description:"English document formatting, editing, shortcut, and productivity exercises."};
export default async function EnglishWordEfficiencyPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=await searchParams;return <WordTestCatalogue language="English" search={params.search??""} page={Math.max(1,Number(params.page)||1)}/>}

import type { Metadata } from "next";
import { ExcelTestCatalogue } from "../_components/excel-test-catalogue";
export const metadata:Metadata={title:"English Excel Efficiency | Samradhi Classes",description:"English spreadsheet data entry, formula, formatting and sorting exercises."};
export default async function EnglishExcelEfficiencyPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=await searchParams;return <ExcelTestCatalogue language="English" search={params.search??""} page={Math.max(1,Number(params.page)||1)}/>}

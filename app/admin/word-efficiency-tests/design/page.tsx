import type { Metadata } from "next";
import { WordEfficiencyTestsPage } from "../tests-page";

export const metadata: Metadata = { title: "Create / Edit Word Efficiency Test | Admin" };

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <WordEfficiencyTestsPage view="design" searchParams={searchParams} />;
}

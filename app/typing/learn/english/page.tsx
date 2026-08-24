import { getPublishedLearningTests } from "@/lib/learning-tests-server";
import { LearningCatalog } from "../learning-catalog";

export default async function EnglishLearningPage() {
  return <LearningCatalog lessons={await getPublishedLearningTests("English")}/>;
}



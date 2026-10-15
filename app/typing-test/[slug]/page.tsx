import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamSeoPage } from "@/app/_components/exam-seo-page";
import { BASE_OPEN_GRAPH } from "@/lib/seo";
import { ALL_EXAMS, TYPING_EXAMS, accuracyLabel, backspaceLabel, getTypingExam, levelOf, relatedExams, typingDurationLabel, typingExamFaqs, typingExamPath } from "@/lib/seo-exams";

export const dynamicParams = false;
export const generateStaticParams = () => TYPING_EXAMS.map((exam) => ({ slug: exam.slug }));

export async function generateMetadata({ params }: PageProps<"/typing-test/[slug]">): Promise<Metadata> {
  const exam = getTypingExam((await params).slug);
  if (!exam) return {};
  const title = `${exam.name} Typing Test – Speed, Pattern & Online Practice`;
  const description = `${exam.name} (${exam.fullName}) typing test: ${exam.speedEnglish} WPM English, ${exam.speedHindi} WPM Hindi, ${typingDurationLabel(exam)}, backspace ${backspaceLabel(exam.backspaceMode).toLowerCase()}. Practise the exam-pattern test online in Hindi & English on SC Typing.`;
  return { title, description, alternates: { canonical: typingExamPath(exam.slug) }, openGraph: { ...BASE_OPEN_GRAPH, title, description, url: typingExamPath(exam.slug) } };
}

export default async function TypingExamPage({ params }: PageProps<"/typing-test/[slug]">) {
  const exam = getTypingExam((await params).slug);
  if (!exam) notFound();
  const summary = ALL_EXAMS.find((item) => item.kind === "typing" && item.slug === exam.slug)!;
  return (
    <ExamSeoPage
      kindLabel="Typing Test"
      name={exam.name}
      fullName={exam.fullName}
      badge={exam.badge}
      level={levelOf(exam)}
      path={typingExamPath(exam.slug)}
      intro={`Everything about the ${exam.fullName} typing skill test: required speed in English and Hindi, time, accuracy and backspace rules, and an exam-pattern practice test you can take online.`}
      pattern={[
        { label: "Exam", value: exam.fullName },
        { label: "English typing speed", value: `${exam.speedEnglish} words per minute` },
        { label: "Hindi typing speed", value: `${exam.speedHindi} words per minute` },
        { label: "Test duration", value: typingDurationLabel(exam) },
        { label: "Accuracy", value: accuracyLabel(exam.accuracy) },
        { label: "Backspace", value: backspaceLabel(exam.backspaceMode) },
        { label: "Level", value: `${levelOf(exam)} government exam` },
      ]}
      patternSourced={exam.patternSourced}
      notes={exam.patternNotes}
      notesHindi={exam.patternNotesHindi}
      faqs={typingExamFaqs(exam)}
      practiceHref={`/typing/exams/category/${exam.slug}`}
      related={relatedExams(summary)}
    />
  );
}

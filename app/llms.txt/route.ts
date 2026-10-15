import { examsByGroup } from "@/lib/seo-exams";
import { BUSINESS, FULL_ADDRESS, HOME_FAQS, SAME_AS, SERVICES, SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/seo";

// llms.txt (https://llmstxt.org): a plain summary of the site for AI answer
// engines, built from the same facts as the pages and the JSON-LD.
export const dynamic = "force-static";

export function GET() {
  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} (also known as SC Typing, website sctyping.com) prepares students across India for the typing, stenography and computer efficiency tests of government exams: SSC, Railway, High Courts, Supreme Court and all state-level exams. Its coaching centre is in Sanganer, Jaipur (Rajasthan). The website ${absoluteUrl("/")} also gives students online typing tests, efficiency tests, stenography dictation practice, live tests with published rankings, and government vacancy updates.

## Courses
${SERVICES.map((service) => `- ${service.name}: ${service.description}`).join("\n")}

## Exams covered
Each exam has its own page with the speed, time, accuracy and backspace rules. All exams: ${absoluteUrl("/exams")}

### Typing tests
${examsByGroup("typing").map(({ group, exams }) => `#### ${group}\n${exams.map((exam) => `- [${exam.name} typing test](${absoluteUrl(exam.path)}): ${exam.fullName}; ${exam.speedLabel}`).join("\n")}`).join("\n\n")}

### Stenography skill tests
${examsByGroup("stenography").map(({ group, exams }) => `#### ${group}\n${exams.map((exam) => `- [${exam.name}](${absoluteUrl(exam.path)}): ${exam.fullName}; ${exam.speedLabel}`).join("\n")}`).join("\n\n")}

## Contact
- Address: ${FULL_ADDRESS}
- Phone / WhatsApp: ${BUSINESS.phoneDisplay}
- Map: ${BUSINESS.mapUrl}
${SAME_AS.map((url) => `- ${url}`).join("\n")}

## Key pages
- [Home](${absoluteUrl("/")}): overview, latest results, vacancies and courses
- [All exams](${absoluteUrl("/exams")}): typing and stenography test pattern for every central and state government exam
- [Buy a Course](${absoluteUrl("/courses")}): course plans and fees
- [Live Test](${absoluteUrl("/live-test")}): scheduled live typing, stenography and efficiency tests with results
- [Vacancies](${absoluteUrl("/vacancies")}): government job notices, admit cards and results
- [About](${absoluteUrl("/about")}) and [Contact](${absoluteUrl("/contact")})

## FAQ
${HOME_FAQS.map((faq) => `### ${faq.question}\n${faq.answer}`).join("\n\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

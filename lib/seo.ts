import { ALL_EXAMS } from "./seo-exams.ts";

// Search (SEO), answer-engine (AEO) and generative-engine (GEO) data for the
// public site. One source for the business facts so the page text, the
// JSON-LD structured data, llms.txt and the sitemap never disagree.

// Fixed, not NEXT_PUBLIC_SITE_URL: that is often a localhost value on dev
// copies, and a wrong canonical/sitemap host would de-index the real site.
export const SITE_URL = "https://sctyping.com";
export const SITE_NAME = "Samradhi Classes";
// Other names people search for: the site is sctyping.com, "SC Typing".
export const SITE_ALIASES = ["SC Typing", "SCTyping", "sctyping.com", "Samradhi Classes Jaipur", "समृद्धि क्लासेस"];
export const SITE_TITLE_BRAND = `${SITE_NAME} (SC Typing)`;
export const SITE_TAGLINE = "Govt Exam Typing, Stenography & Efficiency Test Preparation";
export const SITE_DESCRIPTION =
  "Prepare for every government exam typing test with Samradhi Classes (SC Typing): SSC CHSL/CGL, SSC Stenographer, Railway RRB NTPC, Rajasthan High Court, RSSB LDC and all state-level exams. Hindi (Kruti Dev, Mangal) & English typing tests, stenography dictation and MS Word/Excel efficiency tests online, plus coaching in Sanganer, Jaipur.";

export const BUSINESS = {
  phone: "+91-7014371324",
  phoneDisplay: "7014371324",
  whatsapp: "https://wa.me/917014371324",
  streetAddress: "26, Bairwa Colony, near Shri Ram Marriage Garden, near Sanganer Airport, behind Choudhary Petrol Pump, Sanganer",
  locality: "Jaipur",
  region: "Rajasthan",
  regionCode: "IN-RJ",
  postalCode: "302029",
  country: "IN",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=26%2C%20Bairwa%20Colony%2C%20Sanganer%2C%20Jaipur%20302029",
  logo: "/samradhi-classes-logo.png",
} as const;

export const FULL_ADDRESS = `${BUSINESS.streetAddress}, ${BUSINESS.locality}, ${BUSINESS.region} – ${BUSINESS.postalCode}`;

export const SAME_AS = [
  "https://youtube.com/@samradhiclasses",
  "https://www.instagram.com/samradhiclasses",
  "https://t.me/Samradhiclasses",
  "https://classplusapp.com/w/samradhiclasses",
];

export const SEO_KEYWORDS = [
  "SC Typing", "sctyping", "sctyping.com", "SC typing test", "Samradhi Classes", "Samradhi Classes Jaipur",
  "government exam typing test", "govt exam typing test preparation", "online typing test for government exams", "typing test practice",
  "SSC typing test", "SSC CHSL typing test", "SSC CGL typing test", "SSC DEST", "SSC stenographer", "SSC steno skill test",
  "railway typing test", "RRB NTPC typing test", "railway clerk typing test", "high court typing test", "Rajasthan High Court LDC typing test",
  "high court stenographer", "RSSB LDC typing test", "RSSB LDC efficiency test", "state level typing test", "DSSSB typing test",
  "UP Police typing test", "MP CPCT", "BELTRON typing test", "Hindi typing test", "English typing test", "Kruti Dev typing test",
  "Mangal typing test", "InScript typing", "Remington Gail typing", "stenography dictation", "Hindi stenography", "English stenography",
  "computer efficiency test", "MS Word efficiency test", "typing classes in Jaipur", "stenography coaching Jaipur",
  "सरकारी परीक्षा टाइपिंग टेस्ट", "हिंदी टाइपिंग टेस्ट", "कृतिदेव टाइपिंग टेस्ट", "स्टेनोग्राफी", "एसएससी टाइपिंग टेस्ट", "रेलवे टाइपिंग टेस्ट", "हाईकोर्ट टाइपिंग टेस्ट", "टाइपिंग कोचिंग जयपुर",
];

// Every exam named anywhere in SEO comes from the Exam Simulator's own
// categories (lib/seo-exams.ts), never a hand-written list.
export const EXAMS_COVERED: string[] = [...new Set(ALL_EXAMS.map((exam) => exam.name))];

export const SERVICES = [
  {
    name: "Government Exam Typing Test Preparation (Hindi & English)",
    description: "Typing test practice for SSC, Railway, High Court and all state-level exams: English typing and Hindi typing in Kruti Dev 010, Mangal (Unicode), DevLys, Remington Gail and InScript, marked the way each exam calculates speed and mistakes.",
    path: "/courses",
  },
  {
    name: "Stenography (Hindi & English)",
    description: "Shorthand dictation at exam speeds and transcription practice for SSC Stenographer Grade C & D, Railway, High Court, Supreme Court, Rajasthan and other state stenographer exams.",
    path: "/courses",
  },
  {
    name: "Computer Efficiency Test (MS Word & Excel)",
    description: "Practical MS Word and Excel efficiency tests in the exact format of RSSB LDC, Rajasthan High Court LDC and RHC SA exams, with automatic marking.",
    path: "/courses",
  },
] as const;

export type Faq = { question: string; answer: string };

// Shown on the homepage AND emitted as FAQPage JSON-LD -- Google requires the
// structured answers to be visible on the page, so keep them identical.
export const HOME_FAQS: Faq[] = [
  {
    question: "What does Samradhi Classes (SC Typing) offer?",
    answer: "Samradhi Classes prepares students for the typing, stenography and computer efficiency tests of government exams: SSC, Railway, High Courts, Supreme Court and all state-level exams. Students practise Hindi (Kruti Dev, Mangal) and English typing tests, stenography dictation and MS Word/Excel efficiency tests online at sctyping.com, and can also join coaching in Sanganer, Jaipur.",
  },
  {
    question: "Which government exams can I prepare for here?",
    answer: "Typing tests of SSC CHSL, SSC CGL, RRB NTPC, Supreme Court JCA, Delhi, Allahabad, Rajasthan, Patna, Bombay and Jharkhand High Courts, CRPF, BSF, SSB and Delhi Police HCM, DSSSB, KVS, EMRS and CSIR JSA, NCERT and AIIMS LDC, Rajasthan LDC, DEO, Tax Assistant and Informatics Assistant, UPSSSC, UP Police, Bihar Civil Court and MP CPCT; and stenography skill tests of SSC Steno C & D, Supreme Court PA, 11 High Courts, Central Secretariat, Income Tax, CBI, IB, RBI, EPFO, DSSSB, RSMSSB, Rajasthan District Courts and Parliament Reporter. The full list with each exam's pattern is at sctyping.com/exams.",
  },
  {
    question: "Is SC Typing (sctyping.com) the official website of Samradhi Classes?",
    answer: "Yes. SC Typing at sctyping.com is the official website of Samradhi Classes for online government exam typing tests, stenography practice, efficiency tests, live tests and results.",
  },
  {
    question: "Can I take a government exam typing test online for free?",
    answer: "Yes. Create a free account on sctyping.com to take online typing tests in English and Hindi (Kruti Dev and Mangal) in exam pattern, with speed, accuracy and mistake reports. Full course access is available with a paid plan.",
  },
  {
    question: "Do you have SSC and High Court stenography dictation practice?",
    answer: "Yes. Students practise Hindi and English shorthand dictation at exam speeds and transcribe it in an exam-style typing screen, following SSC Stenographer, Railway, High Court and state stenographer exam patterns.",
  },
  {
    question: "What is the computer efficiency test in RSSB LDC and Rajasthan High Court exams?",
    answer: "It is a practical test where candidates format and edit a document in MS Word (and work on a spreadsheet in Excel) within a time limit. Samradhi Classes provides exam-format efficiency tests with automatic marking question by question.",
  },
  {
    question: "Where is Samradhi Classes located?",
    answer: `The coaching centre is at ${FULL_ADDRESS}. Online tests on sctyping.com can be taken from anywhere in India. Call ${BUSINESS.phoneDisplay} for details.`,
  },
  {
    question: "How can I join and what are the fees?",
    answer: `Course plans and fees are listed on the Buy a Course page (sctyping.com/courses). To enroll, call or WhatsApp ${BUSINESS.phoneDisplay}.`,
  },
  {
    question: "क्या यहाँ SSC, रेलवे, हाईकोर्ट और राज्य स्तरीय परीक्षाओं के टाइपिंग टेस्ट की तैयारी होती है?",
    answer: "हाँ। समृद्धि क्लासेस (SC Typing) पर SSC, रेलवे, हाईकोर्ट, सुप्रीम कोर्ट और सभी राज्य स्तरीय सरकारी परीक्षाओं के हिंदी (कृतिदेव, मंगल) व अंग्रेज़ी टाइपिंग टेस्ट, स्टेनोग्राफी डिक्टेशन और MS Word/Excel एफिशिएंसी टेस्ट की ऑनलाइन तैयारी sctyping.com पर होती है। कोचिंग सेंटर सांगानेर, जयपुर में है।",
  },
];

export const BASE_OPEN_GRAPH = { type: "website" as const, locale: "en_IN", alternateLocale: ["hi_IN"], siteName: SITE_NAME };

export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

const ORG_ID = `${SITE_URL}/#organization`;

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["EducationalOrganization", "LocalBusiness"],
        "@id": ORG_ID,
        name: SITE_NAME,
        alternateName: SITE_ALIASES,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        logo: absoluteUrl(BUSINESS.logo),
        image: absoluteUrl(BUSINESS.logo),
        telephone: BUSINESS.phone,
        address: {
          "@type": "PostalAddress",
          streetAddress: BUSINESS.streetAddress,
          addressLocality: BUSINESS.locality,
          addressRegion: BUSINESS.region,
          postalCode: BUSINESS.postalCode,
          addressCountry: BUSINESS.country,
        },
        hasMap: BUSINESS.mapUrl,
        areaServed: [{ "@type": "Country", name: "India" }, { "@type": "State", name: "Rajasthan" }, { "@type": "City", name: "Jaipur" }],
        sameAs: SAME_AS,
        contactPoint: { "@type": "ContactPoint", telephone: BUSINESS.phone, contactType: "admissions", availableLanguage: ["Hindi", "English"], areaServed: "IN" },
        knowsAbout: ["Government exam typing test", "Hindi typing", "English typing", "Kruti Dev", "Mangal Unicode typing", "InScript", "Remington Gail", "MS Word efficiency test", "MS Excel efficiency test", "Stenography", "Shorthand", ...EXAMS_COVERED],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Courses",
          itemListElement: SERVICES.map((service) => ({ "@type": "Offer", itemOffered: { "@type": "Course", name: service.name, description: service.description, provider: { "@id": ORG_ID } } })),
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: ["SC Typing", "sctyping.com"],
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        inLanguage: ["en-IN", "hi-IN"],
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

export function coursesJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Samradhi Classes courses",
    itemListElement: SERVICES.map((service, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: { "@type": "Course", name: service.name, description: service.description, url: absoluteUrl(service.path), inLanguage: ["en", "hi"], provider: { "@id": ORG_ID } },
    })),
  };
}

export function faqJsonLd(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}

/** Serialises JSON-LD for a <script> tag; "<" is escaped so data can't close the tag. */
export const jsonLdHtml = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

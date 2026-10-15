// Search (SEO), answer-engine (AEO) and generative-engine (GEO) data for the
// public site. One source for the business facts so the page text, the
// JSON-LD structured data, llms.txt and the sitemap never disagree.

// Fixed, not NEXT_PUBLIC_SITE_URL: that is often a localhost value on dev
// copies, and a wrong canonical/sitemap host would de-index the real site.
export const SITE_URL = "https://sctyping.com";
export const SITE_NAME = "Samradhi Classes";
export const SITE_TAGLINE = "Typing, Computer Efficiency & Stenography Coaching in Jaipur";
export const SITE_DESCRIPTION =
  "Samradhi Classes, Sanganer, Jaipur: Hindi & English typing (Kruti Dev, Mangal, InScript), computer efficiency (MS Word & Excel) and stenography coaching for RSSB LDC, RHC LDC, SSC CHSL, SSC Steno and High Court exams, with free online typing tests.";

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
  "typing classes in Jaipur", "typing coaching Jaipur", "Samradhi Classes", "Samradhi Classes Sanganer",
  "Hindi typing test", "English typing test", "Kruti Dev typing", "Mangal typing", "InScript typing", "Remington Gail typing",
  "online typing test", "RSSB LDC typing test", "RHC LDC typing test", "SSC CHSL typing test", "computer efficiency test",
  "RSSB LDC efficiency test", "MS Word efficiency test", "stenography coaching Jaipur", "Hindi stenography", "English stenography",
  "SSC stenographer", "High Court stenographer", "टाइपिंग कोचिंग जयपुर", "हिंदी टाइपिंग टेस्ट", "कृतिदेव टाइपिंग", "स्टेनोग्राफी कोचिंग",
];

export const EXAMS_COVERED = [
  "SSC CGL", "SSC CHSL", "SSC Stenographer", "RRB NTPC", "DSSSB", "KVS/NVS", "RSSB LDC", "RSSB IA", "RSSB Stenographer",
  "Rajasthan High Court LDC", "Rajasthan High Court SA", "RVVUNL", "MP High Court", "Allahabad High Court", "Supreme Court JCA",
  "MP-CPCT", "UPPSC", "UPPCL", "UP Police", "BELTRON",
];

export const SERVICES = [
  {
    name: "Hindi & English Typing",
    description: "English typing and Hindi typing in Kruti Dev 010, Mangal (Unicode), DevLys, Remington Gail and InScript layouts, trained to the speed and accuracy each government exam requires.",
    path: "/courses",
  },
  {
    name: "Computer Efficiency (MS Word & Excel)",
    description: "Practical MS Word and Excel efficiency tests in the exact format of RSSB LDC, RHC LDC and RHC SA exams, with automatic marking.",
    path: "/courses",
  },
  {
    name: "Stenography (Hindi & English)",
    description: "Shorthand dictation at exam speeds and transcription practice for SSC, RSSB, High Court, Supreme Court and Judicial Assistant stenographer exams.",
    path: "/courses",
  },
] as const;

export type Faq = { question: string; answer: string };

// Shown on the homepage AND emitted as FAQPage JSON-LD -- Google requires the
// structured answers to be visible on the page, so keep them identical.
export const HOME_FAQS: Faq[] = [
  {
    question: "What does Samradhi Classes teach?",
    answer: "Samradhi Classes teaches Hindi and English typing (Kruti Dev 010, Mangal, DevLys, Remington Gail and InScript), computer efficiency (MS Word and Excel) and Hindi and English stenography for government job exams.",
  },
  {
    question: "Where is Samradhi Classes located?",
    answer: `Samradhi Classes is at ${FULL_ADDRESS}. You can call ${BUSINESS.phoneDisplay} before visiting.`,
  },
  {
    question: "Which exams does Samradhi Classes prepare students for?",
    answer: "Typing, efficiency and stenography tests of SSC CGL/CHSL, SSC Stenographer, RRB NTPC, DSSSB, RSSB LDC, RSSB IA, Rajasthan High Court LDC and SA, MP High Court, Allahabad High Court, Supreme Court, MP-CPCT, UPPSC, UPPCL, UP Police and BELTRON, among others.",
  },
  {
    question: "Can I take a Hindi or English typing test online for free?",
    answer: "Yes. Create a free account on sctyping.com to take online typing tests in English and Hindi (Kruti Dev and Mangal) with exam-style speed, accuracy and mistake reports. Full course access is available with a paid plan.",
  },
  {
    question: "What is the computer efficiency test in RSSB LDC and RHC LDC exams?",
    answer: "It is a practical test where candidates format and edit a document in MS Word (and work on a spreadsheet in Excel) within a time limit. Samradhi Classes provides exam-format efficiency tests with automatic marking question by question.",
  },
  {
    question: "Does Samradhi Classes offer stenography dictation practice?",
    answer: "Yes. Students practise Hindi and English shorthand dictation at exam speeds and transcribe it in an exam-style typing screen, following SSC, RSSB and High Court stenographer patterns.",
  },
  {
    question: "How can I join Samradhi Classes and what are the fees?",
    answer: `Course plans and fees are listed on the Buy a Course page (sctyping.com/courses). To enroll, call or WhatsApp ${BUSINESS.phoneDisplay}.`,
  },
  {
    question: "क्या समृद्धि क्लासेस में हिंदी टाइपिंग (कृतिदेव और मंगल) सिखाई जाती है?",
    answer: "हाँ। समृद्धि क्लासेस, सांगानेर, जयपुर में कृतिदेव 010, मंगल (यूनिकोड), रेमिंग्टन गेल और इनस्क्रिप्ट में हिंदी टाइपिंग, MS Word/Excel एफिशिएंसी और हिंदी-अंग्रेज़ी स्टेनोग्राफी की तैयारी कराई जाती है। ऑनलाइन टाइपिंग टेस्ट sctyping.com पर उपलब्ध हैं।",
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
        alternateName: ["Samradhi Classes Jaipur", "समृद्धि क्लासेस"],
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
        areaServed: [{ "@type": "City", name: "Jaipur" }, { "@type": "State", name: "Rajasthan" }, { "@type": "Country", name: "India" }],
        sameAs: SAME_AS,
        contactPoint: { "@type": "ContactPoint", telephone: BUSINESS.phone, contactType: "admissions", availableLanguage: ["Hindi", "English"], areaServed: "IN" },
        knowsAbout: ["Hindi typing", "English typing", "Kruti Dev", "Mangal Unicode typing", "InScript", "Remington Gail", "MS Word efficiency test", "MS Excel efficiency test", "Stenography", "Shorthand", ...EXAMS_COVERED],
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

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const students = [
  {
    name: "Anil Bairwa",
    image: "/student-anil-bairwa.jpeg",
    imageAlt: "Anil Bairwa, selected in Rajasthan High Court LDC 2022 Re-exam",
    selection: "Selected in Rajasthan High Court LDC 2022 Re-exam",
    badge: "High Court LDC",
    stats: [["Final marks", "309"], ["Efficiency", "45 out of 50"], ["Posting", "District and Sessions Judge Court, Bundi"]],
    review: "नंबर 1—बस उम्मीदवार मेहनत करने वाला होना चाहिए।",
  },
  {
    name: "Dharmendra Verma",
    image: "/student-dharmendra-verma.png",
    imageAlt: "Dharmendra Verma, ICDS Jaipur UDC",
    selection: "2018 Vacancy · Joined ICDS Jaipur in June 2020",
    badge: "Promoted to UDC in 2025",
    stats: [["Paper 1", "63 marks"], ["Paper 2", "65 marks"], ["Skill test", "92 marks"], ["Department", "ICDS, Jaipur"]],
    review: "यह टाइपिंग इंस्टीट्यूट सीखने के लिए एक बेहतरीन जगह है। यहाँ का माहौल बहुत अच्छा और पढ़ाई के लिए अनुकूल है। ट्यूटर का पढ़ाने का तरीका सरल, प्रभावी और समझने में आसान है। वे हर विद्यार्थी पर व्यक्तिगत ध्यान देते हैं और गलतियों को धैर्यपूर्वक सुधारते हैं। सही मार्गदर्शन और नियमित अभ्यास से मेरी टाइपिंग स्पीड और एक्यूरेसी में काफी सुधार हुआ। मैं इस इंस्टीट्यूट और ट्यूटर की जरूर सिफारिश करूँगा।",
  },
  {
    name: "Deepak",
    image: "/student-deepak.jpeg",
    imageAlt: "Deepak at the Sub-Registrar office in Sikar",
    selection: "Informatics Assistant (IA), 2023 Batch",
    badge: "Posted in home district",
    stats: [["Final marks", "78.32 out of 100"], ["Typing test", "Qualified"], ["Department", "Registration and Stamps"], ["Posting", "Sub-Registrar, Sikar Collectorate"]],
    review: "मैंने 3–4 टाइपिंग क्लासेज जॉइन कीं, लेकिन फीस से लेकर मार्गदर्शन और मोटिवेशन तक आपके जैसा शिक्षक नहीं मिला। आप मेरे लिए बड़े भाई जैसे हैं। आपके साथ बिताया समय जीवनभर याद रहेगा, सर/भैया।",
  },
  {
    name: "Mansingh Meena",
    image: "/student-mansingh-meena.jpeg",
    imageAlt: "Mansingh Meena at the Chief Minister Office, Rajasthan",
    selection: "RSSB Clerk Grade II & Junior Assistant, 2024",
    badge: "Joined September 2025",
    stats: [["Final marks", "216"], ["Paper", "142 marks"], ["Skill test", "74 marks"], ["Post", "Clerk Grade II"], ["Department", "CMO Secretariat"], ["District", "Sawai Madhopur"]],
    review: "Great coaching with excellent faculty and proper guidance. The study material and test series were very helpful. Highly recommended!",
  },
  {
    name: "Neeraj Verma",
    image: "/student-neeraj-verma-enhanced.png",
    imageAlt: "Neeraj Verma, UDC at Government Girls College Tonk",
    selection: "Junior Assistant Recruitment, 2018",
    badge: "Currently UDC",
    stats: [["Total marks", "197"], ["Written", "110 marks"], ["Skill typing", "87 marks"], ["Department", "College Education"], ["Office", "Government Girls College, Tonk"]],
    review: "किताबों से निकालकर, दुनिया की समझ दिलाई; आपकी ही सीख ने हमें ये मंजिल दिलाई। आज लग गई नौकरी, तो झुकता है सिर मेरा; गुरु Ajay Sir के आशीर्वाद से रोशन हुआ सवेरा।",
  },
  {
    name: "Pushpendra",
    image: "/student-pushpendra.jpeg",
    imageAlt: "Pushpendra, selected from the 2018 recruitment",
    selection: "2018 Recruitment · Posted in 2020",
    badge: "Selected",
    stats: [["Written marks", "100+"], ["Typing efficiency", "92"]],
    review: "आप तो बेस्ट हो ही, सर। मैं शुरुआत में टाइपिंग छोड़ देता, लेकिन आपने ही हिम्मत दी थी। आपका बहुत धन्यवाद। उस समय अगर हिम्मत हार जाता तो चयन नहीं हो पाता।",
  },
  {
    name: "Rakesh Meena",
    image: "/student-rakesh-meena-enhanced.png",
    imageAlt: "Rakesh Meena, Informatics Assistant at SDM Office Sirohi",
    selection: "Informatics Assistant, 2023",
    badge: "Joined 18 August 2025",
    stats: [["Final marks", "68.66%"], ["Department", "SDM Office, Sirohi"], ["Posting district", "Sirohi"]],
    review: "सर, 15 अगस्त का झंडारोहण आज भी नहीं भूल सकता। चीफ गेस्ट भी आपने मुझे ही बनाया और मुझसे झंडारोहण करवाया। आपने उस समय जो साथ दिया, वह हमेशा याद रहेगा।",
  },
  {
    name: "Vishal Lodwal",
    image: "/student-vishal-lodwal-enhanced.png",
    imageAlt: "Vishal Lodwal, Informatics Assistant at Karauli Collectorate",
    selection: "Informatics Assistant, 2025 Batch",
    badge: "Revenue Department",
    stats: [["Final marks", "82.83 out of 100"], ["Department", "Revenue Department"], ["Posting", "Karauli Collectorate"]],
    review: "Thank you so much, Sir. आपने टाइपिंग टेस्ट के लिए मेरी बहुत मदद की। मैं Samradhi Classes का बहुत आभारी हूँ।",
  },
] as const;

export function StudentSuccessCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const student = students[active];
  const show = (index: number) => setActive((index + students.length) % students.length);

  useEffect(() => {
    if (paused || students.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % students.length), 5000);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <section aria-label="Student success stories and institution details" className="mt-8 grid overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm lg:grid-cols-[1.35fr_.65fr]">
      <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }} className="relative min-w-0 p-5 sm:p-7">
        <button type="button" onClick={() => show(active - 1)} aria-label="Previous student" className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-blue-700/90 text-white shadow-lg transition hover:scale-110 hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
        <button type="button" onClick={() => show(active + 1)} aria-label="Next student" className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-blue-700/90 text-white shadow-lg transition hover:scale-110 hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
        <article key={student.name} aria-live="polite" className="student-slide grid gap-6 sm:grid-cols-[170px_1fr]">
          <Image src={student.image} alt={student.imageAlt} width={1024} height={1280} className="mx-auto aspect-[4/5] w-44 rounded-2xl object-cover object-top shadow-md"/>
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-widest text-green-700">Student success story</p><h2 className="mt-2 text-2xl font-black text-slate-950">{student.name}</h2><p className="mt-1 font-bold text-blue-700">{student.selection}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{student.badge}</span></div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{student.stats.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-black text-slate-950">{value}</dd></div>)}</dl>
            <blockquote className="mt-4 max-h-40 overflow-y-auto rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4 text-sm font-semibold leading-7 text-slate-800">“{student.review}”</blockquote>
          </div>
        </article>
      </div>
      <aside className="border-t border-blue-100 bg-blue-700 p-6 text-white lg:border-l lg:border-t-0 lg:p-7"><p className="text-xs font-black uppercase tracking-widest text-blue-200">Offline institution</p><h2 className="mt-2 text-2xl font-black">Visit Samradhi Classes</h2><address className="mt-4 not-italic leading-7 text-blue-50">26, Bairwa Colony, near Shri Ram Marriage Garden, near Sanganer Airport, behind Choudhary Petrol Pump, Sanganer, Jaipur – 302029</address><a href="tel:7014371324" className="mt-5 block rounded-xl bg-white px-4 py-3 text-center font-black text-blue-700">Call 7014371324</a><a href="https://www.google.com/maps/search/?api=1&query=26%2C%20Bairwa%20Colony%2C%20Sanganer%2C%20Jaipur%20302029" target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-xl border border-blue-300 px-4 py-3 text-center font-black text-white hover:bg-blue-600">Open in Google Maps</a></aside>
      <style jsx>{`@keyframes student-slide-in{from{opacity:0;transform:translateX(48px)}to{opacity:1;transform:translateX(0)}}.student-slide{animation:student-slide-in .45s ease-out}@media(prefers-reduced-motion:reduce){.student-slide{animation:none}}`}</style>
    </section>
  );
}

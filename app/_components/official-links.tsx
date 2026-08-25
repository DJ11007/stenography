export const OFFICIAL_LINKS = [
  { label: "YouTube", href: "https://youtube.com/@samradhiclasses", ariaLabel: "Visit Samradhi Classes on YouTube", icon: "youtube", iconColor: "text-red-600" },
  { label: "Instagram", href: "https://www.instagram.com/samradhiclasses", ariaLabel: "Visit Samradhi Classes on Instagram", icon: "instagram", iconColor: "text-fuchsia-600" },
  { label: "Mobile App", href: "https://inxcft.on-app.in/app/home/app/home?orgCode=inxcft", ariaLabel: "Open the official Samradhi Classes mobile app", icon: "mobile", iconColor: "text-blue-500" },
  { label: "Existing Website", href: "https://classplusapp.com/w/samradhiclasses", ariaLabel: "Visit the existing Samradhi Classes website", icon: "website", iconColor: "text-indigo-500" },
  { label: "Telegram", href: "https://t.me/Samradhiclasses", ariaLabel: "Join Samradhi Classes on Telegram", icon: "telegram", iconColor: "text-sky-500" },
] as const;

type OfficialIcon = (typeof OFFICIAL_LINKS)[number]["icon"];

export function OfficialLinkIcon({ name, className }: { name: OfficialIcon; className: string }) {
  const common = { "aria-hidden": true, focusable: false, viewBox: "0 0 24 24", className: `h-5 w-5 shrink-0 ${className}` } as const;
  if (name === "youtube") return <svg {...common} fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>;
  if (name === "instagram") return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>;
  if (name === "telegram") return <svg {...common} fill="currentColor"><path d="M22.6 2.3a1.2 1.2 0 0 0-1.2-.2L2.2 9.5c-1.3.5-1.3 1.3-.2 1.7l4.9 1.5 1.9 5.8c.2.7.1 1 .8 1 .5 0 .7-.2 1-.5l2.4-2.3 5 3.7c.9.5 1.6.3 1.8-.9l3.2-15.7c.3-.9 0-1.3-.4-1.5ZM8.2 12.4l10.7-6.8c.5-.3 1-.1.6.2l-8.8 8-.3 3.3-2.2-4.7Z"/></svg>;
  if (name === "mobile") return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 5h4M11 18h2"/></svg>;
  return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>;
}

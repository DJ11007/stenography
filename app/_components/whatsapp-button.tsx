const WHATSAPP_NUMBER = "917014371324";
const DEFAULT_MESSAGE = "Hi Samradhi Classes, I have a question about your courses.";

export function WhatsAppButton() {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Samradhi Classes on WhatsApp"
      className="group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] py-3 pl-3 pr-3 text-white shadow-xl shadow-black/20 transition-all hover:pr-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-7 w-7 shrink-0" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.2 8.2 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.4-.5.3-.4c.1-.1.1-.3 0-.4s-.7-1.7-1-2.3-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4A3.4 3.4 0 0 0 5.8 9c0 1.3.9 2.5 1 2.7.1.1 1.8 2.8 4.4 3.9a15 15 0 0 0 1.5.5c.6.2 1.2.2 1.6.1.5-.1 1.7-.7 1.9-1.3s.3-1.2.2-1.3-.2-.1-.5-.2Z"/><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z"/></svg>
      <span className="max-w-0 overflow-hidden whitespace-nowrap font-black opacity-0 transition-all duration-300 group-hover:max-w-xs group-hover:opacity-100">Chat with us</span>
    </a>
  );
}

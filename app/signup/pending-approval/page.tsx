import Link from "next/link";
import { AuthShell } from "../../_components/auth-shell";

const SUPPORT_WHATSAPP_NUMBER = "917014371324";
const SUPPORT_PHONE_DISPLAY = "7014371324";
const ACTIVATE_ACCOUNT_MESSAGE = "Hi Samradhi Classes, I just signed up and my account is pending approval. Please help activate it.";
const activateAccountWhatsAppHref = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(ACTIVATE_ACCOUNT_MESSAGE)}`;

export default function SignupPendingApprovalPage() {
  return (
    <AuthShell title="Account created" subtitle="One more step before you can sign in">
      <div className="mt-8 space-y-5 text-center">
        <p className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
          Your account has been created. Please contact support/admin to activate your account — you&apos;ll be able to sign in once it&apos;s activated.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href={activateAccountWhatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 font-semibold text-white transition hover:bg-[#1ebe57]"
          >
            Chat with support on WhatsApp
          </a>
          <a
            href={`tel:+${SUPPORT_WHATSAPP_NUMBER}`}
            className="inline-flex flex-col items-center rounded-lg bg-blue-700 px-5 py-2.5 text-white transition hover:bg-blue-800"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-200">Call now</span>
            <span className="text-xl font-black tracking-wide">{SUPPORT_PHONE_DISPLAY}</span>
          </a>
        </div>
        <p className="text-sm text-slate-600">
          Already approved? <Link href="/login" className="font-semibold text-blue-700">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}

import Link from "next/link";
import { AuthShell } from "../_components/auth-shell";

export default function AccountHelpPage() {
  return (
    <AuthShell title="Need help signing in?" subtitle="Account recovery is handled by our team">
      <div className="mt-8 space-y-5 text-center">
        <p className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
          For a forgotten password, email, or mobile number, please contact your admin or Samradhi Classes support directly — they can verify your identity and help you back into your account.
        </p>
        <Link href="/connect" className="block w-full rounded-lg bg-blue-700 py-3 font-semibold text-white hover:bg-blue-800">Contact support</Link>
        <p className="text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-blue-700">Back to sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}

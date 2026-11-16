import { requireAdmin } from "@/lib/auth";
import { activationSigningStatus } from "@/lib/activation-keys";
import { BackButton } from "../../_components/back-button";
import { ActivationKeyMaker } from "./activation-key-maker";

export default async function AppActivationPage() {
  await requireAdmin();
  const status = activationSigningStatus();
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/admin" label="Admin panel" />
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-300">SCTyping desktop app</p>
          <h1 className="mt-2 text-3xl font-black">App Activation</h1>
          <p className="mt-2 text-sm text-slate-300">A student sends you the <b>Device ID</b> shown on the app&apos;s Activate screen (usually on WhatsApp, after paying). Paste it here, make the key, and send the key back. It works only on that one computer.</p>
        </div>
        {status !== "ready" && (
          <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-black">{status === "missing" ? "Activation signing key not set up on the server yet" : "The signing key on the server is not the right one"}</p>
            <p className="mt-1">Add <code className="rounded bg-white px-1">SCTYPING_ACTIVATION_PRIVATE_KEY</code> to the server&apos;s <code className="rounded bg-white px-1">.env.local</code> (the single line inside the file <code className="rounded bg-white px-1">stenography-offline/scripts/.private-key.txt</code> on the office PC), then rebuild and restart the site.</p>
          </div>
        )}
        <ActivationKeyMaker ready={status === "ready"} />
      </div>
    </main>
  );
}

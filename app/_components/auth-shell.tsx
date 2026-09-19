import Image from "next/image";
import type { ReactNode } from "react";
import { BackButton } from "./back-button";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  variant = "brand",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "brand" | "admin";
}) {
  const gradient =
    variant === "admin"
      ? "from-slate-950 via-slate-900 to-blue-950"
      : "from-blue-700 via-indigo-800 to-violet-900";

  return (
    <main className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br ${gradient} px-4 py-10`}>
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div aria-hidden className="animate-blob-float absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-400/25 blur-3xl" />
      <div
        aria-hidden
        className="animate-blob-float absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl"
        style={{ animationDelay: "-5s" }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BackButton href="/" label="Back to home" dark />
        </div>

        <div className="animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/samradhi-classes-logo.png"
              alt="Samradhi Classes"
              width={64}
              height={64}
              priority
              className="h-16 w-16 rounded-full object-contain shadow-md ring-2 ring-blue-100"
            />
            <h1 className="mt-4 text-2xl font-black text-slate-950">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-blue-100">{footer}</div>}
      </div>
    </main>
  );
}

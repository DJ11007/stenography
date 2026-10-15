import type { Metadata } from "next";
import { AuthShell } from "../_components/auth-shell";
import SignupForm from "./signup-form";

export const metadata: Metadata = {
  title: "Sign Up – Free Online Typing Tests",
  description: "Create a free Samradhi Classes account to take Hindi (Kruti Dev, Mangal) and English typing tests, efficiency tests and stenography practice online.",
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" subtitle="Join Samradhi Classes to start practicing">
      <SignupForm />
    </AuthShell>
  );
}

import type { Metadata } from "next";
import { AuthShell } from "../_components/auth-shell";
import SignupForm from "./signup-form";

export const metadata: Metadata = {
  title: "Sign Up – Free Government Exam Typing Tests",
  description: "Create a free SC Typing account to practise SSC, Railway, High Court and state exam typing tests in Hindi (Kruti Dev, Mangal) and English, plus stenography and efficiency tests.",
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" subtitle="Join Samradhi Classes to start practicing">
      <SignupForm />
    </AuthShell>
  );
}

export type StudentAccessStatus = {
  student_id: string;
  tests_today: number;
  tests_total: number;
  test_limit: number | null;
  tests_used_in_window: number;
  tests_remaining: number | null;
  validity_expires_at: string | null;
  grace_days: number;
  access_locked: boolean;
  status: "active" | "grace" | "locked";
};

export type AccessRow = StudentAccessStatus & {
  full_name: string | null;
  email: string;
  avg_score: number | null;
  access_granted_at: string;
};

export function AccessStatusBadge({ access }: { access: StudentAccessStatus | null }) {
  if (!access) return <span className="text-slate-400">—</span>;
  const label = access.status === "locked" ? "Locked" : access.status === "grace" ? "Grace period" : access.tests_today > 0 ? "Test today" : "No test today";
  const tone = access.status === "locked" ? "bg-red-100 text-red-800" : access.status === "grace" ? "bg-amber-100 text-amber-900" : access.tests_today > 0 ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{label}</span>;
}

export function validityLabel(access: StudentAccessStatus | null) {
  if (!access) return "—";
  if (!access.validity_expires_at) return "No expiry";
  const days = Math.ceil((new Date(access.validity_expires_at).getTime() - Date.now()) / 86400000);
  return days >= 0 ? `${days} day${days === 1 ? "" : "s"} left` : `Expired ${Math.abs(days)}d ago`;
}

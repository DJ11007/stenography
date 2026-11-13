"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Self-reported only -- the student clicks this after actually joining, so
// the dashboard banner stops reappearing for them. It is NOT proof of
// membership and grants nothing by itself: the real "free tests" reward
// stays a manual admin step once the student's own WhatsApp message
// ("approve my ID") arrives, using the existing free-practice/free-exam
// limit controls on their account.
export async function markTelegramJoined() {
  const supabase = await createClient();
  await supabase.rpc("mark_telegram_joined");
  revalidatePath("/student");
}

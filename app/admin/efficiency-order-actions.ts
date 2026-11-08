"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Saves the order the admin dragged the tests into (one list: one subject and language), first to last.
export async function saveEfficiencyTestOrder(subject: "word" | "excel", ids: string[]): Promise<{ ok: boolean; error: string }> {
  await requireAdmin();
  if (!ids.length || ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) return { ok: false, error: "Nothing to save." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_efficiency_test_order", { p_subject: subject, p_ids: ids });
  if (error) return { ok: false, error: /set_efficiency_test_order|sequence/i.test(error.message) ? "Run supabase/migrations/202611081000_efficiency_test_order.sql in the Supabase SQL Editor first." : error.message };
  revalidatePath(subject === "word" ? "/admin/word-efficiency-tests" : "/admin/excel-efficiency-tests");
  return { ok: true, error: "" };
}

export async function saveWordTestOrder(ids: string[]) { return saveEfficiencyTestOrder("word", ids); }
export async function saveExcelTestOrder(ids: string[]) { return saveEfficiencyTestOrder("excel", ids); }

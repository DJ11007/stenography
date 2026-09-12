import { createClient } from "./supabase/server";
import { STENOGRAPHY_CATEGORIES } from "./stenography-categories";

export type StenographyCategoryNavigatorItem = { id: string; slug: string; title: string; publishedAt: string | null };

// "Court and legal" categories (Supreme Court PA, every High Court Steno,
// Rajasthan District Court) share admin-uploaded real dictation tests
// amongst themselves -- an admin test tagged to any one of them (via
// steno_category, set by the "Stenography category" picker in the admin
// test form) becomes visible on every other court/legal category's own
// rules page too, so a real court-matter passage created once is useful
// everywhere it's relevant. Every other category (SSC, RSMSSB, CBI, IB,
// RBI, Parliament Reporter, etc.) stays unshared -- only its own exactly-
// tagged tests show on its own page. iconKind === "scales" is this app's
// existing signal for "this is a judicial/court post", reused here rather
// than inventing a second classification that could drift out of sync.
const COURT_CATEGORY_SLUGS = STENOGRAPHY_CATEGORIES.filter((category) => category.iconKind === "scales").map((category) => category.slug);
const COURT_CATEGORY_SET = new Set(COURT_CATEGORY_SLUGS);

// Admin-uploaded tests tied to this stenography category (via steno_category
// inside tests.settings -- the same zero-migration jsonb pattern already
// used for exam_category/task_category/audio_path), sharing rules per the
// comment above. This is a live query (no caching -- createClient() forces
// dynamic rendering), so a freshly published test appears immediately.
export async function getStenographyCategoryNavigator(categorySlug: string, language: "English" | "Hindi"): Promise<StenographyCategoryNavigatorItem[]> {
  const supabase = await createClient();
  let query = supabase.from("tests").select("id,slug,title,published_at").eq("mode", "stenography").eq("status", "published").eq("visibility", "public").eq("is_live", false).eq("language", language);
  query = COURT_CATEGORY_SET.has(categorySlug)
    ? query.or(COURT_CATEGORY_SLUGS.map((slug) => `settings->>steno_category.eq.${slug}`).join(","))
    : query.eq("settings->>steno_category", categorySlug);
  const { data, error } = await query.order("published_at", { ascending: false }).order("id", { ascending: true });
  if (error) { console.error("Stenography category navigator query failed", { code: error.code, message: error.message }); throw new Error(`Stenography exercises could not be loaded (${error.code || "database error"}).`); }
  return (data ?? []).map((test) => ({ id: test.id, slug: test.slug, title: test.title, publishedAt: test.published_at }));
}

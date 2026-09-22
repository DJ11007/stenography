import { LiveResultsTicker, type PublicLiveResult } from "./live-results-ticker";

// Real reported request: Hindi and English live-test results used to be
// mixed into one feed, hard to scan for either language on its own.
// Static, always-visible stacked sections (not interactive tabs) --
// LiveResultsTicker is a plain, server-renderable component with no
// state today, and with only two languages there's no scale problem an
// interactive tab UI would be solving for.
export function LiveResultsByLanguage({ results }: { results: PublicLiveResult[] }) {
  // Defensive against the brief window between deploying this code and
  // pasting its migration into the Supabase Dashboard (this repo has no
  // migration-apply step of its own): the RPC's older signature has no
  // `language` column, so every row's `language` reads as undefined until
  // then -- filtering those out (rather than grouping under an
  // `undefined` key) keeps this from ever rendering a degraded React key.
  const known = results.filter((r) => r.language);
  const languages = [...new Set(known.map((r) => r.language))].sort();
  if (!languages.length) return <LiveResultsTicker results={[]} />;
  return (
    <div className="space-y-6">
      {languages.map((language) => (
        <div key={language}>
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">{language}</h3>
          <LiveResultsTicker results={known.filter((r) => r.language === language)} />
        </div>
      ))}
    </div>
  );
}

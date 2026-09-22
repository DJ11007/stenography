export type PublicLiveResult = { student_name: string; test_title: string; language: string; net_wpm: number; accuracy: number; submitted_at: string };

export function LiveResultsTicker({results}:{results:PublicLiveResult[]}){
  if(!results.length)return <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-5 py-6 text-center text-sm font-bold text-blue-800">Published live-test results will appear here automatically after their release time.</div>;
  const items=[...results,...results];
  return <div className="overflow-hidden rounded-2xl border border-blue-200 bg-white py-3 shadow-sm" aria-label="Published live-test results"><div className="live-results-track flex w-max gap-3 px-3 hover:[animation-play-state:paused]">{items.map((result,index)=><article key={`${result.student_name}-${result.submitted_at}-${index}`} className="w-60 shrink-0 rounded-xl border border-blue-100 bg-slate-50 px-4 py-3 text-center"><p className="font-black text-slate-900">{result.student_name}</p><p className="mt-1 truncate text-xs text-slate-500" title={result.test_title}>{result.test_title}</p><p className="mt-2 text-sm"><strong className="text-blue-700">{Number(result.net_wpm).toFixed(1)} WPM</strong> · <strong className="text-green-700">{Number(result.accuracy).toFixed(1)}%</strong></p></article>)}</div></div>;
}

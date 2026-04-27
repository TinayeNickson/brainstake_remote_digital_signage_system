export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="page-header">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-ink-100" />
          <div className="h-8 w-48 rounded-lg bg-ink-100" />
          <div className="h-3 w-20 rounded bg-ink-100" />
        </div>
        <div className="h-11 w-36 rounded-xl bg-ink-100" />
      </div>

      {/* Campaign row skeletons */}
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-5 flex items-center gap-4">
          <div className="shrink-0 w-20 h-14 rounded-lg bg-ink-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-ink-100" />
            <div className="h-3 w-1/2 rounded bg-ink-100" />
          </div>
          <div className="text-right space-y-2 shrink-0">
            <div className="h-5 w-20 rounded bg-ink-100" />
            <div className="h-3 w-10 rounded bg-ink-100 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

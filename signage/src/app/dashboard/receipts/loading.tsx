export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="page-header">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-ink-100" />
          <div className="h-8 w-36 rounded-lg bg-ink-100" />
        </div>
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-ink-100 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-ink-100" />
            <div className="h-3 w-48 rounded bg-ink-100" />
          </div>
          <div className="h-7 w-20 rounded bg-ink-100 shrink-0" />
        </div>
      ))}
    </div>
  );
}

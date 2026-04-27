export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Welcome banner skeleton */}
      <div className="rounded-2xl bg-ink-100 h-[106px]" />

      {/* KPI grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card p-5 space-y-3">
            <div className="flex justify-between">
              <div className="h-3 w-24 rounded bg-ink-100" />
              <div className="w-8 h-8 rounded-lg bg-ink-100" />
            </div>
            <div className="h-9 w-16 rounded-lg bg-ink-100" />
          </div>
        ))}
      </div>

      {/* Two-column skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card h-64" />
        <div className="space-y-4">
          <div className="card h-44" />
          <div className="card h-32" />
        </div>
      </div>
    </div>
  );
}

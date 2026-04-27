export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto space-y-7 animate-pulse">
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-ink-100" />
        <div className="h-8 w-56 rounded-lg bg-ink-100" />
      </div>

      {/* Stepper skeleton */}
      <div className="card p-5">
        <div className="flex items-start gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-ink-100" />
                <div className="h-2.5 w-14 rounded bg-ink-100 hidden sm:block" />
              </div>
              {i < 4 && <div className="flex-1 h-0.5 mt-4 mx-1.5 rounded-full bg-ink-100" />}
            </div>
          ))}
        </div>
      </div>

      {/* Card skeleton */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-ink-100">
          <div className="w-9 h-9 rounded-xl bg-ink-100" />
          <div className="space-y-1.5">
            <div className="h-5 w-40 rounded bg-ink-100" />
            <div className="h-3 w-56 rounded bg-ink-100" />
          </div>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border-2 border-ink-100 p-5 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-32 rounded bg-ink-100" />
              <div className="h-6 w-20 rounded-lg bg-ink-100" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-24 rounded-lg bg-ink-100" />
              <div className="h-6 w-20 rounded-lg bg-ink-100" />
              <div className="h-6 w-28 rounded-lg bg-ink-100" />
            </div>
          </div>
        ))}
        <div className="h-11 w-full rounded-xl bg-ink-100" />
      </div>
    </div>
  );
}

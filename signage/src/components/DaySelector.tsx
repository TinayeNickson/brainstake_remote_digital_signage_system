'use client';

import { DAY_NAMES } from '@/lib/format';

interface Props {
  value: number[];
  onChange: (v: number[]) => void;
}

export default function DaySelector({ value, onChange }: Props) {
  const set = new Set(value);
  function toggle(d: number) {
    if (set.has(d)) set.delete(d); else set.add(d);
    onChange(Array.from(set).sort());
  }
  return (
    <div className="flex gap-2 flex-wrap">
      {DAY_NAMES.map((name, i) => {
        const on = set.has(i);
        return (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={
              'h-10 px-4 rounded border text-sm transition ' +
              (on
                ? 'bg-ink-900 text-ink-50 border-ink-900'
                : 'bg-white border-ink-200 hover:border-ink-900')
            }
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

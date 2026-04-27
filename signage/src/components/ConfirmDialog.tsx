'use client';

import { useEffect, useRef } from 'react';

interface Props {
  title:    string;
  message?: string;
  confirm:  string;
  danger?:  boolean;
  onConfirm: () => void;
  onCancel:  () => void;
}

export default function ConfirmDialog({ title, message, confirm, danger = false, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="space-y-1.5">
          <h2 className="font-semibold text-[15px] text-ink-900">{title}</h2>
          {message && <p className="text-sm text-ink-900/60 leading-relaxed">{message}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="btn btn-ghost h-9 px-5 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`btn h-9 px-5 text-sm font-semibold ${
              danger
                ? 'bg-red-600 hover:bg-red-700 text-white border-0'
                : 'btn-primary'
            }`}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

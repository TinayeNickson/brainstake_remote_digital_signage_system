'use client';

import { useEffect, useState } from 'react';

interface Props {
  words: string[];
  intervalMs?: number;
  className?: string;
}

export default function RotatingWord({ words, intervalMs = 2400, className = '' }: Props) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeOut = setTimeout(() => setVisible(false), intervalMs - 450);
    const next    = setTimeout(() => {
      setIdx(i => (i + 1) % words.length);
      setVisible(true);
    }, intervalMs);
    return () => { clearTimeout(fadeOut); clearTimeout(next); };
  }, [idx, words.length, intervalMs]);

  return (
    <span
      className={`inline-block ${visible ? 'word-in' : 'word-out'} ${className}`}
    >
      {words[idx]}
    </span>
  );
}

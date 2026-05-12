import Link from 'next/link';
import { ReactNode } from 'react';

interface ButtonProps {
  href: string;
  variant: 'primary' | 'ghost' | 'dark';
  children: ReactNode;
  className?: string;
}

const variants = {
  primary:
    'bg-accent text-white hover:bg-accent-light hover:-translate-y-0.5 transition-all shadow-lg shadow-accent/20',
  ghost:
    'text-brand-paper/65 hover:text-brand-paper inline-flex items-center gap-2 transition-colors',
  dark:
    'bg-brand-navy text-accent hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-navy/30 transition-all',
};

export default function Button({ href, variant, children, className = '' }: ButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-block px-8 py-3.5 text-sm font-medium uppercase tracking-[0.12em] rounded-sm ${variants[variant]} ${className}`}
    >
      {children}
      {variant === 'ghost' && <span className="text-lg">→</span>}
    </Link>
  );
}

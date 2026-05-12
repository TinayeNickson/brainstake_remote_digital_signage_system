'use client';

import { useState, useEffect } from 'react';
import { NAV_LINKS } from '@/lib/constants';
import Link from 'next/link';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-brand-navy/95 backdrop-blur-sm shadow-lg shadow-accent/5'
          : 'bg-gradient-to-b from-brand-navy/95 to-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between py-5">
          {/* Logo */}
          <Link href="#" className="flex flex-col items-start select-none">
            <div className="font-display text-[1.75rem] tracking-[0.12em] leading-none">
              <span className="text-[#7b78c8] drop-shadow-[0_0_6px_rgba(123,120,200,0.5)]">RARE</span>
              <span
                className="relative inline-block text-[#c9a84c] drop-shadow-[0_0_6px_rgba(201,168,76,0.4)]"
                style={{ marginLeft: '0.15em' }}
              >
                <svg
                  className="absolute -top-[0.75em] left-[0.1em] w-[0.6em] h-[0.6em] drop-shadow-[0_0_4px_rgba(201,168,76,0.8)]"
                  viewBox="0 0 24 24"
                  fill="#e8c96a"
                >
                  <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" />
                </svg>
                VISION
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#f5f0e8]/40 font-sans font-medium mt-0.5">
              We follow the dream
            </span>
          </Link>

          {/* Desktop Links */}
          <ul className="hidden lg:flex items-center gap-10">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-xs font-medium uppercase tracking-[0.14em] text-brand-paper/75 hover:text-accent transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/login"
                className="text-xs font-medium uppercase tracking-[0.14em] text-brand-paper/60 hover:text-brand-paper transition-colors mr-4"
              >
                Sign In
              </Link>
            </li>
            <li>
              <Link
                href="/register"
                className="text-xs font-medium uppercase tracking-[0.14em] bg-accent text-white px-6 py-2.5 rounded-sm hover:bg-accent-light transition-colors"
              >
                Get Started
              </Link>
            </li>
          </ul>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden text-brand-paper p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="lg:hidden pb-6 animate-slide-down">
            <ul className="flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block text-sm uppercase tracking-[0.14em] text-brand-paper/75 hover:text-accent transition-colors py-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/register"
                  className="inline-block text-sm uppercase tracking-[0.14em] bg-accent text-white px-6 py-3 rounded-sm hover:bg-accent-light transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Get Started
                </Link>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}

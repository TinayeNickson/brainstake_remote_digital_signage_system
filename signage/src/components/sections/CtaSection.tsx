'use client';

import Link from 'next/link';

export default function CtaSection() {
  return (
    <section
      id="cta"
      className="py-32 px-6 lg:px-8 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #c9a84c 0%, #e8c96a 40%, #c9963a 100%)' }}
    >
      <div className="max-w-3xl mx-auto text-center relative">
        <h2
          className="font-display text-[clamp(2.8rem,6vw,6rem)] leading-[0.92] tracking-[0.02em] text-brand-navy mb-6"
          style={{ opacity: 0, animation: 'fadeSlideUp 0.7s ease-out 0.1s forwards' }}
        >
          READY TO OWN
          <br />THE STREETS?
        </h2>

        <p
          className="text-brand-navy/60 text-base leading-relaxed mb-12 max-w-md mx-auto font-light"
          style={{ opacity: 0, animation: 'fadeSlideUp 0.7s ease-out 0.25s forwards' }}
        >
          Let Rare Vision put your brand where all of Harare can see it. Get in
          touch today for a free campaign consultation.
        </p>

        <div style={{ opacity: 0, animation: 'fadeSlideUp 0.7s ease-out 0.4s forwards' }}>
          <Link
            href="/login"
            className="inline-block px-10 py-4 bg-brand-navy text-white text-sm font-medium uppercase tracking-[0.16em] rounded-sm hover:bg-[#12124a] transition-all hover:-translate-y-0.5 shadow-xl shadow-brand-navy/30"
          >
            Login or Sign Up
          </Link>
        </div>
      </div>
    </section>
  );
}

'use client';

import { INDUSTRIES } from '@/lib/constants';
import FadeUp from '@/components/ui/FadeUp';
import Image from 'next/image';

export default function Industries() {
  return (
    <section id="industries" className="relative py-28 px-6 lg:px-8 bg-brand-navy overflow-hidden">
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(108,59,170,0.18) 0%, transparent 65%)' }} />

      <div className="max-w-7xl mx-auto relative">
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-start">

          {/* Left — text + tags */}
          <div>
            <FadeUp>
              <div className="section-label">Who We Work With</div>
              <h2 className="font-display text-[clamp(3rem,6vw,6rem)] leading-[0.92] tracking-[0.02em] text-white mb-4">
                EVERY INDUSTRY
                <br />BENEFITS
              </h2>
              <p className="text-brand-paper/50 text-base font-light max-w-lg mb-10 leading-relaxed">
                From local retail to national brands, every type of business benefits from a powerful
                presence in Harare&apos;s streets.
              </p>
            </FadeUp>

            <FadeUp delay={0.2}>
              <div className="flex flex-wrap gap-3">
                {INDUSTRIES.map((industry) => (
                  <span
                    key={industry.label}
                    className="px-5 py-2 border border-white/20 rounded-full text-sm text-brand-paper/70 hover:border-gold/50 hover:text-brand-paper hover:bg-gold/5 transition-all cursor-default tracking-[0.02em]"
                  >
                    {industry.label}
                  </span>
                ))}
              </div>
            </FadeUp>
          </div>

          {/* Right — industries photo frame */}
          <FadeUp delay={0.3} className="hidden lg:flex flex-col items-end w-[320px] shrink-0 pt-4 gap-5">
            <div className="text-right">
              <p className="font-display text-2xl leading-tight text-white/80 tracking-[0.02em]">We Make Your</p>
              <p className="font-display text-3xl leading-tight text-gold tracking-[0.02em] font-bold">Brand Standout</p>
            </div>
            <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl group" style={{ height: '340px' }}>
              <div className="absolute -inset-1 bg-gold/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Image
                src="/images/industries.jpeg"
                alt="Industries we serve"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/70 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gold/80 font-medium">Serving every sector</p>
              </div>
            </div>
          </FadeUp>

        </div>
      </div>
    </section>
  );
}

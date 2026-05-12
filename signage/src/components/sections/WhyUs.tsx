'use client';

import { BENEFITS, IMPACT_METRICS } from '@/lib/constants';
import FadeUp from '@/components/ui/FadeUp';
import Image from 'next/image';

const BENEFIT_ICONS = [
  /* Massive Daily Reach — broadcast/signal waves */
  <svg key="reach" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10" />
    <path d="M5 12a7 7 0 0 1 7-7" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    <path d="M15 12a3 3 0 0 0-3-3" />
  </svg>,
  /* Always-On Visibility — eye */
  <svg key="visibility" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>,
  /* Instant Brand Credibility — shield check */
  <svg key="credibility" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M12 2l7 3v5c0 4.5-3 8.5-7 10C5 18.5 2 14.5 2 10V5l10-3z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>,
  /* Cost-Effective at Scale — trending up */
  <svg key="cost" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>,
];

const METRIC_WIDTHS = ['85%', '70%', '55%', '45%', '95%'];

export default function WhyUs() {
  return (
    <section id="why" className="py-28 px-6 lg:px-8 bg-brand-navy">
      <div className="max-w-7xl mx-auto">
        <FadeUp>
          <div className="section-label">Why Rare Vision</div>
          <h2 className="font-display text-[clamp(3rem,6.5vw,7rem)] leading-[0.92] tracking-[0.02em] text-white mb-16">
            HOW WE HELP
            <br />BUSINESSES FLOURISH
          </h2>
        </FadeUp>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-16 items-start">

          {/* Benefits List */}
          <div className="divide-y divide-gold/20 border-t border-gold/20">
            {BENEFITS.map((benefit, index) => (
              <FadeUp key={benefit.title} delay={index * 0.1}>
                <div className="grid grid-cols-[2.5rem_1fr] gap-5 py-7 hover:bg-gold/5 transition-colors px-2 group">
                  <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold flex-shrink-0 group-hover:bg-gold/20 transition-colors">
                    {BENEFIT_ICONS[index]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2 tracking-[0.01em]">
                      {benefit.title}
                    </h3>
                    <p className="text-white/55 leading-relaxed font-light text-sm">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>

          {/* Impact Card */}
          <FadeUp delay={0.3}>
            <div
              className="relative rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: 'linear-gradient(160deg, #12123a 0%, #0e0e30 60%, #080820 100%)' }}
            >
              {/* Background photo — subtle, darkened */}
              <div className="absolute inset-0 z-0">
                <Image
                  src="/images/campaign-impact.jpg"
                  alt=""
                  fill
                  className="object-cover opacity-10"
                  aria-hidden
                />
              </div>
              {/* Gold glow top-right */}
              <div className="absolute inset-0 pointer-events-none z-[1]"
                style={{ background: 'radial-gradient(ellipse at 90% 0%, rgba(201,168,76,0.18) 0%, transparent 55%)' }} />

              {/* Header strip */}
              <div className="relative z-10 px-8 pt-8 pb-6 border-b border-gold/15 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-gold/60 font-medium">Performance Data</p>
                  <h3 className="font-display text-base tracking-[0.08em] text-gold leading-tight">TYPICAL CAMPAIGN IMPACT</h3>
                </div>
              </div>

              {/* Metrics with progress bars */}
              <div className="relative z-10 px-8 py-6 space-y-6">
                {IMPACT_METRICS.map((metric, i) => (
                  <div key={metric.label}>
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-xs uppercase tracking-[0.12em] text-white/50 font-medium">
                        {metric.label}
                      </span>
                      <span className="font-display text-2xl text-white leading-none tracking-[0.03em]">
                        {metric.value}
                        <span className="text-base text-gold ml-0.5">{metric.suffix}</span>
                      </span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: METRIC_WIDTHS[i],
                          background: 'linear-gradient(90deg, #c9a84c, #e8c96a)',
                          animation: `expandWidth 1.2s ease-out ${i * 0.15 + 0.5}s both`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer note */}
              <div className="relative z-10 px-8 pb-8">
                <div className="flex items-start gap-2 pt-5 border-t border-gold/10">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-60">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-xs text-white/35 leading-relaxed">
                    Based on Rare Vision campaign performance data across the Harare billboard network.
                  </p>
                </div>
              </div>

              {/* Decorative bar chart bottom-right */}
              <div className="absolute bottom-0 right-0 opacity-[0.06] flex items-end gap-1.5 pr-6 pb-0 pointer-events-none">
                {[30,50,20,70,45,85,35,60,90,40].map((h, i) => (
                  <div key={i} className="w-2.5 bg-gold rounded-t-sm" style={{ height: `${h}px` }} />
                ))}
              </div>
            </div>
          </FadeUp>

        </div>
      </div>
    </section>
  );
}

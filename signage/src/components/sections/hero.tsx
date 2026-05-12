'use client';

import { useState, useEffect } from 'react';
import { HERO_STATS } from '@/lib/constants';
import Billboard from '@/components/ui/Billboard';
import FadeUp from '@/components/ui/FadeUp';

const BILLBOARD_IMAGES = [
  '/images/slogan1.jpeg',
  '/images/slogan2.jpeg',
  '/images/slogan3.jpeg',
  '/images/slogan4.jpeg',
  '/images/slogan5.jpeg',
];

export default function Hero() {
  const [sloganIndex, setSloganIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % BILLBOARD_IMAGES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const currentImage = BILLBOARD_IMAGES[sloganIndex];

  return (
    <section id="home" className="relative min-h-screen flex items-center overflow-hidden">
      {/* Split background — 70% navy, 30% gold */}
      <div className="absolute inset-0 flex">
        <div className="w-[70%] bg-brand-navy" />
        <div className="w-[30%] bg-amber-500" />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-grid-lines bg-grid-size opacity-20" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 items-center pt-32 pb-16">

          {/* Left Column */}
          <div className="flex flex-col">

            <FadeUp>
              <div className="inline-flex items-center gap-3 text-xs font-medium uppercase tracking-[0.22em] text-amber-400 mb-8">
                <span className="w-8 h-px bg-amber-400 flex-shrink-0" />
                Harare&apos;s Premier Outdoor Advertising
              </div>
            </FadeUp>

            <FadeUp delay={0.15}>
              <h1 className="font-display text-[clamp(3.5rem,6vw,6.5rem)] leading-[0.9] tracking-[0.01em] mb-8">
                <span className="italic text-[0.52em] text-amber-400/70 block mb-2 font-normal tracking-[0.03em]">
                  Make your brand
                </span>
                <span className="text-white block">IMPOSSIBLE</span>
                <span className="text-amber-400 block">TO IGNORE.</span>
              </h1>
            </FadeUp>

            <FadeUp delay={0.3}>
              <p className="text-purple-200/70 leading-relaxed mb-12 text-base font-light max-w-sm">
                Rare Vision connects your business to thousands of Harare&apos;s consumers
                every single day through high-impact digital billboard advertising — in
                the right places, at the right moments.
              </p>
            </FadeUp>

            {/* Stats */}
            <FadeUp delay={0.5}>
              <div className="flex flex-wrap gap-10 pb-4">
                {HERO_STATS.map((stat) => (
                  <div key={stat.label}>
                    <div className="font-display text-4xl sm:text-5xl text-amber-400 leading-none tracking-[0.02em]">
                      {stat.number}
                    </div>
                    <div className="text-xs uppercase tracking-[0.16em] text-purple-200/50 mt-2">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </FadeUp>

          </div>

          {/* Right Column — larger billboard, vertically centred */}
          <div className="hidden lg:flex justify-center items-center">
            <Billboard image={currentImage} />
          </div>

        </div>
      </div>
    </section>
  );
}

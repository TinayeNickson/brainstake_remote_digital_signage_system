'use client';

import FadeUp from '@/components/ui/FadeUp';
import Image from 'next/image';

export default function About() {
  return (
    <section id="about" className="py-28 px-6 lg:px-8 bg-brand-navy">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div>
            <FadeUp>
              <div className="section-label">Who We Are</div>
              <h2 className="font-display text-[clamp(3.5rem,6vw,6.5rem)] leading-[0.92] tracking-[0.02em] mb-8 text-white">
                HARARE&apos;S
                <br />OUTDOOR
                <br />ADVERTISING
                <br />EXPERTS
              </h2>
            </FadeUp>

            <FadeUp delay={0.15}>
              <div className="space-y-5 text-brand-paper/55 leading-relaxed font-light max-w-lg">
                <p>
                  Rare Vision is Harare&apos;s leading outdoor advertising company, specialising in{' '}
                  <strong className="text-gold font-semibold">state-of-the-art digital billboard solutions</strong>{' '}
                  that put your brand in front of the city&apos;s most active consumers every single day. Founded with the
                  belief that every business deserves a powerful presence in the city, we&apos;ve built a network of{' '}
                  <strong className="text-gold font-semibold">strategically positioned digital displays</strong> across Harare&apos;s
                  busiest corridors from the CBD to major arterial roads, shopping centres, and high-footfall commercial zones.
                  We don&apos;t just sell advertising space — we craft{' '}
                  <strong className="text-gold font-semibold">full-visibility campaigns</strong> that amplify brand recognition,
                  drive foot traffic, and convert passers-by into paying customers.
                </p>
              </div>
            </FadeUp>
          </div>

          {/* Map Image */}
          <FadeUp delay={0.3}>
            <div className="relative group">
              {/* Gold glow on hover */}
              <div className="absolute -inset-2 bg-gold/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative rounded-lg overflow-hidden shadow-2xl">
                {/* Gold overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-tr from-gold/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />

                {/* Fade edges */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-brand-navy to-transparent z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-brand-navy z-10 pointer-events-none" />
                <div className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-brand-navy to-transparent z-10 pointer-events-none" />
                <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-brand-navy to-transparent z-10 pointer-events-none" />

                <Image
                  src="/images/map visual.jpeg"
                  alt="Rare Vision Billboard Network Map - Harare"
                  width={700}
                  height={600}
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                  priority
                />
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

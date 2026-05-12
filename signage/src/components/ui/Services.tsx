'use client';

import { SERVICES } from '@/lib/constants';
import FadeUp from '@/components/ui/FadeUp';
import Image from 'next/image';

const SERVICE_IMAGES: Record<string, string> = {
  'LED Digital Billboards': '/images/LEDDigitalBillboards.jpeg',
  'CBD & Retail Screens':   '/images/CBD&RetailScreens.jpeg',
  'Targeted Campaign Slots':'/images/TargetedCampaignSlots.jpeg',
  'Creative Design Support':'/images/CreativeDesignSupport.jpeg',
  'Campaign Reporting':     '/images/CampaignReporting.jpeg',
};

export default function Services() {
  return (
    <section id="services" className="py-28 px-6 lg:px-8 bg-brand-darker">
      <div className="max-w-7xl mx-auto">

        {/* Header row */}
        <FadeUp>
          <div className="mb-16">
            <div className="section-label">What We Offer</div>
            <h2 className="font-display text-[clamp(2.5rem,5vw,5rem)] leading-[0.92] tracking-[0.02em] text-white">
              DIGITAL BILLBOARD SOLUTIONS
            </h2>
          </div>
        </FadeUp>

        {/* Top row — 3 cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10 mb-10">
          {SERVICES.slice(0, 3).map((service, index) => (
            <div
              key={service.title}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/5 hover:border-gold/30 transition-colors duration-300"
              style={{
                opacity: 0,
                animation: `fadeSlideUp 0.6s ease-out ${index * 0.1}s forwards`,
              }}
            >
              <div className="relative w-full h-52 overflow-hidden rounded-t-2xl flex-shrink-0">
                <Image
                  src={SERVICE_IMAGES[service.title] ?? '/images/LEDDigitalBillboards.jpeg'}
                  alt={service.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-brand-navy/30 pointer-events-none" />
              </div>
              <div className="flex flex-col flex-1 p-6">
                <h3 className="font-display text-xl tracking-[0.04em] text-gold mb-3 leading-tight">
                  {service.title}
                </h3>
                <p className="text-brand-paper/55 leading-relaxed font-light text-sm">
                  {service.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row — 2 larger cards, centred to align under top 3 */}
        <div className="grid sm:grid-cols-2 gap-10 lg:w-[calc(66.666%+2.5rem)] lg:mx-auto">
          {SERVICES.slice(3).map((service, index) => (
            <div
              key={service.title}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/5 hover:border-gold/30 transition-colors duration-300"
              style={{
                opacity: 0,
                animation: `fadeSlideUp 0.6s ease-out ${(index + 3) * 0.1}s forwards`,
              }}
            >
              <div className="relative w-full h-72 overflow-hidden rounded-t-2xl flex-shrink-0">
                <Image
                  src={SERVICE_IMAGES[service.title] ?? '/images/LEDDigitalBillboards.jpeg'}
                  alt={service.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-brand-navy/30 pointer-events-none" />
              </div>
              <div className="flex flex-col flex-1 p-8">
                <h3 className="font-display text-2xl tracking-[0.04em] text-gold mb-4 leading-tight">
                  {service.title}
                </h3>
                <p className="text-brand-paper/55 leading-relaxed font-light text-sm">
                  {service.description}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

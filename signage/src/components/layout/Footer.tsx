import Link from 'next/link';

const SERVICE_LINKS = [
  'LED Digital Billboards',
  'Roadside Spectaculars',
  'CBD Screens',
  'Campaign Slots',
  'Creative Design',
];

const COMPANY_LINKS = [
  { label: 'About Us', href: '#about' },
  { label: 'Why Us', href: '#why' },
];

export default function Footer() {
  return (
    <footer className="relative" style={{ background: '#0B0B2B' }}>
      {/* Gold-to-navy gradient bridge from CTA section */}
      <div
        className="absolute top-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, #c9963a 0%, #0B0B2B 100%)' }}
      />
      <div className="max-w-7xl mx-auto relative z-10 px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-10 pb-12 border-b border-white/5 pt-24">
          {/* Brand */}
          <div>
            <div className="font-display text-3xl tracking-[0.1em] leading-none mb-1">
              <span className="text-[#7b78c8]">RARE</span>
              <span className="relative inline-block text-[#c9a84c]" style={{ marginLeft: '0.15em' }}>
                <svg
                  className="absolute -top-[0.75em] left-[0.1em] w-[0.6em] h-[0.6em]"
                  viewBox="0 0 24 24"
                  fill="#e8c96a"
                >
                  <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" />
                </svg>
                VISION
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-brand-paper/30 font-sans font-medium mb-4">
              We follow the dream
            </div>
            <p className="text-brand-paper/35 leading-relaxed font-light max-w-[240px]">
              Harare&apos;s premier digital billboard advertising company — putting
              your brand where it belongs: in front of the city.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-gold font-medium mb-5">
              Services
            </h4>
            <ul className="space-y-3">
              {SERVICE_LINKS.map((link) => (
                <li key={link}>
                  <Link
                    href="#services"
                    className="text-brand-paper/45 hover:text-brand-paper transition-colors text-sm"
                  >
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-gold font-medium mb-5">
              Company
            </h4>
            <ul className="space-y-3">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-brand-paper/45 hover:text-brand-paper transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div id="contact-info">
            <h4 className="text-xs uppercase tracking-[0.2em] text-gold font-medium mb-5">
              Contact
            </h4>
            <ul className="space-y-3 text-brand-paper/45 text-sm">
              <li>+263 78 000 0000</li>
              <li>hello@rarevision.co.zw</li>
              <li>Harare CBD, Zimbabwe</li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 pb-6 text-xs text-brand-paper/25">
          <span>© 2026 Rare Vision Advertising. All rights reserved.</span>
          <span>
            Harare, Zimbabwe{' '}
            <span className="text-brand-paper/15 mx-2">·</span>{' '}
            <Link href="/privacy" className="text-accent hover:text-accent-light transition-colors">
              Privacy
            </Link>
            {' '}
            <span className="text-brand-paper/15 mx-2">·</span>{' '}
            <Link href="/login" className="text-accent hover:text-accent-light transition-colors">
              Sign In
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

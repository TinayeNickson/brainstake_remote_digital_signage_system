import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import Navbar from '@/components/layout/Navbar';
import Hero from '@/components/sections/hero';
import Ticker from '@/components/layout/ticker';
import About from '@/components/sections/about';
import Services from '@/components/ui/Services';
import WhyUs from '@/components/sections/WhyUs';
import Industries from '@/components/sections/Industries';
import CtaSection from '@/components/sections/CtaSection';
import Footer from '@/components/layout/Footer';

export default async function Home() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <main className="bg-brand-navy">
      <Navbar />
      <Hero />
      <Ticker />
      <About />
      <Services />
      <WhyUs />
      <Industries />
      <CtaSection />
      <Footer />
    </main>
  );
}

function _LandingPageArchive() {
  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--brand-navy)' }}>

      {/* ── NAV ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-md" style={{ background: 'rgba(11,11,43,0.85)' }}>
        <div className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A84C, #6C3BAA)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <span className="font-bold text-[15px] tracking-widest uppercase text-brand-paper">RereVision</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {['How it works', 'Features', 'Pricing'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                className="text-sm text-brand-paper/50 hover:text-gold transition-colors font-medium tracking-wide">
                {item}
              </a>
            ))}
          </nav>

          <div className="flex gap-3">
            <Link href="/login" className="text-sm text-brand-paper/60 hover:text-brand-paper transition-colors font-medium px-4 py-2">
              Sign in
            </Link>
            <Link href="/register" className="btn-gold text-xs py-2.5 px-5">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(108,59,170,0.25) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)' }} />
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none bg-screens-grid opacity-30" />

        <div className="relative max-w-6xl mx-auto px-6 py-28 lg:py-40 grid lg:grid-cols-2 gap-20 items-center">
          <div>
            {/* Live badge */}
            <div className="inline-flex items-center gap-2.5 border border-gold/30 rounded-full px-4 py-2 mb-10"
              style={{ background: 'rgba(201,168,76,0.08)' }}>
              <span className="pulse-dot" />
              <span className="mono text-[10px] tracking-[0.25em] uppercase text-gold">Live across Zimbabwe</span>
            </div>

            <h1 className="font-display font-bold leading-[0.95] tracking-tight mb-8"
              style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)' }}>
              <span className="text-brand-paper">Your brand on</span><br />
              <span className="text-gradient-gold">every screen,</span><br />
              <span className="text-brand-paper">every day.</span>
            </h1>

            <p className="text-brand-paper/55 text-lg leading-relaxed mb-12 max-w-lg">
              RereVision connects businesses with high-traffic digital screens
              across the city. Book a spot, upload your creative, pay securely —
              and watch your ad go live within 24 hours.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/register" className="btn-gold">
                Start advertising
              </Link>
              <Link href="/login"
                className="font-semibold px-8 py-3.5 rounded-sm uppercase tracking-[0.12em] text-sm border border-brand-paper/20 text-brand-paper/70 hover:border-gold/40 hover:text-brand-paper transition-all">
                Sign in
              </Link>
            </div>
            <p className="text-brand-paper/25 text-xs mt-5 mono tracking-wider">
              No setup fee · Pay per campaign · Cancel anytime
            </p>
          </div>

          {/* Screen tiles */}
          <div className="hidden lg:grid grid-cols-2 gap-4">
            {[
              { label: 'Rezende Bus Terminus', slots: 12 },
              { label: 'Joina City Mall',      slots: 8  },
              { label: 'Avondale Shopping',    slots: 10 },
              { label: 'CBD — Bank Street',    slots: 15 },
            ].map((s, i) => (
              <div key={s.label}
                className="tile-live card-premium p-5 flex flex-col justify-between min-h-[150px] glow-border-premium"
                style={{ animationDelay: `${i * 0.4}s` }}>
                <div className="flex items-center justify-between">
                  <div className="w-2 h-2 rounded-full bg-gold" />
                  <span className="mono text-[9px] tracking-[0.2em] text-gold/70 uppercase">LIVE</span>
                </div>
                <div>
                  <div className="w-full h-1.5 rounded mb-1.5" style={{ background: 'rgba(201,168,76,0.15)' }} />
                  <div className="w-3/4 h-1.5 rounded mb-5" style={{ background: 'rgba(201,168,76,0.1)' }} />
                  <p className="text-brand-paper/50 text-[11px] mono">{s.label}</p>
                  <p className="text-gold/60 text-[10px] mono mt-0.5">{s.slots} slots/day</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '50+',  label: 'Active screens'   },
              { value: '200+', label: 'Campaigns run'    },
              { value: '24h',  label: 'Avg. go-live time'},
              { value: '98%',  label: 'Uptime'           },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="font-bold text-3xl text-gradient-gold">{s.value}</div>
                <div className="text-brand-paper/35 text-xs mono mt-2 uppercase tracking-[0.15em]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 px-6 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(108,59,170,0.04), transparent)' }} />
        <div className="max-w-6xl mx-auto w-full relative">
          <div className="text-center mb-20">
            <span className="section-label">How it works</span>
            <h2 className="font-bold text-[clamp(2rem,4vw,3.5rem)] leading-tight tracking-tight text-brand-paper mt-2">
              From upload to live in <span className="text-gradient-gold">4 steps</span>
            </h2>
            <p className="text-brand-paper/45 mt-4 max-w-xl mx-auto text-lg">
              No agency. No lengthy contracts. You control your entire campaign from one dashboard.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                num: '01', title: 'Upload your creative',
                body: 'Upload an image or short video (10s–60s). We accept JPG, PNG, MP4 and more.',
                icon: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>,
                icon2: <><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
              },
              {
                num: '02', title: 'Choose your screens',
                body: 'Pick from high-traffic locations. Set dates, days of week, and slots per day.',
                icon: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
                icon2: null,
              },
              {
                num: '03', title: 'Pay securely',
                body: 'Pay via EcoCash, OneMoney, or bank transfer. We verify and approve within 24 hours.',
                icon: <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></>,
                icon2: null,
              },
              {
                num: '04', title: 'Go live',
                body: 'Your ad plays on selected screens. Track your campaign from the dashboard anytime.',
                icon: <polygon points="5 3 19 12 5 21 5 3"/>,
                icon2: null,
              },
            ].map(step => (
              <div key={step.num} className="card-premium p-6 flex flex-col gap-5 transition-all duration-300 hover:glow-border-gold">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-sm flex items-center justify-center"
                    style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round">
                      {step.icon}{step.icon2}
                    </svg>
                  </div>
                  <span className="mono text-[11px] text-brand-paper/20 font-medium">{step.num}</span>
                </div>
                <div>
                  <h3 className="font-bold text-[15px] text-brand-paper mb-2">{step.title}</h3>
                  <p className="text-sm text-brand-paper/45 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section id="features" className="py-28 px-6 border-y border-white/5"
        style={{ background: 'rgba(108,59,170,0.04)' }}>
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center mb-20">
            <span className="section-label">Features</span>
            <h2 className="font-bold text-[clamp(2rem,4vw,3.5rem)] leading-tight tracking-tight text-brand-paper mt-2">
              Everything you need to <span className="text-gradient-premium">advertise smarter</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Multi-location campaigns',
                body:  'Reach more people by booking multiple screens in a single campaign — one budget, one schedule, one payment.',
                icon:  <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
              },
              {
                title: 'Flexible scheduling',
                body:  'Run ads only on specific days of the week — peak weekday traffic or weekend shoppers. You choose.',
                icon:  <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
              },
              {
                title: 'Verified payment proofs',
                body:  'Upload your payment screenshot. Our accountants verify it manually — no fake approvals, full audit trail.',
                icon:  <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
              },
              {
                title: 'Instant PDF receipts',
                body:  'Every approved campaign generates a professional receipt downloadable as a PDF for your records.',
                icon:  <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
              },
              {
                title: 'Real-time screen player',
                body:  'Screens run a live player that polls for new ads. Changes reflect within minutes — no manual reboot.',
                icon:  <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
              },
              {
                title: 'Emergency broadcast',
                body:  'Admins can override all screens instantly with an emergency message or alert — activated in one click.',
                icon:  <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
              },
            ].map(f => (
              <div key={f.title} className="card-premium p-6 flex gap-4 group transition-all duration-300">
                <div className="w-10 h-10 rounded-sm flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 group-hover:scale-110"
                  style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.15)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round">
                    {f.icon}
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-[15px] text-brand-paper mb-2">{f.title}</h3>
                  <p className="text-sm text-brand-paper/45 leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY REREVISION ───────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <span className="section-label">Why RereVision</span>
              <h2 className="font-bold text-[clamp(2rem,4vw,3.2rem)] leading-tight tracking-tight text-brand-paper mt-2 mb-8">
                Advertising that works<br />
                <span className="text-gradient-gold">for businesses of all sizes</span>
              </h2>
              <p className="text-brand-paper/50 leading-relaxed mb-10 text-lg">
                Whether you&apos;re a local shop promoting a sale, a restaurant filling
                seats, or a brand launching a city-wide campaign — RereVision gives
                you professional-grade digital advertising without the agency price tag.
              </p>
              <ul className="space-y-5">
                {[
                  'Book directly — no middlemen, no lengthy proposals',
                  'Transparent pricing per slot, per day, per location',
                  'Ads reviewed and approved by a real person, not a bot',
                  'Full campaign history and receipts in your dashboard',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <span className="text-brand-paper/60 text-[15px]">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-12">
                <Link href="/register" className="btn-gold">
                  Start your first campaign
                </Link>
              </div>
            </div>

            {/* Testimonial cards */}
            <div className="space-y-5">
              <div className="card-premium p-8 glow-border-gold" style={{ borderLeft: '3px solid #C9A84C' }}>
                <p className="text-[15px] leading-relaxed text-brand-paper/70 mb-6">
                  &ldquo;We ran a 2-week campaign across 3 locations for our grand opening.
                  The booking took 10 minutes, payment confirmed the same day,
                  and our banner was live the next morning. Incredible value.&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-brand-navy text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #E8C96A)' }}>TN</div>
                  <div>
                    <p className="text-sm font-semibold text-brand-paper">Tinashe Ncube</p>
                    <p className="text-xs text-brand-paper/40">Owner, Ncube Electronics — Harare</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="card-premium p-6 text-center">
                  <div className="font-bold text-3xl text-gradient-gold">3×</div>
                  <div className="text-xs text-brand-paper/40 mt-2 leading-relaxed">Average footfall increase<br/>reported by advertisers</div>
                </div>
                <div className="card-premium p-6 text-center">
                  <div className="font-bold text-3xl text-gradient-gold">&lt;24h</div>
                  <div className="text-xs text-brand-paper/40 mt-2 leading-relaxed">From payment to<br/>ad going live</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.04), rgba(108,59,170,0.06))' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[1px] pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)' }} />

        <div className="max-w-4xl mx-auto text-center relative">
          <span className="section-label">Simple pricing</span>
          <h2 className="font-bold text-[clamp(2rem,4vw,3.5rem)] leading-tight tracking-tight text-brand-paper mt-2 mb-6">
            Pay only for the slots<br /><span className="text-gradient-premium">you actually book</span>
          </h2>
          <p className="text-brand-paper/45 text-lg mb-16 max-w-xl mx-auto">
            No monthly subscriptions. No hidden fees. You choose the location,
            duration, and number of daily plays — and pay exactly that.
          </p>

          <div className="grid sm:grid-cols-3 gap-5 mb-14">
            {[
              { label: 'Starter',  desc: 'Single location · 10–15s slot', note: 'Great for local shops', featured: false },
              { label: 'Standard', desc: 'Multi-location · 30s slot',      note: 'Most popular',         featured: true  },
              { label: 'Pro',      desc: 'City-wide · 60s premium slot',   note: 'Full city reach',      featured: false },
            ].map((p) => (
              <div key={p.label}
                className={`card-premium p-7 text-left transition-all duration-300 ${p.featured ? 'glow-border-gold' : ''}`}
                style={p.featured ? { borderColor: 'rgba(201,168,76,0.5)' } : {}}>
                {p.featured && (
                  <div className="mono text-[9px] tracking-[0.2em] uppercase text-gold mb-3 font-medium">
                    ✦ {p.note}
                  </div>
                )}
                <h3 className={`font-bold text-xl mb-2 ${p.featured ? 'text-gradient-gold' : 'text-brand-paper'}`}>
                  {p.label}
                </h3>
                <p className="text-brand-paper/45 text-sm leading-relaxed">{p.desc}</p>
                {!p.featured && <p className="text-brand-paper/25 text-[11px] mt-4 mono">{p.note}</p>}
              </div>
            ))}
          </div>

          <Link href="/register" className="btn-gold inline-flex items-center gap-2">
            Create a free account
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </Link>
          <p className="text-brand-paper/25 text-xs mt-5 mono tracking-wider">
            Free to register · Only pay when you book
          </p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-6 py-10"
        style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #6C3BAA)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm tracking-widest uppercase text-brand-paper">RereVision</p>
              <p className="text-[11px] text-brand-paper/30 mono">Digital Signage Platform</p>
            </div>
          </div>

          <div className="flex gap-8">
            <Link href="/login"    className="text-sm text-brand-paper/40 hover:text-gold transition-colors">Sign in</Link>
            <Link href="/register" className="text-sm text-brand-paper/40 hover:text-gold transition-colors">Register</Link>
            <Link href="/privacy"  className="text-sm text-brand-paper/40 hover:text-gold transition-colors">Privacy</Link>
            <Link href="/terms"    className="text-sm text-brand-paper/40 hover:text-gold transition-colors">Terms</Link>
          </div>

          <p className="mono text-[11px] text-brand-paper/25">
            &copy; {new Date().getFullYear()} RereVision. All rights reserved.
          </p>
        </div>
      </footer>

    </main>
  );
}

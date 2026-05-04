import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase-server';

export default async function Home() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');
  redirect('/login');
}

function _unused() {
  return (
    <main className="min-h-screen flex flex-col bg-[#f6f4ef]">

      {/* ── NAV ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#f6f4ef]/90 backdrop-blur-sm border-b border-[#ebe7dd]">
        <div className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="RAREVISION" width={56} height={56} className="object-contain" />
            <span className="font-bold text-[15px] tracking-tight text-[#1a1a17]">RAREVISION</span>
          </div>
          <nav className="hidden md:flex items-center gap-7">
            <a href="#how" className="text-sm text-[#1a1a17]/60 hover:text-[#0f7b4a] transition-colors font-medium">How it works</a>
            <a href="#features" className="text-sm text-[#1a1a17]/60 hover:text-[#0f7b4a] transition-colors font-medium">Features</a>
            <a href="#pricing" className="text-sm text-[#1a1a17]/60 hover:text-[#0f7b4a] transition-colors font-medium">Pricing</a>
          </nav>
          <div className="flex gap-2.5">
            <Link href="/login" className="btn btn-ghost text-sm h-9 px-4">Sign in</Link>
            <Link href="/register" className="btn btn-primary text-sm h-9 px-4">Get started</Link>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0a2e1f] text-white">
        {/* Grid background */}
        <div className="absolute inset-0 bg-screens-grid pointer-events-none" />
        {/* Glow */}
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-[#0f7b4a]/20 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-[#0f7b4a]/10 blur-[100px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#0f7b4a]/20 border border-[#0f7b4a]/40 rounded-full px-4 py-1.5 mb-8">
              <span className="pulse-dot" />
              <span className="mono text-[11px] tracking-widest uppercase text-[#22c55e]">Live on screens across Zimbabwe</span>
            </div>
            <h1 className="display text-[56px] lg:text-[68px] leading-[1.0] mb-6 text-white">
              Your brand on<br />
              <span className="text-[#22c55e]">every screen,</span><br />
              every day.
            </h1>
            <p className="text-white/70 text-lg leading-relaxed mb-10 max-w-lg">
              RAREVISION connects businesses with high-traffic digital screens across
              the city. Book a spot, upload your creative, pay securely — and watch
              your ad go live within 24 hours.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-primary h-12 px-7 text-[15px] font-semibold">
                Book your screen now
              </Link>
              <Link href="/login" className="btn h-12 px-7 text-[15px] font-medium bg-white/10 text-white border-white/20 hover:bg-white/20 transition-colors">
                Sign in
              </Link>
            </div>
            <p className="text-white/40 text-xs mt-4 mono">No setup fee · Pay per campaign · Cancel anytime</p>
          </div>

          {/* Mock screen tiles */}
          <div className="hidden lg:grid grid-cols-2 gap-4">
            {[
              { label: 'Rezende Bus Terminus', status: 'LIVE', color: 'bg-[#22c55e]', delay: '0s' },
              { label: 'Joina City Mall',       status: 'LIVE', color: 'bg-[#22c55e]', delay: '0.4s' },
              { label: 'Avondale Shopping',     status: 'LIVE', color: 'bg-[#22c55e]', delay: '0.8s' },
              { label: 'CBD — Bank Street',     status: 'LIVE', color: 'bg-[#22c55e]', delay: '1.2s' },
            ].map((s) => (
              <div key={s.label}
                className="tile-live bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between min-h-[140px]"
                style={{ animationDelay: s.delay }}>
                <div className="flex items-center justify-between">
                  <div className={`w-2 h-2 rounded-full ${s.color}`} />
                  <span className="mono text-[9px] tracking-widest text-white/40 uppercase">{s.status}</span>
                </div>
                <div>
                  <div className="w-full h-2 bg-white/10 rounded mb-1.5" />
                  <div className="w-3/4 h-2 bg-white/10 rounded mb-4" />
                  <p className="text-white/60 text-[11px] mono">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '50+',  label: 'Active screens' },
              { value: '200+', label: 'Campaigns run' },
              { value: '24h',  label: 'Avg. go-live time' },
              { value: '98%',  label: 'Uptime' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="display text-3xl font-extrabold text-white">{s.value}</div>
                <div className="text-white/50 text-xs mono mt-1 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section id="how" className="py-24 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <span className="section-label">How it works</span>
          <h2 className="display text-4xl text-[#1a1a17] mt-2">From upload to live in 4 steps</h2>
          <p className="text-[#1a1a17]/60 mt-3 max-w-xl mx-auto">
            No agency. No lengthy contracts. You control your campaign entirely from one dashboard.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              num: '01', title: 'Upload your creative',
              body: 'Upload an image or short video (15s / 30s). Our system accepts JPG, PNG, MP4 and more.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              ),
            },
            {
              num: '02', title: 'Choose your screens',
              body: 'Pick from high-traffic locations. Set the dates, days of week, and how many slots per day.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              ),
            },
            {
              num: '03', title: 'Pay securely',
              body: 'Pay via EcoCash, OneMoney, or bank transfer. Upload your proof — we verify and approve within 24 hours.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ),
            },
            {
              num: '04', title: 'Go live',
              body: 'Your ad starts playing on the selected screens. Track your campaign from your dashboard anytime.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              ),
            },
          ].map(step => (
            <div key={step.num} className="paper p-6 flex flex-col gap-4 card-hover">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-[#d9ecde] flex items-center justify-center text-[#0f7b4a]">
                  {step.icon}
                </div>
                <span className="mono text-[11px] text-[#1a1a17]/30 font-medium">{step.num}</span>
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-[#1a1a17] mb-1">{step.title}</h3>
                <p className="text-sm text-[#1a1a17]/60 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-white border-y border-[#ebe7dd]">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center mb-16">
            <span className="section-label">Features</span>
            <div className="font-bold tracking-tight">
              <span className="text-2xl"><span className="text-[#2d2a6e]">RARE</span><span className="text-[#f5a623]">VISION</span></span>
            </div>
            <h2 className="display text-4xl text-[#1a1a17] mt-2">Everything you need to advertise smarter</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: 'Multi-location campaigns',
                body: 'Reach more people by booking multiple screens in a single campaign. Set one budget, one schedule, one payment.',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
              },
              {
                title: 'Flexible scheduling',
                body: 'Run ads only on specific days of the week — peak weekday traffic or weekend shoppers. You choose.',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
              },
              {
                title: 'Verified payment proofs',
                body: 'Upload your payment screenshot. Our accountants verify it manually — no fake approvals, full audit trail.',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
              },
              {
                title: 'Instant PDF receipts',
                body: 'Every approved campaign generates a professional receipt — downloadable as a PDF for your records.',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
              },
              {
                title: 'Real-time screen player',
                body: 'Screens run a live browser-based player that polls for new ads. Changes reflect within minutes — no manual reboot.',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
              },
              {
                title: 'Emergency broadcast',
                body: 'Admins can override all screens instantly with an emergency message or alert — activated in one click.',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
              },
            ].map(f => (
              <div key={f.title} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#d9ecde] flex items-center justify-center text-[#0f7b4a] shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-bold text-[15px] text-[#1a1a17] mb-1">{f.title}</h3>
                  <p className="text-sm text-[#1a1a17]/60 leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY RAREVISION ───────────────────────────────────────── */}
      <section className="py-24 px-6 max-w-6xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="section-label">Why RAREVISION</span>
            <h2 className="display text-4xl text-[#1a1a17] mt-2 mb-6">
              Advertising that works<br />for businesses of all sizes
            </h2>
            <p className="text-[#1a1a17]/70 leading-relaxed mb-8">
              Whether you&apos;re a local shop promoting a sale, a restaurant filling
              seats during slow hours, or a brand launching a city-wide campaign —
              RAREVISION gives you professional-grade digital advertising without
              the agency price tag.
            </p>
            <ul className="space-y-4">
              {[
                'Book directly — no middlemen, no lengthy proposals',
                'Transparent pricing per slot, per day, per location',
                'Ads reviewed and approved by a real person, not a bot',
                'Full campaign history and receipts in your dashboard',
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f7b4a" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="text-sm text-[#1a1a17]/70">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <Link href="/register" className="btn btn-primary h-11 px-6 text-sm font-semibold">
                Start your first campaign
              </Link>
            </div>
          </div>

          {/* Testimonial / trust card */}
          <div className="space-y-4">
            <div className="paper p-7 border-l-4 border-[#0f7b4a]">
              <p className="text-[15px] leading-relaxed text-[#1a1a17]/80 mb-5">
                &ldquo;We ran a 2-week campaign across 3 locations for our grand opening.
                The booking took 10 minutes, payment was confirmed the same day,
                and our banner was live the next morning. Incredible value.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#0a2e1f] flex items-center justify-center text-white text-xs font-bold">TN</div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1a17]">Tinashe Ncube</p>
                  <p className="text-xs text-[#1a1a17]/50">Owner, Ncube Electronics — Harare</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="paper p-5 text-center">
                <div className="display text-3xl font-extrabold text-[#0f7b4a]">3×</div>
                <div className="text-xs text-[#1a1a17]/60 mt-1">Average footfall increase<br/>reported by advertisers</div>
              </div>
              <div className="paper p-5 text-center">
                <div className="display text-3xl font-extrabold text-[#0f7b4a]">&lt; 24h</div>
                <div className="text-xs text-[#1a1a17]/60 mt-1">From payment to<br/>ad going live</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING CTA ──────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-[#0a2e1f] text-white">
        <div className="max-w-3xl mx-auto text-center">
          <span className="mono text-[11px] tracking-widest uppercase text-[#22c55e] block mb-4">Simple pricing</span>
          <h2 className="display text-4xl lg:text-5xl text-white mb-6">
            Pay only for the slots<br />you actually book
          </h2>
          <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto">
            No monthly subscriptions. No hidden fees. You choose the location,
            duration, and number of daily plays — and you pay exactly that.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            {[
              { label: 'Starter',  desc: 'Single location,\n15s slot', note: 'Great for local shops' },
              { label: 'Standard', desc: 'Multi-location,\n30s slot', note: 'Most popular' },
              { label: 'Pro',      desc: 'City-wide campaign,\n60s premium slot', note: 'Full reach' },
            ].map((p, i) => (
              <div key={p.label} className={`rounded-2xl p-6 border ${i === 1 ? 'bg-[#0f7b4a] border-[#0f7b4a]' : 'bg-white/5 border-white/10'}`}>
                {i === 1 && <div className="mono text-[10px] tracking-widest uppercase text-[#22c55e] mb-2">{p.note}</div>}
                <h3 className="font-bold text-lg text-white mb-1">{p.label}</h3>
                <p className="text-white/60 text-sm whitespace-pre-line">{p.desc}</p>
                {i !== 1 && <p className="text-white/30 text-[11px] mt-3">{p.note}</p>}
              </div>
            ))}
          </div>
          <Link href="/register" className="btn h-12 px-8 text-[15px] font-semibold bg-white text-[#0a2e1f] hover:bg-[#f6f4ef] transition-colors inline-flex items-center gap-2">
            Create a free account
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
          <p className="text-white/30 text-xs mt-4 mono">Free to register · Only pay when you book</p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="bg-[#f6f4ef] border-t border-[#ebe7dd] px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="RAREVISION" width={28} height={28} style={{ width: 'auto', height: 28 }} />
            <div>
              <p className="font-bold text-sm text-[#1a1a17]">RAREVISION</p>
              <p className="text-[11px] text-[#1a1a17]/50">Digital Signage Advertising</p>
            </div>
          </div>
          <div className="flex gap-8">
            <Link href="/login"    className="text-sm text-[#1a1a17]/60 hover:text-[#0f7b4a] transition-colors">Sign in</Link>
            <Link href="/register" className="text-sm text-[#1a1a17]/60 hover:text-[#0f7b4a] transition-colors">Register</Link>
            <a href="mailto:info@rarevision.tech" className="text-sm text-[#1a1a17]/60 hover:text-[#0f7b4a] transition-colors">info@rarevision.tech</a>
          </div>
          <p className="mono text-[11px] text-[#1a1a17]/40">              &copy; {new Date().getFullYear()} RAREVISION. All rights reserved.</p>
        </div>
      </footer>

    </main>
  );
}

import BrandMark from './BrandMark';
import RotatingWord from './RotatingWord';

export type HeroVariant = 'login' | 'register';

interface Props {
  variant?: HeroVariant;
}

const LOGIN_WORDS    = ['Billboards', 'Screens', 'Campaigns', 'Adverts', 'Brands'];
const REGISTER_WORDS = ['Harare', 'Bulawayo', 'Zimbabwe', 'Africa', 'Your City'];

const VARIANTS = {
  login: {
    sub: 'Reach thousands of customers across multiple locations with our intelligent digital signage platform. Upload once, display everywhere.',
    features: [
      { icon: <ScreenIcon />, title: 'Multiple Screens', sub: 'Nationwide reach' },
      { icon: <VideoIcon />,  title: 'Video & Images',  sub: 'Dynamic content'  },
      { icon: <TargetIcon />, title: 'Targeted Ads',    sub: 'Right audience'   },
      { icon: <ClockIcon />,  title: 'Real-time',       sub: 'Instant updates'  },
    ],
  },
  register: {
    sub: 'Join thousands of businesses reaching customers across Zimbabwe through our intelligent digital signage network.',
    features: [
      { icon: <CheckIcon />, title: 'Easy 4-step ad upload process',     sub: '' },
      { icon: <CheckIcon />, title: 'Multiple display locations',         sub: '' },
      { icon: <CheckIcon />, title: 'Real-time campaign analytics',       sub: '' },
      { icon: <CheckIcon />, title: 'Secure payment & verification',      sub: '' },
    ],
  },
} satisfies Record<HeroVariant, unknown>;

export default function SignageHero({ variant = 'login' }: Props) {
  const v = VARIANTS[variant];
  const isLogin = variant === 'login';

  return (
    <section
      className="hidden lg:flex relative overflow-hidden flex-col justify-between p-10 xl:p-16 text-white"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 10% 0%, #0f4d2e 0%, transparent 60%),' +
          'radial-gradient(ellipse 70% 50% at 90% 100%, #0a5a36 0%, transparent 60%),' +
          'linear-gradient(170deg, #0d3521 0%, #071c13 100%)',
      }}
    >
      {/* Rich digital background elements */}
      <DigitalBackground />

      {/* TOP — brand */}
      <div className="relative z-10">
        <BrandMark tone="light" href="/" size="xl" />
      </div>

      {/* CENTER — copy + features */}
      <div className="relative z-10 my-10 max-w-[520px]">
        {isLogin ? (
          <h2 className="display text-[46px] xl:text-[56px] 2xl:text-[62px] leading-[1.05] mb-6">
            Transform Your<br />
            <span className="text-brand-live">
              <RotatingWord words={LOGIN_WORDS} intervalMs={2600} />
            </span>
          </h2>
        ) : (
          <h2 className="display text-[46px] xl:text-[56px] 2xl:text-[62px] leading-[1.05] mb-6">
            Advertise Across<br />
            <span className="text-brand-live">
              <RotatingWord words={REGISTER_WORDS} intervalMs={2600} />
            </span>
          </h2>
        )}
        <p className="text-white/75 text-[17px] xl:text-[18px] leading-relaxed mb-9">{v.sub}</p>

        {isLogin ? (
          <div className="grid grid-cols-2 gap-3">
            {v.features.map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} sub={f.sub} />
            ))}
          </div>
        ) : (
          <ul className="space-y-4">
            {v.features.map((f) => (
              <li key={f.title} className="flex items-center gap-3 text-[17px] text-white/85">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brand-live/20 border border-brand-live/40 flex items-center justify-center">
                  {f.icon}
                </span>
                {f.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* BOTTOM — stats bar */}
      <div className="relative z-10 flex items-center gap-10 xl:gap-14 pt-6 border-t border-white/10">
        {[['50+', 'Active Screens'], ['10K+', 'Daily Impressions'], ['24/7', 'Live Support']].map(([val, label]) => (
          <div key={label}>
            <div className="display text-[28px] xl:text-[32px] text-white">{val}</div>
            <div className="mono text-[11px] uppercase tracking-widest text-white/50 mt-1">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4 flex gap-3 items-start">
      <span className="mt-0.5 shrink-0 w-8 h-8 rounded-md bg-brand/40 border border-brand/30 flex items-center justify-center text-brand-live">
        {icon}
      </span>
      <div>
        <div className="text-[14px] font-semibold text-white">{title}</div>
        {sub && <div className="text-[12px] text-white/50 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function DigitalBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">

      {/* ── Large monitor outlines ─────────────────────────────────────────── */}
      {/* top-right primary screen */}
      <svg className="absolute -top-10 -right-14 opacity-[0.09]" width="380" height="240" viewBox="0 0 380 240" fill="none">
        <rect x="2" y="2" width="376" height="206" rx="14" stroke="white" strokeWidth="3" />
        <line x1="120" y1="208" x2="260" y2="208" stroke="white" strokeWidth="3" />
        <line x1="190" y1="208" x2="190" y2="236" stroke="white" strokeWidth="3" />
        <line x1="150" y1="236" x2="230" y2="236" stroke="white" strokeWidth="2" />
      </svg>

      {/* mid-right medium screen */}
      <svg className="absolute top-[38%] -right-6 opacity-[0.07]" width="220" height="140" viewBox="0 0 220 140" fill="none">
        <rect x="2" y="2" width="216" height="118" rx="10" stroke="white" strokeWidth="2.5" />
        <line x1="70" y1="120" x2="150" y2="120" stroke="white" strokeWidth="2.5" />
        <line x1="110" y1="120" x2="110" y2="136" stroke="white" strokeWidth="2.5" />
      </svg>

      {/* bottom-left small screen */}
      <svg className="absolute bottom-[18%] -left-8 opacity-[0.07]" width="180" height="115" viewBox="0 0 180 115" fill="none">
        <rect x="2" y="2" width="176" height="96" rx="8" stroke="white" strokeWidth="2" />
        <line x1="58" y1="98" x2="122" y2="98" stroke="white" strokeWidth="2" />
        <line x1="90" y1="98" x2="90" y2="112" stroke="white" strokeWidth="2" />
      </svg>

      {/* top-left tiny screen — xl+ only */}
      <svg className="absolute top-[12%] left-[8%] opacity-[0.05] hidden xl:block" width="130" height="85" viewBox="0 0 130 85" fill="none">
        <rect x="2" y="2" width="126" height="70" rx="7" stroke="white" strokeWidth="2" />
        <line x1="42" y1="72" x2="88" y2="72" stroke="white" strokeWidth="2" />
        <line x1="65" y1="72" x2="65" y2="82" stroke="white" strokeWidth="2" />
      </svg>

      {/* ── Play / video buttons ──────────────────────────────────────────── */}
      {/* large play — mid-left */}
      <svg className="absolute top-[30%] -left-6 opacity-[0.08]" width="110" height="110" viewBox="0 0 110 110" fill="none">
        <circle cx="55" cy="55" r="52" stroke="white" strokeWidth="2.5" />
        <polygon points="42,32 88,55 42,78" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>

      {/* small play — upper right area */}
      <svg className="absolute top-[22%] right-[14%] opacity-[0.06]" width="64" height="64" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="30" stroke="white" strokeWidth="2" />
        <polygon points="24,18 50,32 24,46" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      </svg>

      {/* tiny play — bottom right */}
      <svg className="absolute bottom-[28%] right-[10%] opacity-[0.06]" width="44" height="44" viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="20" stroke="white" strokeWidth="1.8" />
        <polygon points="16,12 34,22 16,32" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>

      {/* ── Camera / video cam icons ──────────────────────────────────────── */}
      {/* bottom-right camera */}
      <svg className="absolute bottom-[22%] right-[6%] opacity-[0.08]" width="96" height="70" viewBox="0 0 96 70" fill="none">
        <rect x="2" y="16" width="64" height="48" rx="7" stroke="white" strokeWidth="2.5" />
        <polygon points="66,28 94,16 94,54 66,42" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="34" cy="40" r="10" stroke="white" strokeWidth="2" />
      </svg>

      {/* small camera — top area */}
      <svg className="absolute top-[8%] right-[28%] opacity-[0.05] hidden xl:block" width="64" height="46" viewBox="0 0 64 46" fill="none">
        <rect x="2" y="10" width="42" height="32" rx="5" stroke="white" strokeWidth="2" />
        <polygon points="44,18 62,10 62,36 44,28" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      </svg>

      {/* ── Signal / wifi rings ───────────────────────────────────────────── */}
      {/* top-left signal */}
      <svg className="absolute top-[6%] left-[18%] opacity-[0.07]" width="70" height="70" viewBox="0 0 70 70" fill="none">
        <path d="M10 50 Q35 10 60 50" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M18 55 Q35 25 52 55" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M26 60 Q35 40 44 60" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="35" cy="63" r="3" fill="white" />
      </svg>

      {/* bottom-left signal */}
      <svg className="absolute bottom-[10%] left-[22%] opacity-[0.06]" width="56" height="56" viewBox="0 0 56 56" fill="none">
        <path d="M6 40 Q28 6 50 40" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 44 Q28 18 42 44" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M21 48 Q28 30 35 48" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="28" cy="51" r="2.5" fill="white" />
      </svg>

      {/* right mid signal — xl+ */}
      <svg className="absolute top-[58%] right-[18%] opacity-[0.05] hidden xl:block" width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M4 34 Q24 4 44 34" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M11 38 Q24 14 37 38" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17 42 Q24 26 31 42" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="24" cy="44" r="2" fill="white" />
      </svg>

      {/* ── Waveform / audio bars ─────────────────────────────────────────── */}
      {/* bottom-center waveform */}
      <svg className="absolute bottom-[14%] left-[38%] opacity-[0.06]" width="120" height="50" viewBox="0 0 120 50" fill="none">
        {[0,10,20,30,40,50,60,70,80,90,100,110].map((x, i) => {
          const heights = [12,28,40,18,44,32,48,22,36,16,30,10];
          const h = heights[i];
          return <rect key={x} x={x+2} y={(50-h)/2} width="6" height={h} rx="3" fill="white" />;
        })}
      </svg>

      {/* top waveform — xl+ */}
      <svg className="absolute top-[4%] left-[42%] opacity-[0.05] hidden xl:block" width="90" height="36" viewBox="0 0 90 36" fill="none">
        {[0,8,16,24,32,40,48,56,64,72,80].map((x, i) => {
          const heights = [8,20,30,14,34,24,36,16,26,12,18];
          const h = heights[i];
          return <rect key={x} x={x+1} y={(36-h)/2} width="5" height={h} rx="2.5" fill="white" />;
        })}
      </svg>

      {/* ── Circuit / data lines ──────────────────────────────────────────── */}
      {/* right side circuit */}
      <svg className="absolute top-[45%] right-0 opacity-[0.06] hidden xl:block" width="100" height="200" viewBox="0 0 100 200" fill="none">
        <path d="M80 10 L80 60 L40 60 L40 100 L80 100 L80 150 L50 150 L50 190" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="80" cy="10"  r="4" stroke="white" strokeWidth="1.5" />
        <circle cx="40" cy="100" r="4" stroke="white" strokeWidth="1.5" />
        <circle cx="50" cy="190" r="4" stroke="white" strokeWidth="1.5" />
      </svg>

      {/* left side circuit */}
      <svg className="absolute top-[20%] left-0 opacity-[0.05] hidden xl:block" width="80" height="160" viewBox="0 0 80 160" fill="none">
        <path d="M20 10 L20 50 L60 50 L60 90 L20 90 L20 140 L50 140" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="10"  r="3.5" stroke="white" strokeWidth="1.5" />
        <circle cx="60" cy="90"  r="3.5" stroke="white" strokeWidth="1.5" />
        <circle cx="50" cy="140" r="3.5" stroke="white" strokeWidth="1.5" />
      </svg>

      {/* ── Scatter data dots ─────────────────────────────────────────────── */}
      {/* scattered glowing dots — visible at all sizes */}
      {[
        { cx: '12%',  cy: '18%',  r: 3 },
        { cx: '88%',  cy: '32%',  r: 2.5 },
        { cx: '6%',   cy: '65%',  r: 2 },
        { cx: '92%',  cy: '70%',  r: 3 },
        { cx: '34%',  cy: '8%',   r: 2 },
        { cx: '72%',  cy: '6%',   r: 2.5 },
        { cx: '18%',  cy: '88%',  r: 2 },
        { cx: '80%',  cy: '88%',  r: 2 },
        { cx: '50%',  cy: '4%',   r: 1.8 },
        { cx: '96%',  cy: '50%',  r: 2 },
      ].map(({ cx, cy, r }, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="white" opacity="0.12" />
      ))}

      {/* extra dots on xl+ */}
      {[
        { cx: '22%',  cy: '42%',  r: 2 },
        { cx: '76%',  cy: '48%',  r: 2 },
        { cx: '42%',  cy: '92%',  r: 1.8 },
        { cx: '60%',  cy: '96%',  r: 2 },
        { cx: '4%',   cy: '36%',  r: 1.8 },
        { cx: '30%',  cy: '14%',  r: 1.8 },
        { cx: '64%',  cy: '14%',  r: 1.8 },
        { cx: '86%',  cy: '16%',  r: 2 },
      ].map(({ cx, cy, r }, i) => (
        <circle key={`xl-${i}`} cx={cx} cy={cy} r={r} fill="white" opacity="0.08" className="hidden xl:block" style={{ position: 'absolute' }} />
      ))}

      {/* ── Antenna / broadcast tower ─────────────────────────────────────── */}
      <svg className="absolute bottom-[30%] left-[6%] opacity-[0.07]" width="50" height="80" viewBox="0 0 50 80" fill="none">
        <line x1="25" y1="78" x2="25" y2="40" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="25" y1="40" x2="8"  y2="70" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="25" y1="40" x2="42" y2="70" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10 28 Q25 10 40 28" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M16 34 Q25 20 34 34" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <circle cx="25" cy="38" r="3" fill="white" />
      </svg>

      {/* small antenna — top right area — xl+ */}
      <svg className="absolute top-[14%] right-[8%] opacity-[0.06] hidden xl:block" width="36" height="58" viewBox="0 0 36 58" fill="none">
        <line x1="18" y1="56" x2="18" y2="30" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="18" y1="30" x2="6"  y2="50" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="18" y1="30" x2="30" y2="50" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 20 Q18 6 30 20"  stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M10 24 Q18 12 26 24" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <circle cx="18" cy="28" r="2.5" fill="white" />
      </svg>

      {/* ── Target / crosshair ───────────────────────────────────────────── */}
      <svg className="absolute top-[48%] left-[14%] opacity-[0.06]" width="60" height="60" viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="30" r="28" stroke="white" strokeWidth="1.8" />
        <circle cx="30" cy="30" r="18" stroke="white" strokeWidth="1.8" />
        <circle cx="30" cy="30" r="5"  stroke="white" strokeWidth="1.8" />
        <line x1="30" y1="2"  x2="30" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="30" y1="46" x2="30" y2="58" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="2"  y1="30" x2="14" y2="30" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="46" y1="30" x2="58" y2="30" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>

      {/* small crosshair — xl+ */}
      <svg className="absolute top-[72%] right-[24%] opacity-[0.05] hidden xl:block" width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" stroke="white" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="10" stroke="white" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="3"  stroke="white" strokeWidth="1.5" />
        <line x1="20" y1="2"  x2="20" y2="10" stroke="white" strokeWidth="1.5" />
        <line x1="20" y1="30" x2="20" y2="38" stroke="white" strokeWidth="1.5" />
        <line x1="2"  y1="20" x2="10" y2="20" stroke="white" strokeWidth="1.5" />
        <line x1="30" y1="20" x2="38" y2="20" stroke="white" strokeWidth="1.5" />
      </svg>

      {/* ── Pixel / QR-esque squares ──────────────────────────────────────── */}
      <svg className="absolute top-[2%] right-[4%] opacity-[0.06]" width="72" height="72" viewBox="0 0 72 72" fill="none">
        {/* corner squares */}
        <rect x="2"  y="2"  width="20" height="20" rx="3" stroke="white" strokeWidth="1.8" />
        <rect x="50" y="2"  width="20" height="20" rx="3" stroke="white" strokeWidth="1.8" />
        <rect x="2"  y="50" width="20" height="20" rx="3" stroke="white" strokeWidth="1.8" />
        {/* inner dots */}
        <rect x="8"  y="8"  width="8"  height="8"  rx="1" fill="white" opacity="0.6" />
        <rect x="56" y="8"  width="8"  height="8"  rx="1" fill="white" opacity="0.6" />
        <rect x="8"  y="56" width="8"  height="8"  rx="1" fill="white" opacity="0.6" />
        {/* data cells */}
        <rect x="32" y="32" width="8"  height="8"  rx="1" fill="white" opacity="0.4" />
        <rect x="44" y="32" width="8"  height="8"  rx="1" fill="white" opacity="0.4" />
        <rect x="32" y="44" width="8"  height="8"  rx="1" fill="white" opacity="0.4" />
        <rect x="56" y="56" width="8"  height="8"  rx="1" fill="white" opacity="0.4" />
      </svg>

      {/* small pixel cluster bottom-left */}
      <svg className="absolute bottom-[6%] left-[30%] opacity-[0.05] hidden xl:block" width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="2"  y="2"  width="14" height="14" rx="2" stroke="white" strokeWidth="1.5" />
        <rect x="32" y="2"  width="14" height="14" rx="2" stroke="white" strokeWidth="1.5" />
        <rect x="2"  y="32" width="14" height="14" rx="2" stroke="white" strokeWidth="1.5" />
        <rect x="6"  y="6"  width="6"  height="6"  rx="1" fill="white" opacity="0.5" />
        <rect x="36" y="6"  width="6"  height="6"  rx="1" fill="white" opacity="0.5" />
        <rect x="6"  y="36" width="6"  height="6"  rx="1" fill="white" opacity="0.5" />
        <rect x="22" y="20" width="6"  height="6"  rx="1" fill="white" opacity="0.35" />
        <rect x="32" y="32" width="6"  height="6"  rx="1" fill="white" opacity="0.35" />
      </svg>

      {/* ── Broadcast / signal pulse rings ───────────────────────────────── */}
      <svg className="absolute top-[5%] left-[50%] opacity-[0.06] hidden xl:block" width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="36" stroke="white" strokeWidth="1.5" strokeDasharray="4 6" />
        <circle cx="40" cy="40" r="24" stroke="white" strokeWidth="1.5" strokeDasharray="4 5" />
        <circle cx="40" cy="40" r="12" stroke="white" strokeWidth="1.5" />
        <circle cx="40" cy="40" r="4"  fill="white" opacity="0.6" />
      </svg>

      <svg className="absolute bottom-[4%] right-[30%] opacity-[0.05]" width="60" height="60" viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="30" r="27" stroke="white" strokeWidth="1.5" strokeDasharray="4 5" />
        <circle cx="30" cy="30" r="17" stroke="white" strokeWidth="1.5" strokeDasharray="3 4" />
        <circle cx="30" cy="30" r="8"  stroke="white" strokeWidth="1.5" />
        <circle cx="30" cy="30" r="3"  fill="white" opacity="0.6" />
      </svg>

      {/* ── Diagonal scan lines ───────────────────────────────────────────── */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.025] hidden xl:block" preserveAspectRatio="none">
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={i} x1={`${i * 8}%`} y1="0%" x2={`${i * 8 + 6}%`} y2="100%"
            stroke="white" strokeWidth="1" />
        ))}
      </svg>

    </div>
  );
}

function ScreenIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}
function VideoIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="15" height="14" rx="2"/><polygon points="17,9 22,6 22,18 17,15"/></svg>;
}
function TargetIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
}
function ClockIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
}
function CheckIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

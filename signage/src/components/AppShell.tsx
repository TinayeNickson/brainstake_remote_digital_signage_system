'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { UserRole } from '@/lib/types';

/* ── Nav item shapes per role (icon is a string key, resolved later) ── */
const CUSTOMER_NAV = [
  { href: '/dashboard',              label: 'Dashboard',     icon: 'home'     },
  { href: '/dashboard/my-campaigns', label: 'My Campaigns',  icon: 'campaign' },
  { href: '/dashboard/new',          label: 'New Campaign',  icon: 'plus'     },
  { href: '/dashboard/receipts',     label: 'Receipts',      icon: 'receipt'  },
  { href: '/dashboard/notifications', label: 'Notifications', icon: 'bell'     },
];

const ACCOUNTANT_NAV = [
  { href: '/accountant',                    label: 'Revenue Dashboard', icon: 'chart'    },
  { href: '/accountant/payments',           label: 'Payments Queue',   icon: 'payments' },
  { href: '/accountant/payment-settings',   label: 'Banking Details',  icon: 'settings' },
];

const ADMIN_NAV = [
  { href: '/admin',             label: 'Approved Ads',    icon: 'screen'    },
  { href: '/admin/locations',   label: 'Locations',       icon: 'location'  },
  { href: '/admin/packages',    label: 'Packages',        icon: 'package'   },
  { href: '/admin/devices',     label: 'Devices',         icon: 'device'    },
  { href: '/admin/guards',      label: 'Security Guards', icon: 'lock'      },
  { href: '/admin/assign',      label: 'Ad → Screen',     icon: 'link'      },
  { href: '/admin/override',    label: 'Emergency Broadcast', icon: 'broadcast' },
  { href: '/admin/fallback',    label: 'Fallback Content',    icon: 'fallback'  },
  { href: '/admin/contact-settings', label: 'Contact Settings', icon: 'phone'     },
  { href: '/admin/users',       label: 'Users & Roles',   icon: 'users'     },
  { href: '/dashboard',         label: 'Customer View',   icon: 'campaign'  },
];

const ROLE_NAV: Record<UserRole, { href: string; label: string; icon: string }[]> = {
  customer:   CUSTOMER_NAV,
  accountant: ACCOUNTANT_NAV,
  admin:      ADMIN_NAV,
};

const ROLE_LABEL: Record<UserRole, string> = {
  customer:   'Customer',
  accountant: 'Accountant',
  admin:      'Administrator',
};

const ROLE_COLOR: Record<UserRole, string> = {
  customer:   'bg-blue-50 text-blue-700 border-blue-200',
  accountant: 'bg-amber-50 text-amber-700 border-amber-200',
  admin:      'bg-brand-soft text-brand-dark border-brand/25',
};

type IconComp = ({ active }: { active?: boolean }) => JSX.Element;

/* Must be defined before AppShell since it's a const (not hoisted) */
const ICON_MAP: Record<string, IconComp> = {
  home:      HomeIcon,
  campaign:  CampaignIcon,
  plus:      PlusIcon,
  receipt:   ReceiptIcon,
  payments:  PaymentsIcon,
  screen:    ScreenIcon,
  location:  LocationIcon,
  device:    DeviceIcon,
  lock:      LockIcon,
  link:      LinkIcon,
  users:     UsersIcon,
  package:   PackageNavIcon,
  broadcast: BroadcastNavIcon,
  chart:     ChartIcon,
  settings:  SettingsIcon,
  fallback:  FallbackIcon,
  bell:      BellIcon,
  phone:     PhoneIcon,
};

interface Props {
  role: UserRole;
  email: string;
  fullName?: string | null;
  children: React.ReactNode;
}

export default function AppShell({ role, email, fullName, children }: Props) {
  const pathname  = usePathname();
  const navItems  = ROLE_NAV[role] ?? CUSTOMER_NAV;
  const initials  = (fullName ?? email)
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    window.location.href = '/login';
  }

  /* Derive page title from pathname for breadcrumb */
  const pageTitle = (() => {
    const all = [...CUSTOMER_NAV, ...ACCOUNTANT_NAV, ...ADMIN_NAV];
    const match = all
      .slice()
      .sort((a, b) => b.href.length - a.href.length)
      .find(n => pathname === n.href || pathname.startsWith(n.href + '/'));
    return match?.label ?? 'Dashboard';
  })();

  return (
    <div className="flex h-screen bg-[#f4f5f7] overflow-hidden">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────── */}
      <aside className="w-[256px] shrink-0 flex flex-col bg-[#2d2a6e] text-white h-full">

        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.08]">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-white/10">
              <Image src="/logo.jpg" alt="RAREVISION" width={32} height={32} className="object-contain" style={{ width: 'auto', height: 'auto' }} priority />
            </div>
            <div className="leading-none">
              <p className="font-bold text-[14px] tracking-[0.04em] text-white">RAREVISION</p>
              <p className="text-[9px] text-white/40 uppercase tracking-[0.22em] mt-[3px]">WE FOLLOW THE DREAM</p>
            </div>
          </Link>
        </div>

        {/* Nav section */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="px-3 mb-2.5 text-[9.5px] font-bold uppercase tracking-[0.22em] text-white/25">
            {ROLE_LABEL[role]}
          </p>
          <div className="space-y-px">
            {navItems.map(({ href, label, icon }) => {
              const isExact = href === '/dashboard' || href === '/accountant';
              const active  = isExact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
              const Icon    = ICON_MAP[icon] ?? CampaignIcon;
              return (
                <Link key={href} href={href}
                  className={`group flex items-center gap-3 px-3 h-[38px] rounded-lg text-[13px] font-medium transition-all ${
                    active
                      ? 'bg-white/[0.12] text-white'
                      : 'text-white/55 hover:text-white hover:bg-white/[0.07]'
                  }`}>
                  {active && (
                    <span className="absolute left-0 w-[3px] h-5 bg-brand-live rounded-r-full" style={{}} />
                  )}
                  <span className={active ? 'text-white' : 'text-white/50 group-hover:text-white/80 transition-colors'}>
                    <Icon active={active} />
                  </span>
                  <span className="flex-1 truncate">{label}</span>
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-live shrink-0" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User card + sign out */}
        <div className="px-3 py-3 border-t border-white/[0.08]">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/[0.06] mb-1">
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-[11px] font-bold shrink-0 ring-1 ring-white/20">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-white truncate leading-tight">{fullName ?? email.split('@')[0]}</p>
              <p className="text-[10px] text-white/40 truncate mt-px">{email}</p>
            </div>
          </div>
          <button type="button" onClick={signOut}
            className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[12.5px] text-white/45 hover:text-white hover:bg-white/[0.07] transition-colors font-medium mt-0.5">
            <SignOutIcon />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-14 shrink-0 bg-white border-b border-ink-100 flex items-center px-6 gap-4 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-ink-900/30 text-sm font-medium">{ROLE_LABEL[role]}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-ink-900/20 shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
            <span className="text-ink-900 text-sm font-semibold truncate">{pageTitle}</span>
          </div>

          {/* Role chip */}
          <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10.5px] font-semibold ${ROLE_COLOR[role]}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {ROLE_LABEL[role]}
          </span>

          <div className="hidden sm:block w-px h-5 bg-ink-100" />

          {/* Avatar */}
          <button className="flex items-center gap-2.5 rounded-xl pl-1.5 pr-3 h-9 hover:bg-ink-50 transition-colors">
            <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-[11px] font-bold shrink-0 ring-2 ring-brand/20">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[12px] font-semibold text-ink-900 leading-none">{fullName?.split(' ')[0] ?? email.split('@')[0]}</p>
              <p className="text-[10px] text-ink-900/40 leading-none mt-0.5 truncate max-w-[110px]">{email}</p>
            </div>
          </button>
        </header>

        {/* Page scroll area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}

/* ── SVG Icon helpers ──────────────────────────────────────────────── */
function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function CampaignIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  );
}
function PlusIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  );
}
function ReceiptIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}
function PaymentsIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
}
function ScreenIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  );
}
function LocationIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}
function DeviceIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
}
function LockIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
function LinkIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}
function UsersIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function PackageNavIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  );
}
function FallbackIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" /><polyline points="8 21 12 17 16 21" />
    </svg>
  );
}
function SettingsIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function ChartIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function BroadcastNavIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}
function BellIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function PhoneIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}


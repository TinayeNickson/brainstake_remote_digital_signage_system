'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import BrandMark from '@/components/BrandMark';
import SignageHero from '@/components/SignageHero';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    const { data, error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed') ||
          error.message.toLowerCase().includes('not confirmed')) {
        setErr('Your email address is not yet confirmed. Please check your inbox and click the confirmation link.');
      } else if (error.message.toLowerCase().includes('invalid login')) {
        setErr('Incorrect email or password. Please try again.');
      } else {
        setErr(error.message);
      }
      return;
    }
    if (!data.session) {
      setErr('Sign in failed — no session returned. Please try again.');
      return;
    }
    // Wait for the SSR cookie to be written before hard-navigating
    const sb = supabaseBrowser();
    await new Promise<void>(resolve => {
      const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') { subscription.unsubscribe(); resolve(); }
      });
      // Safety timeout — navigate anyway after 1.5s
      setTimeout(resolve, 1500);
    });
    window.location.href = '/dashboard';
  }

  return (
    <main className="min-h-screen lg:h-screen lg:overflow-hidden grid lg:grid-cols-[1.15fr_1fr]">
      <SignageHero variant="login" />

      <section className="bg-ink-50 lg:h-screen lg:overflow-y-auto flex flex-col justify-center">
        <div className="w-full max-w-[540px] mx-auto py-10 px-10">
          <div className="lg:hidden mb-8">
            <BrandMark />
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-md border border-ink-100 p-10">
            <div className="mb-8 text-center">
              <h1 className="display text-[34px] leading-tight text-ink-900">Welcome Back</h1>
              <p className="text-[15px] text-ink-900/55 mt-2">
                Sign in to manage your digital signage campaigns
              </p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="label">Email address</label>
                <input
                  className="input h-12 text-[15px]"
                  type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="[email protected]"
                />
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    className="input h-12 text-[15px] pr-12"
                    type={showPw ? 'text' : 'password'}
                    required autoComplete="current-password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-900/40 hover:text-ink-900/70 transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {err && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 leading-relaxed">
                  {err}
                </div>
              )}

              <button disabled={loading} className="btn btn-primary w-full h-12 text-[16px] font-semibold mt-1 rounded-xl">
                {loading ? 'Signing in…' : (
                  <span className="flex items-center justify-center gap-2">Sign in <ArrowIcon /></span>
                )}
              </button>
            </form>

            <p className="text-[14px] text-ink-900/60 text-center mt-6">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-brand font-semibold hover:underline underline-offset-4">
                Register here
              </Link>
            </p>

            <p className="text-[11px] text-ink-900/35 text-center mt-3 leading-relaxed">
              By signing in you agree to our{' '}
              <Link href="/terms" className="underline hover:text-ink-900/60 transition-colors">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="underline hover:text-ink-900/60 transition-colors">Privacy Policy</Link>.
            </p>
          </div>

          <div className="flex items-center justify-center gap-6 mt-5">
            <button type="button"
              onClick={() => setErr('Password reset is not yet available. Please contact support.')}
              className="text-[12px] text-ink-900/50 hover:text-ink-900/80 transition-colors">
              Forgot password?
            </button>
            <span className="text-ink-200">·</span>
            <a href="mailto:info@brainstake.tech" className="text-[12px] text-ink-900/50 hover:text-ink-900/80 transition-colors">
              Need help?
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

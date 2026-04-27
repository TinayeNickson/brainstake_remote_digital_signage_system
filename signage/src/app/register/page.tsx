'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import BrandMark from '@/components/BrandMark';
import SignageHero from '@/components/SignageHero';

type AccountType = 'individual' | 'company';

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<AccountType>('individual');

  // Individual fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Company fields
  const [companyName, setCompanyName] = useState('');
  const [companyReg, setCompanyReg] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  // Shared
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (password !== confirmPw) { setErr('Passwords do not match.'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }

    const phoneVal = accountType === 'individual' ? phone.trim() : contactPhone.trim();
    if (!phoneVal) { setErr('Phone number is required.'); return; }

    setLoading(true);
    const supa = supabaseBrowser();

    const billingMeta =
      accountType === 'individual'
        ? {
            full_name: fullName,
            phone: phone.trim(),
            phone_number: phone.trim(),
            account_type: 'individual',
          }
        : {
            full_name: contactName,
            contact_person_name: contactName,
            company_name: companyName,
            company_reg: companyReg,
            phone: contactPhone.trim(),
            phone_number: contactPhone.trim(),
            billing_address: billingAddress,
            account_type: 'company',
          };

    const { data, error } = await supa.auth.signUp({
      email,
      password,
      options: { data: billingMeta },
    });

    if (error) { setErr(error.message); setLoading(false); return; }

    if (data.user) {
      const upsertData: Record<string, string> = {
        id:           data.user.id,
        email:        email,
        full_name:    billingMeta.full_name,
        phone:        phoneVal,
        phone_number: phoneVal,
        account_type: accountType,
      };
      if (accountType === 'company') {
        upsertData.contact_person_name = contactName;
        upsertData.company_name        = companyName;
        upsertData.company_reg         = companyReg;
        upsertData.billing_address     = billingAddress;
      }
      await supa.from('profiles').upsert(upsertData);
    }

    setLoading(false);
    setRegistered(true);
  }

  return (
    <main className="min-h-screen lg:h-screen lg:overflow-hidden grid lg:grid-cols-[1.15fr_1fr]">
      <SignageHero variant="register" />

      <section className="bg-ink-50 lg:h-screen lg:overflow-y-auto">
        <div className="w-full max-w-[560px] mx-auto py-10 px-10">
          <div className="lg:hidden mb-6">
            <BrandMark />
          </div>

          {registered ? (
            <div className="bg-white rounded-2xl shadow-sm border border-ink-100 p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-brand"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 className="font-bold text-xl text-ink-900 mb-2">Check your email</h2>
              <p className="text-sm text-ink-900/60 leading-relaxed mb-5">
                We&apos;ve sent a confirmation link to <strong>{email}</strong>.<br/>
                Click the link in that email to activate your account, then sign in.
              </p>
              <a href="/login" className="btn btn-primary w-full h-10 font-semibold text-sm flex items-center justify-center">
                Go to sign in
              </a>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-md border border-ink-100 p-10">
              <div className="mb-6 text-center">
                <h1 className="display text-[30px] leading-tight text-ink-900">Create Your Account</h1>
                <p className="text-[14px] mt-2">
                  <span className="text-brand font-medium">Join Brainstake</span>
                  <span className="text-ink-900/50"> and start advertising today</span>
                </p>
              </div>

              {/* Account type toggle */}
              <div className="flex gap-1 p-1 bg-ink-50 rounded-xl border border-ink-100 mb-6">
                <button
                  type="button"
                  onClick={() => setAccountType('individual')}
                  className={`flex-1 h-11 rounded-lg text-[14px] font-semibold transition-all ${
                    accountType === 'individual' ? 'bg-brand text-white shadow-sm' : 'text-ink-900/60 hover:text-ink-900'
                  }`}
                >
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('company')}
                  className={`flex-1 h-11 rounded-lg text-[14px] font-semibold transition-all ${
                    accountType === 'company' ? 'bg-brand text-white shadow-sm' : 'text-ink-900/60 hover:text-ink-900'
                  }`}
                >
                  Company / Org
                </button>
              </div>

              <form onSubmit={submit} className="space-y-4">
              {accountType === 'individual' ? (
                <>
                  <div>
                    <label className="label">Full Name</label>
                    <input
                      className="input h-12 text-[15px]" required
                      value={fullName} onChange={e => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <label className="label">Phone Number <span className="text-red-500">*</span></label>
                    <input
                      className="input h-12 text-[15px]" required
                      type="tel"
                      value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+263 77 000 0000"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="label">Company / Organisation Name</label>
                    <input
                      className="input h-12 text-[15px]" required
                      value={companyName} onChange={e => setCompanyName(e.target.value)}
                      placeholder="Acme Zimbabwe (Pvt) Ltd"
                    />
                  </div>
                  <div>
                    <label className="label">Registration Number <span className="normal-case font-normal text-ink-900/40">(optional)</span></label>
                    <input
                      className="input h-12 text-[15px]"
                      value={companyReg} onChange={e => setCompanyReg(e.target.value)}
                      placeholder="e.g. 12345/2020"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Contact Person</label>
                      <input
                        className="input h-12 text-[15px]" required
                        value={contactName} onChange={e => setContactName(e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="label">Contact Phone <span className="text-red-500">*</span></label>
                      <input
                        className="input h-12 text-[15px]" required
                        type="tel"
                        value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                        placeholder="+263 77 …"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Billing Address</label>
                    <input
                      className="input h-12 text-[15px]"
                      value={billingAddress} onChange={e => setBillingAddress(e.target.value)}
                      placeholder="Street, City, Zimbabwe"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="label">Email address</label>
                <input
                  className="input h-12 text-[15px]" type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label className="label">Password <span className="normal-case font-normal text-ink-900/40">(min 6 characters)</span></label>
                <div className="relative">
                  <input
                    className="input h-12 text-[15px] pr-12" required
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Create a password"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-900/40 hover:text-ink-900/70 transition-colors"
                    aria-label={showPw ? 'Hide' : 'Show'}>
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Confirm Password</label>
                <div className="relative">
                  <input
                    className="input h-12 text-[15px] pr-12" required
                    type={showCpw ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Confirm your password"
                  />
                  <button type="button" onClick={() => setShowCpw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-900/40 hover:text-ink-900/70 transition-colors"
                    aria-label={showCpw ? 'Hide' : 'Show'}>
                    {showCpw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {err && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 leading-relaxed">
                  {err}
                </div>
              )}

              <button disabled={loading} className="btn btn-primary w-full h-12 text-[16px] font-semibold mt-1 rounded-xl">
                {loading ? 'Creating account…' : (
                  <span className="flex items-center gap-2">Create Account <ArrowIcon /></span>
                )}
              </button>
            </form>

              <p className="text-sm text-ink-900/60 text-center mt-5">
                Already have an account?{' '}
                <Link href="/login" className="text-brand font-semibold hover:underline underline-offset-4">
                  Sign in here
                </Link>
              </p>

              <p className="text-[11px] text-ink-900/40 text-center mt-4 leading-relaxed">
                By creating an account you agree to our{' '}
                <Link href="/terms" className="underline hover:text-ink-900/70 transition-colors">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="underline hover:text-ink-900/70 transition-colors">Privacy Policy</Link>.
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-6 mt-5">
            <a href="mailto:info@brainstake.tech" className="text-[12px] text-ink-900/50 hover:text-ink-900/80 transition-colors">Need help?</a>
            <span className="text-ink-200">·</span>
            <a href="mailto:info@brainstake.tech" className="text-[12px] text-ink-900/50 hover:text-ink-900/80 transition-colors">Contact support</a>
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

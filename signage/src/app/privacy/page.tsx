import React from 'react';
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';

export const metadata = {
  title: 'Privacy Policy — Brainstake',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f6f4ef]">
      <header className="sticky top-0 z-50 bg-[#f6f4ef]/90 backdrop-blur-sm border-b border-[#ebe7dd]">
        <div className="px-6 py-4 flex items-center justify-between max-w-3xl mx-auto w-full">
          <Link href="/login">
            <BrandMark size="sm" />
          </Link>
          <Link href="/login" className="text-[13px] text-ink-900/50 hover:text-ink-900/80 transition-colors">
            ← Back to login
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-[28px] font-bold text-[#1a1a17] mb-1">Privacy Policy</h1>
        <p className="text-ink-900/40 text-[13px] mb-10">Last updated: April 2026</p>

        <Section title="1. Who We Are">
          <p>
            Brainstake (Private) Limited (&quot;Brainstake&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
            operates the Brainstake digital signage advertising platform. This Privacy Policy explains how
            we collect, use, store, and protect your personal information when you use our services.
          </p>
          <p>
            For any privacy-related enquiries, contact us at{' '}
            <a href="mailto:info@brainstake.tech" className="text-[#0f7b4a]">info@brainstake.tech</a>.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <p>We collect the following categories of information:</p>
          <ul>
            <li>
              <strong>Account information:</strong> your full name, email address, and password (stored
              as a secure hash) when you register.
            </li>
            <li>
              <strong>Booking and payment data:</strong> campaign details, selected screen locations,
              booking dates, payment method, payment reference, and proof-of-payment files you upload.
            </li>
            <li>
              <strong>Ad creative content:</strong> images and videos you upload for display on our
              screens.
            </li>
            <li>
              <strong>Device data:</strong> screen device identifiers, last-seen timestamps, and pairing
              information used to manage our display network.
            </li>
            <li>
              <strong>Usage data:</strong> pages visited, actions taken within the dashboard, and
              browser/device type collected automatically via server logs.
            </li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <p>We use your information to:</p>
          <ul>
            <li>Create and manage your account.</li>
            <li>Process and fulfil your advertising bookings and payments.</li>
            <li>Issue receipts and maintain financial records as required by law.</li>
            <li>Display your ads on the screens you have booked.</li>
            <li>Communicate with you about your account, bookings, payment status, and service updates.</li>
            <li>Detect, investigate, and prevent fraud or misuse of the Platform.</li>
            <li>Improve and develop our services.</li>
          </ul>
        </Section>

        <Section title="4. Legal Basis for Processing">
          <p>We process your personal data on the following legal grounds:</p>
          <ul>
            <li><strong>Contract performance:</strong> processing necessary to fulfil your bookings.</li>
            <li><strong>Legal obligation:</strong> retaining financial records as required by Zimbabwean
              tax and accounting law.</li>
            <li><strong>Legitimate interests:</strong> fraud prevention, platform security, and service
              improvement.</li>
            <li><strong>Consent:</strong> where you have given explicit consent, e.g. marketing
              communications (you may withdraw at any time).</li>
          </ul>
        </Section>

        <Section title="5. Data Sharing">
          <p>We do not sell your personal information. We may share it with:</p>
          <ul>
            <li>
              <strong>Service providers:</strong> cloud infrastructure and database providers (currently
              Supabase / AWS) who process data on our behalf under strict data processing agreements.
            </li>
            <li>
              <strong>Payment processors:</strong> only the minimum information required to verify a
              payment.
            </li>
            <li>
              <strong>Law enforcement or regulators:</strong> where required by applicable Zimbabwean
              law or a valid court order.
            </li>
          </ul>
        </Section>

        <Section title="6. Data Retention">
          <p>
            We retain your account and booking data for as long as your account is active, and for a
            minimum of 7 years thereafter for financial and legal compliance purposes. Ad creative files
            are deleted 90 days after the last booking using them has expired. You may request earlier
            deletion of non-financial data (see Section 8).
          </p>
        </Section>

        <Section title="7. Data Security">
          <p>
            We implement industry-standard security measures including encrypted storage, row-level
            access controls, HTTPS enforcement, and regular security audits. Access to customer data is
            restricted to authorised personnel only. Despite these measures, no system is completely
            immune to security risks and we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="8. Your Rights">
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access</strong> the personal data we hold about you.</li>
            <li><strong>Correct</strong> inaccurate or incomplete data.</li>
            <li><strong>Delete</strong> your personal data (subject to legal retention requirements).</li>
            <li><strong>Restrict</strong> processing of your data in certain circumstances.</li>
            <li><strong>Withdraw consent</strong> for any processing based on consent at any time.</li>
          </ul>
          <p>
            To exercise any of these rights, email us at{' '}
            <a href="mailto:info@brainstake.tech" className="text-[#0f7b4a]">info@brainstake.tech</a>.
            We will respond within 30 days.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            The Platform uses session cookies strictly necessary for authentication. We do not use
            tracking, advertising, or analytics cookies. You cannot opt out of session cookies as they
            are required for the Platform to function.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Material changes will be communicated
            via email to the address on your account. The updated policy will also be published on this
            page with a revised &quot;last updated&quot; date.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            For any questions or concerns about this Privacy Policy or how we handle your data, contact
            us at{' '}
            <a href="mailto:info@brainstake.tech" className="text-[#0f7b4a]">info@brainstake.tech</a>.
          </p>
        </Section>
      </article>

      <footer className="border-t border-[#ebe7dd] py-8 text-center text-[12px] text-ink-900/40">
        <div className="flex items-center justify-center gap-4">
          <span>© {new Date().getFullYear()} Brainstake (Private) Limited</span>
          <span>·</span>
          <Link href="/terms" className="hover:text-ink-900/70 transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-[17px] font-semibold text-[#1a1a17] mb-3">{title}</h2>
      <div className="text-[14px] text-ink-900/70 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

import React from 'react';
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';

export const metadata = {
  title: 'Terms of Service — Brainstake',
};

export default function TermsPage() {
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

      <article className="max-w-3xl mx-auto px-6 py-14 prose prose-stone prose-sm sm:prose-base">
        <h1 className="text-[28px] font-bold text-[#1a1a17] mb-1">Terms of Service</h1>
        <p className="text-ink-900/40 text-[13px] mb-10">Last updated: April 2026</p>

        <Section title="1. Introduction">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Brainstake digital
            signage platform (&quot;Platform&quot;), operated by Brainstake (Private) Limited
            (&quot;Brainstake&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By registering an account or
            placing a booking, you agree to be bound by these Terms in full. If you do not agree, do not use
            the Platform.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be at least 18 years old and have the legal authority to enter into a binding contract
            on behalf of yourself or the organisation you represent. By using the Platform you warrant that
            you meet these requirements.
          </p>
        </Section>

        <Section title="3. Account Registration">
          <p>
            You are responsible for maintaining the confidentiality of your login credentials. You agree to
            notify us immediately at{' '}
            <a href="mailto:info@brainstake.tech" className="text-[#0f7b4a]">info@brainstake.tech</a>{' '}
            if you suspect unauthorised access to your account. Brainstake is not liable for any loss arising
            from your failure to keep credentials secure.
          </p>
        </Section>

        <Section title="4. Advertising Bookings">
          <ul>
            <li>
              Bookings are made through the Platform dashboard. Each booking specifies the screen location,
              campaign duration, daily slot count, and ad duration (15, 30, or 60 seconds per slot).
            </li>
            <li>
              A booking is not confirmed until payment has been submitted and approved by our accounts team.
              We reserve the right to reject any booking at our discretion.
            </li>
            <li>
              Approved bookings will be scheduled and displayed on the agreed screen(s) during the agreed
              dates and operating hours.
            </li>
            <li>
              Brainstake does not guarantee uninterrupted display due to factors outside our control
              (power outages, connectivity disruptions, hardware failure). We will make reasonable efforts
              to compensate for significant lost airtime at our discretion.
            </li>
          </ul>
        </Section>

        <Section title="5. Payment">
          <ul>
            <li>
              All prices are quoted in United States Dollars (USD) unless otherwise stated. Payment must be
              made in full before a campaign goes live.
            </li>
            <li>
              Accepted payment methods include EcoCash, bank transfer, OneMoney, cash, and other methods
              listed at checkout. Proof of payment must be uploaded via the Platform.
            </li>
            <li>
              Payments are reviewed and approved by our accounts team within 1–2 business days. Campaigns
              will not run until payment is confirmed.
            </li>
            <li>
              Prices are subject to change at any time. Price changes do not affect bookings that have
              already been approved and paid.
            </li>
          </ul>
        </Section>

        <Section title="6. Cancellations and Refunds">
          <ul>
            <li>
              Cancellation requests must be submitted in writing to{' '}
              <a href="mailto:info@brainstake.tech" className="text-[#0f7b4a]">info@brainstake.tech</a>{' '}
              at least 5 business days before the campaign start date.
            </li>
            <li>
              Cancellations made 5 or more business days before start: full refund minus a 10%
              administrative fee.
            </li>
            <li>
              Cancellations made fewer than 5 business days before start, or after a campaign has begun:
              no refund will be issued.
            </li>
            <li>
              Refunds, where applicable, will be processed within 10 business days via the original
              payment method.
            </li>
          </ul>
        </Section>

        <Section title="7. Advertising Content Policy">
          <p>You warrant that all content you submit for display:</p>
          <ul>
            <li>Is truthful, accurate, and not misleading.</li>
            <li>Does not infringe any third-party intellectual property rights.</li>
            <li>Does not contain explicit, offensive, defamatory, or illegal material.</li>
            <li>Complies with all applicable Zimbabwean laws and regulations, including the
              Broadcasting Services Act and Consumer Protection Act.</li>
            <li>Does not advertise tobacco, alcohol to minors, illegal substances, or any
              product or service prohibited by law.</li>
          </ul>
          <p>
            Brainstake reserves the right to remove or refuse any content that violates this policy,
            without refund, and may suspend or terminate accounts that repeatedly breach these rules.
          </p>
        </Section>

        <Section title="8. Emergency Broadcasts">
          <p>
            Brainstake reserves the right to interrupt scheduled advertising to display emergency or
            public-interest broadcasts without notice or compensation. These interruptions will be kept
            to the minimum duration necessary.
          </p>
        </Section>

        <Section title="9. Intellectual Property">
          <p>
            You retain ownership of the creative content you upload. By submitting content to the
            Platform you grant Brainstake a non-exclusive, royalty-free licence to display that content
            on the agreed screens for the booked period. This licence ends when the booking period expires
            or the content is removed.
          </p>
          <p>
            All Platform software, design, trademarks, and branding are the exclusive property of
            Brainstake (Private) Limited. You may not copy, reproduce, or use them without written
            permission.
          </p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, Brainstake&apos;s total liability to you for any claim
            arising out of or in connection with these Terms or your use of the Platform shall not exceed
            the amount you paid for the specific booking giving rise to the claim.
          </p>
          <p>
            Brainstake is not liable for indirect, incidental, special, or consequential damages including
            loss of profit, loss of data, or reputational damage, even if we have been advised of the
            possibility of such damages.
          </p>
        </Section>

        <Section title="11. Termination">
          <p>
            We may suspend or terminate your account at any time if you breach these Terms, attempt to
            abuse the Platform, or engage in conduct that is harmful to Brainstake or other users.
            On termination, any pending campaigns will be cancelled and prepaid amounts refunded on a
            pro-rata basis for any unserved days, at our discretion.
          </p>
        </Section>

        <Section title="12. Changes to These Terms">
          <p>
            We may update these Terms from time to time. Material changes will be notified via email to
            the address on your account. Continued use of the Platform after changes take effect
            constitutes your acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="13. Governing Law">
          <p>
            These Terms are governed by the laws of Zimbabwe. Any dispute arising under these Terms
            shall be subject to the exclusive jurisdiction of the courts of Zimbabwe.
          </p>
        </Section>

        <Section title="14. Contact">
          <p>
            Questions about these Terms? Contact us at{' '}
            <a href="mailto:info@brainstake.tech" className="text-[#0f7b4a]">info@brainstake.tech</a>.
          </p>
        </Section>
      </article>

      <footer className="border-t border-[#ebe7dd] py-8 text-center text-[12px] text-ink-900/40">
        <div className="flex items-center justify-center gap-4">
          <span>© {new Date().getFullYear()} Brainstake (Private) Limited</span>
          <span>·</span>
          <Link href="/privacy" className="hover:text-ink-900/70 transition-colors">Privacy Policy</Link>
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

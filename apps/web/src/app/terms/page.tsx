import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <Link href="/" className="text-[#0FACED] text-sm mb-8 block hover:underline">
        ← Back to ConPaws
      </Link>
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-slate-400 text-sm mb-10">Last updated: March 17, 2026</p>

      <div className="flex flex-col gap-8 text-slate-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
          <p>
            By downloading or using ConPaws, you agree to these Terms of Service. If you do
            not agree, please do not use the app.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">2. Use of the App</h2>
          <p>
            ConPaws is provided for personal, non-commercial use. You may use it to import
            and manage convention schedules for yourself. You may not reverse engineer,
            redistribute, or use the app for commercial purposes without written permission.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">3. iCal Content</h2>
          <p>
            Convention schedule data imported into ConPaws belongs to the respective convention
            organizers. ConPaws does not claim ownership of imported schedule data. We are not
            responsible for the accuracy or availability of third-party schedule data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">4. ConPaws+ Subscriptions</h2>
          <p>
            Premium features (&quot;ConPaws+&quot;) are available via in-app subscription through the
            Apple App Store or Google Play Store. Subscription terms, pricing, and refund
            policies are governed by Apple/Google&apos;s standard terms. Cancel anytime via your
            device&apos;s subscription settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">5. Disclaimer of Warranties</h2>
          <p>
            ConPaws is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
            that the app will be error-free or available at all times. Convention schedule
            data is sourced from third parties and may be incomplete or inaccurate.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">6. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, ConPaws and its developers shall not be
            liable for any indirect, incidental, or consequential damages arising from your
            use of the app.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">7. Changes to Terms</h2>
          <p>
            We may update these terms from time to time. Continued use of the app after
            changes constitutes acceptance of the new terms. Material changes will be
            communicated via app update notes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">8. Contact</h2>
          <p>
            Questions?{' '}
            <a href="mailto:hello@conpaws.com" className="text-[#0FACED] hover:underline">
              hello@conpaws.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <Link href="/" className="text-[#0FACED] text-sm mb-8 block hover:underline">
        ← Back to ConPaws
      </Link>
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-slate-400 text-sm mb-10">Last updated: March 17, 2026</p>

      <div className="flex flex-col gap-8 text-slate-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">1. Data We Collect</h2>
          <p>
            ConPaws is a local-first app. Convention schedules, events, and your personal
            schedule are stored exclusively on your device using SQLite. We do not transmit
            this data to any server.
          </p>
          <p className="mt-2">
            If you sign up for the beta waitlist on our website, we collect your name and
            email address to send you a launch notification. We use Brevo to manage this list.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">2. Data We Do NOT Collect</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Your convention attendance history</li>
            <li>Your personal schedule or saved events</li>
            <li>Device identifiers or location data</li>
            <li>Analytics or crash data (Phase 1)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">3. Third-Party Services</h2>
          <p>
            <strong className="text-white">RevenueCat</strong> — used for in-app subscription
            management (ConPaws+ features). RevenueCat may collect purchase receipts and
            subscription status. See their privacy policy at revenuecat.com.
          </p>
          <p className="mt-2">
            <strong className="text-white">Supabase</strong> — used for optional account sync
            (Phase 2+). If you create an account, your profile and schedule are synced to our
            self-hosted Supabase instance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">4. Push Notifications</h2>
          <p>
            If you enable event reminders, notifications are scheduled locally on your device
            via expo-notifications. No notification data is sent to our servers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">5. Children&apos;s Privacy</h2>
          <p>
            ConPaws is not directed to children under 13. We do not knowingly collect personal
            information from children.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">6. Contact Us</h2>
          <p>
            Questions? Email us at{' '}
            <a href="mailto:hello@conpaws.com" className="text-[#0FACED] hover:underline">
              hello@conpaws.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}

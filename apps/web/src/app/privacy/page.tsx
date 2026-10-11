import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Veyra',
  description: 'How Veyra handles your data — no tracking, no accounts.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-surface/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-xs text-primary uppercase tracking-widest font-bold mb-2">Legal</p>
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
          <p className="text-on-surface-variant text-sm mt-2">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8 text-on-surface-variant leading-relaxed text-sm">

        <div className="bg-surface border border-primary/20 rounded-xl p-5">
          <p className="text-primary font-bold mb-1">Our bottom line on privacy</p>
          <p>Veyra does not collect, store, or share any personal data. There is no account system.
          No analytics trackers. No cookies. You use it anonymously.</p>
        </div>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">1. No Personal Data Collected</h2>
          <p>
            Veyra does not require you to create an account, sign in, or provide any
            personal information. We have no way to identify you.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">2. Local Device Data</h2>
          <p>
            Veyra stores your watch progress locally on your device using the browser&apos;s
            local storage. This data is stored exclusively on your device and is never
            transmitted to our servers.
          </p>
          <p className="mt-3">
            You can clear this data at any time by clearing your browser&apos;s site data
            or using the &ldquo;Clear Progress&rdquo; option in the app settings.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">3. Third-Party Services</h2>
          <p>
            Veyra fetches movie metadata from TMDB (The Movie Database). Their privacy
            practices are governed by{' '}
            <a href="https://www.themoviedb.org/privacy-policy" target="_blank" rel="noopener noreferrer"
               className="text-primary hover:underline">
              TMDB&apos;s Privacy Policy
            </a>.
          </p>
          <p className="mt-3">
            For streaming and downloads, content is accessed from publicly available
            sources via yt-dlp. Veyra does not control and is not responsible for the
            privacy practices of those external sources.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">4. No Analytics or Tracking</h2>
          <p>
            Veyra does not use any analytics, tracking pixels, or third-party services
            that collect data about your usage.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">5. Data Security</h2>
          <p>
            Since we collect no personal data, there is no centralized database of user
            information that could be breached. Local data on your device is protected
            by your device&apos;s own security controls.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">6. Changes to This Policy</h2>
          <p>
            If we make any changes to this Privacy Policy, we will update the date at the
            top of this page. Continued use of the Service constitutes acceptance of
            any updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">7. Contact</h2>
          <p>
            For privacy concerns, open an issue on our GitHub repository.
          </p>
        </section>

      </div>
    </div>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Veyra',
  description: 'Read the Terms of Service for using Veyra.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-surface/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-xs text-primary uppercase tracking-widest font-bold mb-2">Legal</p>
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
          <p className="text-on-surface-variant text-sm mt-2">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8 text-on-surface-variant leading-relaxed text-sm">

        <section>
          <h2 className="text-white font-bold text-lg mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Veyra (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service.
            If you do not agree to these terms, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">2. No Account Required</h2>
          <p>
            Veyra is provided free of charge and does not require you to create an account,
            sign up, or provide any personal information. You may use the Service anonymously.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">3. Service Description</h2>
          <p>
            Veyra provides a browsing and discovery interface for movies and series,
            powered by publicly available metadata from TMDB. The Service allows you to
            stream or download content from publicly available YouTube sources using the
            open-source yt-dlp tool.
          </p>
          <p className="mt-3">
            <strong className="text-white">Download feature:</strong> When you initiate a download,
            Veyra streams content from publicly available sources on your behalf. You are
            responsible for ensuring that downloading any content complies with applicable
            laws in your jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">4. Content and Metadata</h2>
          <p>
            All movie and series information (titles, descriptions, posters, ratings) is
            sourced from TMDB (&ldquo;The Movie Database&rdquo;). Veyra does not host, store,
            or own any of this content.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">5. Disclaimer of Warranties</h2>
          <p>
            Veyra is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties
            of any kind, express or implied. We do not guarantee that the Service will be
            uninterrupted, secure, or error-free.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">6. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Veyra and its operators shall not be
            liable for any indirect, incidental, special, or consequential damages arising
            from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">7. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of the Service after any
            changes constitutes acceptance of the new Terms.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">8. Contact</h2>
          <p>
            If you have any questions about these Terms, please reach out via the
            Help Center or open an issue on our GitHub repository.
          </p>
        </section>

      </div>
    </div>
  );
}

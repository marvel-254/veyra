import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Veyra',
  description: 'Terms of Service for Veyra. Veyra is provided as-is for personal use.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
          <a href="/" className="text-xl font-extrabold text-primary tracking-tight">
            Veyra
          </a>
          <a href="/" className="text-sm font-semibold text-on-surface-variant hover:text-white transition-colors">
            ← Back
          </a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">Legal</p>
        <h1 className="text-4xl font-extrabold text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-on-surface-variant mb-10">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="space-y-8 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-white font-bold text-base mb-2">1. Acceptance of Terms</h2>
            <p>
              By downloading, installing, or using Veyra (&ldquo;the Application&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the Application.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">2. Nature of the Application</h2>
            <p>
              Veyra is a free, open-source Android application. The Application provides access to movie and series metadata sourced from The Movie Database (TMDB) and facilitates playback of media streams. Veyra does not host, store, or distribute any copyrighted media content.
            </p>
            <p className="mt-3">
              You are solely responsible for ensuring that your use of the Application complies with applicable laws in your jurisdiction. Veyra is provided for personal, lawful use only.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">3. No Warranty</h2>
            <p>
              The Application is provided &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement. The developers of Veyra make no guarantee that the Application will be error-free, uninterrupted, or secure.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">4. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, the developers of Veyra shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the Application.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">5. Third-Party Services</h2>
            <p>
              The Application uses third-party services, including TMDB for metadata. Your use of TMDB is governed by{' '}
              <a
                href="https://www.themoviedb.org/documentation/api/terms-of-use"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                TMDB&apos;s Terms of Use
              </a>
              . The Application may also connect to third-party streaming or media sources; any content accessed through such sources is governed by the respective third party&apos;s terms.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">6. Open Source</h2>
            <p>
              Veyra is open-source software released under the MIT License. The source code is available on GitHub. You are encouraged to review, audit, and fork the codebase.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">7. Changes to Terms</h2>
            <p>
              These Terms may be updated from time to time. Continued use of the Application after any changes constitutes your acceptance of the revised Terms. The most current version of these Terms will always be available at <a href="/terms" className="text-primary hover:underline">veyra.app/terms</a>.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">8. Contact</h2>
            <p>
              For questions about these Terms, please open an issue on{' '}
              <a
                href="https://github.com/marvel-254/veyra"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub
              </a>{' '}
              or visit the <a href="/help" className="text-primary hover:underline">Help page</a>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="text-lg font-extrabold text-primary">Veyra</a>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href="/privacy" className="text-xs text-on-surface-variant hover:text-white transition-colors">Privacy Policy</a>
            <a href="/help" className="text-xs text-on-surface-variant hover:text-white transition-colors">Help &amp; FAQ</a>
            <a href="/releases" className="text-xs text-on-surface-variant hover:text-white transition-colors">Releases</a>
          </nav>
          <p className="text-xs text-on-surface-variant">&copy; {new Date().getFullYear()} Veyra</p>
        </div>
      </footer>
    </div>
  );
}

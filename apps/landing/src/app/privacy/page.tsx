import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Veyra',
  description: 'Privacy Policy for Veyra. No account, no tracking, no data collection.',
};

export default function PrivacyPage() {
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
        <h1 className="text-4xl font-extrabold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-on-surface-variant mb-10">
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div className="space-y-8 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-white font-bold text-base mb-2">1. Overview</h2>
            <p>
              Veyra (&ldquo;the Application&rdquo;) is designed with privacy as a core principle. The Application
              does not require an account, does not collect personal data, and does not use any
              analytics or tracking services. This Privacy Policy explains what data, if any, is
              processed when you use Veyra.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">2. No Account Required</h2>
            <p>
              Veyra does not have a login or signup flow of any kind. There are no servers that store
              your identity, preferences, or viewing history on our infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">3. No Analytics or Tracking</h2>
            <p>
              Veyra does not use Firebase Analytics, Google Analytics, or any other telemetry or
              tracking service. The Application does not transmit any usage data to any server.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">4. TMDB API</h2>
            <p>
              When you browse movies or series, the Application fetches metadata (titles, posters,
              descriptions, ratings) from The Movie Database (TMDB). Your use of TMDB is governed
              by{' '}
              <a
                href="https://www.themoviedb.org/documentation/api/terms-of-use"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                TMDB&apos;s Terms of Use
              </a>{' '}
              and{' '}
              <a
                href="https://www.themoviedb.org/documentation/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Privacy Policy
              </a>
              . We do not share any personal data with TMDB beyond what the Application naturally
              transmits when making a standard API request.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">5. Media Streaming</h2>
            <p>
              Media playback is handled by the Application using standard Android media components.
              Content streamed through the Application is sourced from publicly available third-party
              sources. Veyra does not log, store, or monitor your streaming activity on any server.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">6. Downloads &amp; Local Storage</h2>
            <p>
              Any media files you download are stored exclusively on your device&apos;s local storage.
              Veyra has no access to, and does not transmit, the contents of downloaded files.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">7. Permissions</h2>
            <p>
              Veyra requests the following Android permissions:
            </p>
            <ul className="mt-3 space-y-2 pl-5 list-disc">
              <li>
                <strong className="text-white">Internet</strong> — required to fetch TMDB metadata and stream media.
              </li>
              <li>
                <strong className="text-white">Storage</strong> — required to save downloaded media to your device.
              </li>
              <li>
                <strong className="text-white">Install Unknown Apps</strong> — required for self-update via APK.
              </li>
            </ul>
            <p className="mt-3">
              No other permissions are requested. Veyra does not access your contacts, camera,
              microphone, or location.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">8. Open-Source Transparency</h2>
            <p>
              Veyra is open-source software. You can audit the complete source code on{' '}
              <a
                href="https://github.com/marvel-254/veyra"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub
              </a>{' '}
              to verify that no hidden data collection occurs.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">9. Changes to This Policy</h2>
            <p>
              If this Privacy Policy changes, the updated version will be posted at{' '}
              <a href="/privacy" className="text-primary hover:underline">veyra.app/privacy</a>. Any
              material changes will be noted with an updated &ldquo;Last updated&rdquo; date.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-base mb-2">10. Contact</h2>
            <p>
              Questions about this Privacy Policy can be directed via{' '}
              <a
                href="https://github.com/marvel-254/veyra"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub Issues
              </a>{' '}
              or our <a href="/help" className="text-primary hover:underline">Help page</a>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="text-lg font-extrabold text-primary">Veyra</a>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href="/terms" className="text-xs text-on-surface-variant hover:text-white transition-colors">Terms of Service</a>
            <a href="/help" className="text-xs text-on-surface-variant hover:text-white transition-colors">Help &amp; FAQ</a>
            <a href="/releases" className="text-xs text-on-surface-variant hover:text-white transition-colors">Releases</a>
          </nav>
          <p className="text-xs text-on-surface-variant">&copy; {new Date().getFullYear()} Veyra</p>
        </div>
      </footer>
    </div>
  );
}
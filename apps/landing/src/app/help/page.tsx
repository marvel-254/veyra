import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help & FAQ — Veyra',
  description: 'Installation guides, troubleshooting, and frequently asked questions about Veyra.',
};

const INSTALL_GUIDE = [
  {
    title: 'Step 1 — Download the APK',
    body: 'Go to veyra.app/releases and download the latest APK (veyra-app-debug.apk or veyra-app-release.apk). Tap the download button in your browser, then confirm the download.',
  },
  {
    title: 'Step 2 — Allow unknown apps',
    body: 'On Android 8.0+: Go to Settings → Apps → Special access → Install unknown apps. Select your browser (Chrome, Firefox, etc.) and enable "Allow from this source".\n\nOn Android 7.x: Go to Settings → Security → Unknown sources and toggle it on.',
  },
  {
    title: 'Step 3 — Install',
    body: 'Open your Downloads folder (or wherever the file was saved). Tap the Veyra APK file. Android will show a security warning — tap "Install anyway". Wait for the installation to complete.',
  },
  {
    title: 'Step 4 — Launch & use',
    body: 'Tap "Open" when installation finishes. Veyra will open to the home screen. Browse or search for movies and series. Tap a title to see details, stream a trailer, or download for offline playback.',
  },
];

const TROUBLESHOOTING = [
  {
    problem: '"App not installed" error',
    solution:
      'This usually means the APK signature conflicts with a previously installed version. Uninstall the existing Veyra app first (Settings → Apps → Veyra → Uninstall), then retry. Note: uninstalling will not affect any downloaded media files stored in Veyra\'s folder.',
  },
  {
    problem: '"Install blocked — unknown apps" prompt',
    solution:
      'You haven\'t enabled the unknown apps permission yet. Go to Settings → Apps → Special access → Install unknown apps and allow your browser or file manager. See Step 2 above.',
  },
  {
    problem: '"Parse error" or APK won\'t open',
    solution:
      'The APK may have been corrupted during download. Try downloading again from veyra.app/releases. If the problem persists, check that your device meets the minimum requirement: Android 7.0 (API 24).',
  },
  {
    problem: 'App crashes on launch',
    solution:
      'Make sure your Android version is 7.0 or newer. Clear the app\'s cache (Settings → Apps → Veyra → Storage → Clear cache) and try again. If the issue persists, download the latest release from the Releases page.',
  },
  {
    problem: 'No movies or series appearing',
    solution:
      'Veyra requires an internet connection to fetch metadata from TMDB. Check that Wi-Fi or mobile data is enabled. If you\'re on a VPN, try disabling it — some VPNs block TMDB\'s API endpoints.',
  },
  {
    problem: 'Download fails or is stuck at 0%',
    solution:
      'Check that your device has sufficient storage space. Some security apps or ad blockers may interfere with downloads. Temporarily disable them and try again. Restarting the app and router can also help.',
  },
];

const FAQS = [
  {
    question: 'Is Veyra safe to install?',
    answer:
      'Yes. Veyra is open-source and the APK is built by GitHub Actions from the public source code. You can verify the build by inspecting the workflow at .github/workflows/build-apk.yml. Always download from veyra.app/releases or the official GitHub Releases page.',
  },
  {
    question: 'Why is there no Play Store version?',
    answer:
      'Publishing on the Play Store costs $25, requires Google Play Services, and subjects the app to Play Store content policies. Veyra sidesteps all of this by distributing directly as an APK. This is the intended distribution model.',
  },
  {
    question: 'Does Veyra work on iOS?',
    answer:
      'No. Currently Veyra is Android-only. The web version is available at veyra.app for any browser. iOS builds are not currently planned but contributions are welcome.',
  },
  {
    question: 'Can I update Veyra without reinstalling?',
    answer:
      'The current version does not have in-app auto-update. To update, download the latest APK from veyra.app/releases and install it over the existing version. Uninstalling first is recommended to avoid signature conflicts.',
  },
  {
    question: 'What are the debug and release APKs?',
    answer:
      'The debug APK is built for development and testing. The release APK is optimized, minified, and signed with a release key — use this one for normal use. Both are functionally identical for end users.',
  },
  {
    question: 'Where can I report bugs or request features?',
    answer:
      'Open an issue on the GitHub repository: https://github.com/marvel-254/veyra/issues. Please search existing issues first to avoid duplicates.',
  },
  {
    question: 'Does Veyra contain ads?',
    answer:
      'No. The app itself contains no ads and no in-app purchases. The streaming sources themselves are third-party and may contain their own ads; those are outside Veyra\'s control.',
  },
];

export default function HelpPage() {
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
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">Support</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3">
            Help &amp; FAQ
          </h1>
          <p className="text-on-surface-variant">
            Installation guides, troubleshooting tips, and answers to common questions.
          </p>
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap gap-3 mb-12">
          <a
            href="/releases"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Latest APK
          </a>
          <a
            href="https://github.com/marvel-254/veyra/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-surface border border-white/10 text-on-surface px-5 py-2.5 rounded-xl font-bold text-sm hover:border-white/30 transition-all"
          >
            Report an Issue →
          </a>
        </div>

        {/* Installation Guide */}
        <section className="mb-14">
          <h2 className="text-2xl font-extrabold text-white mb-6">Installation Guide</h2>
          <div className="space-y-4">
            {INSTALL_GUIDE.map((step, i) => (
              <div
                key={i}
                className="bg-surface border border-white/5 rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-extrabold text-sm">
                    {i + 1}
                  </span>
                  <h3 className="text-white font-bold">{step.title}</h3>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line pl-10">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-on-surface-variant text-center">
            Minimum requirement: Android 7.0 (API 24) —{' '}
            <a
              href="https://developer.android.com/studio/releases/platforms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Check your Android version →
            </a>
          </p>
        </section>

        {/* Troubleshooting */}
        <section className="mb-14">
          <h2 className="text-2xl font-extrabold text-white mb-6">Troubleshooting</h2>
          <div className="space-y-3">
            {TROUBLESHOOTING.map((item, i) => (
              <details
                key={i}
                className="bg-surface border border-white/5 rounded-xl group"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer p-5 text-white font-semibold select-none list-none">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d0bcff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {item.problem}
                  </span>
                  <span className="flex-shrink-0 text-primary transition-transform group-open:rotate-45 text-lg">
                    +
                  </span>
                </summary>
                <div className="px-5 pb-5 text-sm text-on-surface-variant leading-relaxed border-t border-white/5 pt-4">
                  {item.solution}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="text-2xl font-extrabold text-white mb-6">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details
                key={i}
                className="bg-surface border border-white/5 rounded-xl group"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer p-5 text-white font-semibold select-none list-none">
                  {faq.question}
                  <span className="flex-shrink-0 text-primary transition-transform group-open:rotate-45 text-lg">
                    +
                  </span>
                </summary>
                <div className="px-5 pb-5 text-sm text-on-surface-variant leading-relaxed border-t border-white/5 pt-4">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="bg-surface border border-white/5 rounded-xl p-6 text-center">
          <h2 className="text-lg font-bold text-white mb-2">Still need help?</h2>
          <p className="text-sm text-on-surface-variant mb-4">
            Open a GitHub Issue and the community or maintainers will help you out.
          </p>
          <a
            href="https://github.com/marvel-254/veyra/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Open an Issue on GitHub →
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="text-lg font-extrabold text-primary">Veyra</a>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href="/terms" className="text-xs text-on-surface-variant hover:text-white transition-colors">Terms of Service</a>
            <a href="/privacy" className="text-xs text-on-surface-variant hover:text-white transition-colors">Privacy Policy</a>
            <a href="/releases" className="text-xs text-on-surface-variant hover:text-white transition-colors">Releases</a>
          </nav>
          <p className="text-xs text-on-surface-variant">&copy; {new Date().getFullYear()} Veyra</p>
        </div>
      </footer>
    </div>
  );
}
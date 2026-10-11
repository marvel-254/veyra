import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Veyra — Free Movies & Series, No Account Needed',
  description:
    'Download Veyra for Android. Stream trailers or download full movies and series to your device — completely free, no account needed. TMDB-powered metadata.',
  keywords: ['Veyra', 'movies', 'series', 'download', 'android', 'free', 'streaming'],
  openGraph: {
    title: 'Veyra — Free Movies & Series',
    description: 'Stream or download movies and series on Android. Free forever, no login.',
    type: 'website',
    siteName: 'Veyra',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Veyra — Free Movies & Series',
    description: 'Stream or download movies and series on Android. Free forever, no login.',
  },
};

async function getLatestRelease() {
  const GH_TOKEN = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = GH_TOKEN
    ? { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' }
    : { Accept: 'application/vnd.github+json' };

  try {
    const res = await fetch(
      'https://api.github.com/repos/marvel-254/veyra/releases/latest',
      { headers, next: { revalidate: 3600 } }
    );
    if (res.ok) return res.json();
  } catch {
    // fallback: return null
  }
  return null;
}

const FEATURES = [
  {
    title: 'Stream & Download',
    description:
      'Watch trailers online or download full movies and series directly to your device. Offline viewing, no buffering.',
    icon: '▶',
  },
  {
    title: 'No Account Required',
    description:
      'No signup, no login, no Firebase, no Google sign-in. Open the app and start watching immediately.',
    icon: '🔓',
  },
  {
    title: 'TMDB-Powered Metadata',
    description:
      'Beautiful movie posters, synopses, ratings, and cast info — all sourced from The Movie Database (TMDB).',
    icon: '🎬',
  },
  {
    title: 'Free Forever',
    description:
      'No subscriptions, no ads in the app, no premium tiers. Veyra is and always will be completely free.',
    icon: '∞',
  },
];

const INSTALL_STEPS = [
  {
    step: 1,
    title: 'Download the APK',
    description:
      'Tap the download button above. The APK is signed and hosted securely on GitHub Releases.',
  },
  {
    step: 2,
    title: 'Enable Unknown Sources',
    description:
      "Go to Settings → Apps → Veyra → Install unknown apps (or Settings → Security → Unknown sources on older Android). Toggle it on for your browser or file manager.",
  },
  {
    step: 3,
    title: 'Install the APK',
    description:
      "Open the downloaded file. Android will prompt you to install — tap Install, then Open when done.",
  },
  {
    step: 4,
    title: 'Start Watching',
    description:
      'Launch Veyra from your app drawer. Browse movies or series, stream trailers, or download for offline playback.',
  },
];

const FAQS = [
  {
    question: 'Is sideloading Veyra safe?',
    answer:
      'Yes. The APK is built by GitHub Actions from verified source code and signed with a release key. You can verify the SHA-256 checksum on the Releases page before installing.',
  },
  {
    question: 'Why is Veyra not on the Google Play Store?',
    answer:
      "Veyra is free and open-source. Publishing on the Play Store requires a $25 fee, Google Play Services, and Play Store compliance policies. Veyra avoids all of that — sideloading is by design.",
  },
  {
    question: 'Do I need to create an account?',
    answer:
      'No. Veyra has zero authentication. There is no login screen, no signup, and no data collection. Your privacy is protected by design.',
  },
  {
    question: 'What Android version do I need?',
    answer:
      'Veyra requires Android 7.0 (API level 24) or newer. Most Android devices released after 2016 are supported.',
  },
  {
    question: 'How large is the app?',
    answer:
      'The APK is approximately 30–50 MB. The app will download movie and series data on demand; downloaded media is stored on your device storage.',
  },
  {
    question: 'Is there a desktop version?',
    answer:
      'Currently Veyra is Android-only. The web app (https://veyra.app) runs in any browser. Future desktop builds are planned.',
  },
];

const FOOTER_LINKS = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/help', label: 'Help & FAQ' },
  { href: 'https://github.com/marvel-254/veyra/releases', label: 'Releases' },
  { href: 'https://github.com/marvel-254/veyra', label: 'Source Code' },
];

export default async function LandingPage() {
  const latestRelease = await getLatestRelease();

  // Resolve direct APK URL when available
  const debugApk = latestRelease?.assets?.find((a: any) => a.name === 'veyra-app-debug.apk');
  const releaseApk = latestRelease?.assets?.find((a: any) => a.name === 'veyra-app-release.apk');

  const primaryDownloadHref = debugApk?.browser_download_url || '/releases';
  const primaryDownloadLabel = debugApk ? 'Download APK (Debug)' : 'View All Releases';

  const version = latestRelease?.tag_name
    ? `v${latestRelease.tag_name.replace('v', '')}`
    : null;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <span className="text-xl font-extrabold text-primary tracking-tight">Veyra</span>
          <div className="flex items-center gap-6">
            <a
              href="/releases"
              className="text-sm font-semibold text-on-surface-variant hover:text-white transition-colors"
            >
              Changelog
            </a>
            <a
              href="https://github.com/marvel-254/veyra"
              className="text-sm font-semibold text-on-surface-variant hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-[600px] h-[600px] rounded-full opacity-10"
            style={{
              background:
                'radial-gradient(circle, #d0bcff 0%, transparent 70%)',
            }}
          />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary mb-4 opacity-80">
            Free · No Account · Android 7.0+
          </p>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-[1.05] tracking-tight">
            Movies & Series.{' '}
            <span className="text-primary">Free Forever.</span>
          </h1>
          <p className="text-lg md:text-xl text-on-surface-variant mb-10 leading-relaxed max-w-xl mx-auto">
            A premium cinematic experience. Stream trailers or download full movies and series to your
            device. No login, no subscriptions, no tracking.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={primaryDownloadHref}
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded-xl font-bold text-base hover:opacity-90 shadow-2xl shadow-primary/30 transition-all transform hover:scale-105"
            >
              {debugApk ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              )}
              {debugApk ? 'Download APK' : primaryDownloadLabel}
            </a>
            <a
              href="/releases"
              className="inline-flex items-center gap-2 border border-white/20 text-on-surface px-8 py-4 rounded-xl font-semibold text-base hover:bg-white/5 transition-all"
            >
              View Changelog
            </a>
          </div>

          <div className="mt-6 flex items-center gap-3 justify-center flex-wrap">
            {version && (
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-on-surface-variant bg-surface px-3 py-1 rounded-full border border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {version}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-on-surface-variant bg-surface px-3 py-1 rounded-full border border-white/5">
              Android 7.0+ / API 24+
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-on-surface-variant bg-surface px-3 py-1 rounded-full border border-white/5">
              TMDB Metadata
            </span>
          </div>
        </div>

        {/* Bottom fade into next section */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              Everything you need.{' '}
              <span className="text-primary">Nothing you don&apos;t.</span>
            </h2>
            <p className="text-on-surface-variant max-w-lg mx-auto">
              Built for movie lovers who want freedom and privacy, not another subscription to manage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-surface border border-white/5 rounded-2xl p-6 hover:border-primary/20 transition-colors"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Install Steps ────────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              Install in minutes.
            </h2>
            <p className="text-on-surface-variant">
              No Play Store needed. Just download, allow unknown sources, and go.
            </p>
          </div>

          <div className="space-y-6">
            {INSTALL_STEPS.map((s) => (
              <div key={s.step} className="flex gap-5 items-start bg-surface border border-white/5 rounded-xl p-5">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-extrabold text-sm">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">{s.title}</h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-surface border border-white/5 rounded-xl p-5 text-center">
            <p className="text-sm text-on-surface-variant">
              <span className="text-primary font-bold">Android 7.0 (API 24)</span> or newer required.{' '}
              <a
                href="https://developer.android.com/studio/releases/platforms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white transition-colors"
              >
                Check your Android version →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              Frequently asked questions.
            </h2>
          </div>

          <div className="space-y-4">
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
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            Ready to watch?
          </h2>
          <p className="text-on-surface-variant mb-8">
            Free forever. No account. Download now.
          </p>
          <a
            href={primaryDownloadHref}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded-xl font-bold text-base hover:opacity-90 shadow-2xl shadow-primary/30 transition-all transform hover:scale-105"
          >
            {debugApk ? 'Download APK' : 'View Releases'}
          </a>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold text-primary">Veyra</span>
            <span className="text-xs text-on-surface-variant">
              — Free movies & series on Android
            </span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs text-on-surface-variant hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <p className="text-xs text-on-surface-variant">
            &copy; {new Date().getFullYear()} Veyra
          </p>
        </div>
      </footer>
    </div>
  );
}

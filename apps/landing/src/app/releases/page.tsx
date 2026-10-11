import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Releases — Veyra',
  description:
    'Download Veyra APK releases. Every version includes checksums for verification. Android 7.0+ required.',
};

// Simple markdown-to-HTML renderer (no external dependency needed)
function renderMarkdown(text: string): string {
  if (!text) return '<p>No release notes.</p>';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-5 space-y-1 my-3">$&</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n+/g, '</p><p class="mt-3">')
    .replace(/^(?!<[hup])/gm, '<p class="mt-3">')
    .replace(/(?<![>])$/gm, '</p>')
    .replace(/<p class="mt-3"><\/p>/g, '')
    .replace(/<p class="mt-3">(<\/?(h[1-6]|ul|li|code|strong|em)>)/g, '$1')
    .replace(/(<\/?(h[1-6]|ul|li|code|strong|em)>)<\/p>/g, '$1');
}

async function getReleases() {
  const GH_TOKEN = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = GH_TOKEN
    ? { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' }
    : { Accept: 'application/vnd.github+json' };

  try {
    const res = await fetch(
      'https://api.github.com/repos/marvel-254/veyra/releases?per_page=20',
      { headers, next: { revalidate: 3600 } }
    );
    if (res.ok) return res.json();
  } catch {
    // fallback to empty
  }
  return [];
}

const APK_TYPE_LABELS: Record<string, string> = {
  'veyra-app-debug.apk': 'Android (Debug)',
  'veyra-app-release.apk': 'Android (Release)',
};

export default async function ReleasesPage() {
  const releases = await getReleases();

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <a href="/" className="text-xl font-extrabold text-primary tracking-tight">
            Veyra
          </a>
          <div className="flex items-center gap-6">
            <a
              href="/"
              className="text-sm font-semibold text-on-surface-variant hover:text-white transition-colors"
            >
              Home
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

      <main className="max-w-4xl mx-auto px-6 pt-28 pb-20">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-2">
            Version History
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3">
            Releases &amp; Changelog
          </h1>
          <p className="text-on-surface-variant">
            All Veyra builds are signed and hosted on GitHub Releases. Every release includes{' '}
            <strong className="text-white">SHA-256 checksums</strong> for verification.
            Android 7.0 (API 24) or newer required.
          </p>
        </div>

        {/* Checksum note */}
        <div className="bg-surface border border-white/5 rounded-xl p-4 mb-10 flex gap-3 items-start">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d0bcff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0 mt-0.5"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
          <div>
            <p className="text-sm text-white font-semibold">Verify before installing</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Run{' '}
              <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">sha256sum veyra-app-*.apk</code>{' '}
              after downloading and compare the output to the checksum listed below.
            </p>
          </div>
        </div>

        {releases.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-white mb-3">No releases yet</h2>
            <p className="text-on-surface-variant mb-6">
              The first release will appear here once the GitHub Actions workflow completes.
            </p>
            <a
              href="https://github.com/marvel-254/veyra/releases/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Create a Release on GitHub →
            </a>
          </div>
        ) : (
          <div className="space-y-12">
            {releases.map((rel: any) => {
              const debugApk = rel.assets?.find((a: any) => a.name === 'veyra-app-debug.apk');
              const releaseApk = rel.assets?.find((a: any) => a.name === 'veyra-app-release.apk');
              const hasApk = debugApk || releaseApk;

              return (
                <div key={rel.id} className="border-b border-white/5 pb-12 last:border-0">
                  {/* Version + date */}
                  <div className="flex flex-wrap items-baseline gap-3 mb-3">
                    <h2 className="text-2xl font-extrabold text-white">
                      {rel.name || rel.tag_name}
                    </h2>
                    <span className="text-xs font-mono text-on-surface-variant bg-surface px-2.5 py-1 rounded-full border border-white/5">
                      {rel.tag_name}
                    </span>
                    {!rel.prerelease && hasApk && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        Stable
                      </span>
                    )}
                    {rel.prerelease && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full">
                        Pre-release
                      </span>
                    )}
                  </div>

                  <time
                    dateTime={rel.published_at}
                    className="text-sm text-on-surface-variant"
                  >
                    {new Date(rel.published_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>

                  {/* Release body (notes) */}
                  {rel.body ? (
                    <div
                      className="mt-5 text-sm text-on-surface-variant leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(rel.body) }}
                    />
                  ) : (
                    <p className="mt-5 text-sm text-on-surface-variant italic">
                      No release notes provided.
                    </p>
                  )}

                  {/* APK downloads */}
                  {rel.assets?.length > 0 && (
                    <div className="mt-6">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-3">
                        Downloads
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {rel.assets.map((asset: any) => {
                          const label = APK_TYPE_LABELS[asset.name] || asset.name;
                          const isApk = asset.name.endsWith('.apk');
                          return (
                            <a
                              key={asset.id}
                              href={asset.browser_download_url}
                              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                                isApk
                                  ? 'bg-primary text-on-primary hover:opacity-90 shadow-lg shadow-primary/20'
                                  : 'bg-surface border border-white/10 text-on-surface hover:border-white/30 text-sm'
                              }`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
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
                              {label}
                              <span className="text-xs opacity-70">
                                ({(asset.size / 1024 / 1024).toFixed(1)} MB)
                              </span>
                            </a>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-xs text-on-surface-variant font-mono">
                        SHA-256 checksums are included in the release description above. Always verify before installing.
                      </p>
                    </div>
                  )}

                  {/* No assets yet */}
                  {rel.assets?.length === 0 && (
                    <div className="mt-6 flex items-center gap-2 text-sm text-on-surface-variant bg-surface border border-white/5 rounded-xl px-4 py-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      No APK assets uploaded to this release yet. Assets are attached when a tag
                      is pushed.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="text-lg font-extrabold text-primary">
            Veyra
          </a>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href="/terms" className="text-xs text-on-surface-variant hover:text-white transition-colors">
              Terms of Service
            </a>
            <a href="/privacy" className="text-xs text-on-surface-variant hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="/help" className="text-xs text-on-surface-variant hover:text-white transition-colors">
              Help &amp; FAQ
            </a>
            <a
              href="https://github.com/marvel-254/veyra"
              className="text-xs text-on-surface-variant hover:text-white transition-colors"
            >
              Source Code
            </a>
          </nav>
          <p className="text-xs text-on-surface-variant">&copy; {new Date().getFullYear()} Veyra</p>
        </div>
      </footer>
    </div>
  );
}

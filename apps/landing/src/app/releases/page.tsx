export default async function ReleasesPage() {
  const GH_TOKEN = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = GH_TOKEN
    ? { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' }
    : { Accept: 'application/vnd.github+json' };

  let releases: any[] = [];
  try {
    const res = await fetch(
      'https://api.github.com/repos/marvel-254/veyra/releases?per_page=10',
      { headers, next: { revalidate: 3600 } }
    );
    if (res.ok) releases = await res.json();
  } catch {
    releases = [];
  }

  return (
    <div className="min-h-screen bg-background text-on-surface py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Changelog</h1>

        {releases.length === 0 ? (
          <p className="text-on-surface-variant">
            No releases yet. The first APK will appear here once the GitHub Actions workflow runs.
          </p>
        ) : (
          <div className="space-y-10">
            {releases.map((rel) => (
              <div key={rel.id} className="border-b border-white/10 pb-8">
                <div className="flex items-baseline gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-white">{rel.name || rel.tag_name}</h2>
                  <span className="text-xs font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                    {rel.tag_name}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant mb-4">
                  {new Date(rel.published_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </p>
                <div
                  className="prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: rel.body || '<p>No release notes.</p>' }}
                />
                {rel.assets?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {rel.assets.map((asset: any) => (
                      <a
                        key={asset.id}
                        href={asset.browser_download_url}
                        className="px-4 py-2 bg-primary text-on-primary font-bold rounded-lg text-sm hover:opacity-90"
                      >
                        Download {asset.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

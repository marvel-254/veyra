// Server component wrapper.
//
// The app is built with `output: 'export'` (static export) because the Android
// APK bundles plain files and loads them from the WebView — there is no Node
// server in the shipped app. Static export requires every dynamic route to
// declare its params at build time, so we enumerate catalog slugs here.
//
// Movie detail data is still fetched client-side (see MovieDetailClient), so a
// slug that is missing from this list simply won't be a pre-rendered file.

import { api, type Movie } from '@/lib/api';

export const dynamicParams = false;

async function fetchSlugs(): Promise<string[]> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
  const slugs = new Set<string>();

  // Best effort: if the API is unavailable the export still succeeds with an
  // empty catalog rather than failing the whole build.
  try {
    const res = await fetch(`${API_URL}/api/movies?limit=500`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as { movies: Movie[] };
      for (const m of data.movies || []) {
        if (m.slug) slugs.add(m.slug);
      }
    }
  } catch {
    // API unreachable during build — continue with whatever we have.
  }

  return [...slugs];
}

export async function generateStaticParams() {
  const slugs = await fetchSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function MoviePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const MovieDetailClient = (await import('./MovieDetailClient')).default;
  return <MovieDetailClient slug={slug} />;
}
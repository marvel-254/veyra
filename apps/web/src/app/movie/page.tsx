// Static-export-safe movie detail route.
//
// The app ships as `output: 'export'` (plain files bundled into the Android
// APK), so there is no server to resolve dynamic path segments at runtime —
// every `/movie/<slug>` URL would need its own pre-rendered HTML file.
//
// We therefore read the slug from a query parameter (`/movie?slug=<slug>`) and
// fetch the title client-side, exactly like `/watch?id=<id>`. This keeps one
// static shell for the whole catalog and lets deep links work inside the APK.

import { Suspense } from 'react';
import MovieDetailClient from './MovieDetailClient';

function MovieDetailContent() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <MovieDetailClient />
    </Suspense>
  );
}

export default function MoviePage() {
  return <MovieDetailContent />;
}
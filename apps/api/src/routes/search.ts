import { Hono } from 'hono';
import { sql, eq, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { movies } from '../db/schema';
import { getTMDB, TMDBService } from '../lib/tmdb';
import type { Env } from '../index';

// ── Suggestion shape ────────────────────────────────────────────
export interface SuggestionItem {
  id: number;
  title: string;
  slug: string;
  posterUrl: string | null;
  year: number | null;
  mediaType: 'movie' | 'series';
}

// ── Router ─────────────────────────────────────────────────────
const search = new Hono<{ Bindings: Env }>();

// ── GET /api/search?q=query&page=1&limit=20 ────────────────────
search.get('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const query = c.req.query('q');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;
  const year = c.req.query('year');
  const type = c.req.query('type');

  if (!query || query.trim().length === 0) {
    return c.json({ error: 'Search query is required' }, 400);
  }

  const searchPattern = `%${query.toLowerCase()}%`;

  let results = await db
    .select({
      id: movies.id,
      title: movies.title,
      slug: movies.slug,
      shortDescription: movies.shortDescription,
      type: movies.type,
      year: movies.year,
      duration: movies.duration,
      rating: movies.rating,
      imdbRating: movies.imdbRating,
      posterUrl: movies.posterUrl,
      backdropUrl: movies.backdropUrl,
      director: movies.director,
      cast: movies.cast,
      tags: movies.tags,
      status: movies.status,
      voteAverage: movies.voteAverage,
      originalLanguage: movies.originalLanguage,
    })
    .from(movies)
    .where(
      and(
        eq(movies.status, 'published'),
        sql`(lower(${movies.title}) LIKE ${searchPattern} OR lower(${movies.description}) LIKE ${searchPattern} OR lower(${movies.director}) LIKE ${searchPattern})`
      )
    )
    .limit(limit)
    .offset(offset);

  // Apply client-side filters that can't be expressed in the SQL WHERE
  if (year) {
    if (year === 'classic') {
      results = results.filter((r) => r.year !== null && r.year < 2000);
    } else {
      results = results.filter((r) => r.year === parseInt(year));
    }
  }
  if (type) {
    results = results.filter((r) => r.type === type);
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(movies)
    .where(
      and(
        eq(movies.status, 'published'),
        sql`(lower(${movies.title}) LIKE ${searchPattern} OR lower(${movies.description}) LIKE ${searchPattern} OR lower(${movies.director}) LIKE ${searchPattern})`
      )
    );

  return c.json({
    results,
    query,
    pagination: {
      page,
      limit,
      total: countResult.count,
      totalPages: Math.ceil(countResult.count / limit),
    },
  });
});

// ── GET /api/search/suggest?q= ──────────────────────────────────
// Lightweight autocomplete: top 6 items from TMDB multi-search.
// Falls back to local DB title-prefix match if TMDB is not configured.
// Returns [] on any failure — never throws a 500.
search.get('/suggest', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  const q = c.req.query('q')?.trim();

  if (!q || q.length < 2) {
    return c.json({ suggestions: [] });
  }

  if (token) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const tmdb = getTMDB(token);
      const res = await tmdb.searchMulti(q, 1);
      clearTimeout(timeout);

      const suggestions: SuggestionItem[] = res.results
        .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          title: item.title || item.name || '',
          slug: '',
          posterUrl: TMDBService.posterUrl(item.poster_path, 'sm'),
          year: item.release_date ? new Date(item.release_date).getFullYear() : null,
          mediaType: item.media_type === 'tv' ? 'series' : 'movie',
        }));

      return c.json({ suggestions });
    } catch {
      // Fall through to DB fallback
    }
  }

  // Local DB fallback — title prefix match
  try {
    const db = getDb(c.env.DATABASE_URL);
    const rows = await db
      .select({
        id: movies.id,
        title: movies.title,
        slug: movies.slug,
        type: movies.type,
        year: movies.year,
        posterUrl: movies.posterUrl,
      })
      .from(movies)
      .where(
        and(
          eq(movies.status, 'published'),
          sql`lower(${movies.title}) LIKE ${q.toLowerCase()}%`
        )
      )
      .limit(6);

    const suggestions: SuggestionItem[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug || '',
      posterUrl: r.posterUrl || null,
      year: r.year ?? null,
      mediaType: r.type === 'series' ? 'series' : 'movie',
    }));

    return c.json({ suggestions });
  } catch {
    return c.json({ suggestions: [] });
  }
});

// ── GET /api/search/suggestions?q=query ─────────────────────────
// Legacy autocomplete — kept for back-compat with existing callers.
search.get('/suggestions', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const query = c.req.query('q');

  if (!query || query.trim().length < 2) {
    return c.json({ suggestions: [] });
  }

  const searchPattern = `%${query.toLowerCase()}%`;

  const suggestions = await db
    .select({
      id: movies.id,
      title: movies.title,
      slug: movies.slug,
      type: movies.type,
      year: movies.year,
      posterUrl: movies.posterUrl,
    })
    .from(movies)
    .where(
      and(
        eq(movies.status, 'published'),
        sql`lower(${movies.title}) LIKE ${searchPattern}`
      )
    )
    .limit(8);

  return c.json({ suggestions });
});

export { search as searchRoutes };

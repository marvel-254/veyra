'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import MovieRow from '@/components/MovieRow';
import DiscoveryRow from '@/components/DiscoveryRow';
import { SkeletonRow } from '@/components/SkeletonCard';
import { api, type Movie, type DiscoveryItem } from '@/lib/api';

const mockFeatured: Movie = {
  id: 1,
  title: 'The Midnight Echo',
  slug: 'the-midnight-echo',
  description: 'When a mysterious signal disrupts global communications, a rogue cryptographer must decode the truth before the silence becomes permanent.',
  shortDescription: 'When a mysterious signal disrupts global communications, a rogue cryptographer must decode the truth before the silence becomes permanent.',
  type: 'movie',
  year: 2024,
  duration: 8100,
  rating: 'PG-13',
  imdbRating: 8.5,
  posterUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBMS5FpDB_NWOdcXFGMSssfzF8uhI6i8xJLMkZCU6UTuuRONadJatwkeFkU4EKacHfPmha_EoWKWGD-6AZ11eWW3VkaGiWm2QzJO7h9lSiCL0ZH7wmDiypFB6e4VvgmCfuRsKwRHXO6aqDD6wwHPIuv1rrs70qM04xkIZYQh4pPRQk9IBgEaOUO7kpaUPTmoIi4D-xd2IPwsRicE01AlOVSptaMh0B4q0cznQCYX6Q-LUpAssJCHDDYSQ',
  backdropUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuABODfiptbwu9_rVVuwS2TlIp6wjnfupyfryIBMoGqxkkhv6tcA7Vock7HHXA-ABswHuv3sJWjyxVdOrOdqRzGmkGqjlYAwU1F5ba6LKeztzS3G1BHmAt0WOO_BybCsOqvXhzjEJGasAqdDEYLs1t0Wg6C8luaw6mPWBMi3A1HgoZnup6_67mOXLHCR58rlyNOG8v_BrRl7ScWQXi4ORk5NMDSCy1-SYG-CJPp9bYElFGwnSkaD9GjBSg',
  genres: [{ id: 1, name: 'Sci-Fi', slug: 'sci-fi' }, { id: 2, name: 'Thriller', slug: 'thriller' }],
  status: 'published',
  featured: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface ContinueWatchingItem {
  movieId: number;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
  movie?: Movie;
}

export default function HomePage() {
  const [featured, setFeatured] = useState<Movie>(mockFeatured);
  const [trending, setTrending] = useState<Movie[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  const [tmdbTrending, setTmdbTrending] = useState<DiscoveryItem[]>([]);
  const [tmdbPopularMovies, setTmdbPopularMovies] = useState<DiscoveryItem[]>([]);
  const [tmdbPopularTV, setTmdbPopularTV] = useState<DiscoveryItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featuredRes, trendingRes, moviesRes] = await Promise.allSettled([
          api.getFeaturedMovies(),
          api.getTrendingMovies(10),
          api.getMovies({ limit: 10 }),
        ]);

        if (featuredRes.status === 'fulfilled' && featuredRes.value.movies.length > 0) {
          setFeatured(featuredRes.value.movies[0]);
        }
        if (trendingRes.status === 'fulfilled') setTrending(trendingRes.value.movies);
        if (moviesRes.status === 'fulfilled') setRecentlyAdded(moviesRes.value.movies);
      } catch {
        // Use mock data
      }
    };

    const fetchDiscovery = async () => {
      try {
        const [trendingRes, popularMoviesRes, popularTVRes] = await Promise.allSettled([
          api.getTrending('day'),
          api.getPopular('movie'),
          api.getPopular('tv'),
        ]);

        if (trendingRes.status === 'fulfilled') setTmdbTrending(trendingRes.value.results);
        if (popularMoviesRes.status === 'fulfilled') setTmdbPopularMovies(popularMoviesRes.value.results);
        if (popularTVRes.status === 'fulfilled') setTmdbPopularTV(popularTVRes.value.results);
      } catch {
        // TMDB unavailable
      }
    };

    fetchData();
    fetchDiscovery();
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <Hero movie={featured} />

      {/* Content Rows */}
      <main className="relative z-20 -mt-24 pb-32">
        <div className="pl-5 md:pl-16 pr-4 md:pr-16">

          {/* ── TMDB Trending Today ───────────────────────────── */}
          {loading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-48 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} variant="backdrop" />
            </section>
          ) : tmdbTrending.length > 0 ? (
            <DiscoveryRow title="Trending Today" items={tmdbTrending} size="md" />
          ) : null}

          {/* ── Trending Now ─────────────────────────────────── */}
          {loading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-40 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} />
            </section>
          ) : trending.length > 0 ? (
            <MovieRow title="Trending Now" movies={trending} size="md" />
          ) : null}

          {/* ── Recently Added ───────────────────────────────── */}
          {loading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-48 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} />
            </section>
          ) : recentlyAdded.length > 0 ? (
            <MovieRow title="Recently Added" movies={recentlyAdded} size="md" />
          ) : null}

          {/* ── TMDB Popular Movies ──────────────────────────── */}
          {loading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-44 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} variant="backdrop" />
            </section>
          ) : tmdbPopularMovies.length > 0 ? (
            <DiscoveryRow title="Popular Movies" items={tmdbPopularMovies} size="md" />
          ) : null}

          {/* ── TMDB Popular TV ──────────────────────────────── */}
          {loading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-48 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} variant="backdrop" />
            </section>
          ) : tmdbPopularTV.length > 0 ? (
            <DiscoveryRow title="Popular TV Shows" items={tmdbPopularTV} size="md" />
          ) : null}

        </div>
      </main>
    </div>
  );
}

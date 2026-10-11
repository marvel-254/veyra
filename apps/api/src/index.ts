import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { movieRoutes } from './routes/movies';
import { searchRoutes } from './routes/search';
import { watchRoutes } from './routes/watch';
import { genreRoutes } from './routes/genres';
import { discoveryRoutes } from './routes/discovery';
import { downloadRoutes } from './routes/download';

// Environment bindings
export interface Env {
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
  R2_BUCKET?: R2Bucket;
  R2_PUBLIC_DOMAIN?: string;
  TMDB_API_READ_ACCESS_TOKEN: string;
  /** Base URL of the yt-dlp download service (Render Docker service). */
  YT_DLP_SERVICE_URL?: string;
}

export type AppContext = { Bindings: Env };

// Create the main app
const app = new Hono<AppContext>();

// CORS middleware - allow frontend origins
app.use('*', cors({
  origin: (origin, c) => {
    try {
      const allowedOrigins = c.env?.CORS_ORIGIN?.split(',') || [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://web-jade-one-82.vercel.app',
        'https://veyra.vercel.app',
      ];
      return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    } catch {
      return '*';
    }
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({
  name: 'veyra-api',
  version: '0.3.0',
  status: 'ok',
  environment: c.env.ENVIRONMENT || 'development',
}));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public routes
app.route('/api/movies', movieRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/genres', genreRoutes);
app.route('/api/discovery', discoveryRoutes);
app.route('/api/watch', watchRoutes);
app.route('/api/download', downloadRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;

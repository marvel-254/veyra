# Veyra APK — Project Handoff Document

> **Version:** 0.1.0  
> **Date:** 2026-01-10  
> **Status:** Draft — Active Development  
> **Goal:** Transform Veyra from a web PWA into a free, no-login Android APK with YouTube-powered download capability

---

## 1. Vision & Purpose

**What is Veyra APK?**

Veyra APK is a free, open-for-everyone Android movie & series streaming/downloading app. Users install the APK, browse a cinematic catalog pulled from TMDB, and download movies and series sourced from YouTube via a yt-dlp backend running on Cloudflare Workers.

**Core Principles:**
- ✅ Free for everyone — no login, no signup, no account required
- ✅ TMDB for all movie/series metadata and imagery
- ✅ yt-dlp via Cloudflare Workers for downloading video content from YouTube
- ✅ Android APK mirrors Veyra Web's exact look and feel
- ✅ APK releases hosted on **GitHub Releases**
- ✅ Download website hosted on **Vercel**
- ✅ Fully open source

**Out of Scope (v1):**
- Payment or subscription features
- User accounts, profiles, or watchlists
- Original content
- Content hosted on our own infrastructure

---

## 2. Design & UI Reference

The APK must **look exactly like Veyra Web**. The existing web app is the single source of truth for visual design.

### Design System (from Veyra Web `tailwind.config.ts`)

| Token | Value | Usage |
|---|---|---|
| Background | `#0A0A0B` | Page background |
| Primary | `#d0bcff` | Buttons, highlights, CTAs |
| Surface | `#131314` | Card backgrounds |
| Surface Container | `#201f20` | Elevated panels |
| On Surface | `#e5e2e3` | Primary text |
| On Surface Variant | `#cbc3d7` | Secondary text |
| Tertiary | `#ffb4aa` | Accent overlays |
| Font | `Plus Jakarta Sans` | All text |
| Border Radius | `0.25rem` (lg: `0.5rem`, xl: `0.75rem`) | Cards, buttons, inputs |

### Page Structure (from Veyra Web)

```
/ (Home)
  ├── Navbar — search, navigation
  ├── Hero — featured movie with backdrop & CTA
  ├── Continue Watching (if history exists)
  ├── Trending Now — MovieRow
  ├── Recently Added — MovieRow
  ├── TMDB Trending Today — DiscoveryRow
  ├── Popular Movies — DiscoveryRow
  └── Popular TV Shows — DiscoveryRow

/browse — Full catalog with filters
/movie/[slug] — Movie detail (poster, backdrop, genres, description, download button)
/search — Search results from TMDB
/watch — Video player page
/watchlist — Not needed (no accounts)
/admin — Will be repurposed or removed
/auth — Will be removed (no login)
/profile — Will be removed (no accounts)
```

### Key Components to Port

| Component | Purpose | Priority |
|---|---|---|
| `Navbar` | Top navigation bar with search | P0 |
| `Hero` | Full-width featured movie with gradient overlay | P0 |
| `MovieCard` | Thumbnail card with hover overlay | P0 |
| `MovieRow` | Horizontal scrollable row of MovieCards | P0 |
| `DiscoveryRow` | Horizontal scrollable row of TMDB items | P0 |
| `SkeletonCard` | Loading placeholder | P0 |
| `VideoPlayer` | HTML5/HLS video player | P0 |
| `Footer` | App footer | P1 |
| `ErrorBoundary` | Error state UI | P1 |

### Color Palette Summary

```css
--background: #0A0A0B
--surface: #131314
--surface-container: #201f20
--surface-container-high: #2a2a2b
--primary: #d0bcff       /* Violet — primary actions */
--primary-container: #a078ff
--on-primary: #3c0091
--tertiary: #ffb4aa      /* Warm red — download actions */
--on-surface: #e5e2e3
--on-surface-variant: #cbc3d7
--outline: #958ea0
```

---

## 3. Architecture

### Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Mobile Shell** | Capacitor 7 | Wraps the React web app into an APK |
| **Frontend** | Next.js 15 + React 19 | Existing web app code (migrated) |
| **Styling** | Tailwind CSS 3 | Existing design system |
| **API Layer** | Hono on Cloudflare Workers | Existing API (modified) |
| **Metadata** | TMDB API v3 | Existing integration |
| **Download Engine** | yt-dlp via CF Workers | New — Python WASM or subprocess |
| **Object Storage** | Cloudflare R2 | Existing for poster/backdrop images |
| **Database** | Neon Postgres | Existing user/auth DB (to be simplified) |
| **Auth** | **REMOVED** | Firebase auth to be stripped |
| **APK Hosting** | GitHub Releases | New |
| **Marketing/Download Site** | Next.js on Vercel | New |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Veyra APK (Android)               │
│         (Capacitor-wrapped React App)              │
└──────────────┬──────────────────────┬────────────────┘
               │ HTTP requests       │ HTTP requests
               ▼                     ▼
┌──────────────────────┐  ┌──────────────────────────┐
│  Cloudflare Workers   │  │     Vercel Website       │
│  ┌────────────────┐  │  │  (veyra.app - download) │
│  │ Hono API       │  │  └──────────────────────────┘
│  │  /api/movies   │  │
│  │  /api/search   │  │
│  │  /api/discovery│  │
│  │  /api/download │◄─┼── yt-dlp integration
│  │  (NEW)         │  │
│  └────────────────┘  │
│                     │
│  Cloudflare R2 ◄────┼── Images (posters, backdrops)
│  Neon Postgres ◄───┼── Movie catalog (simplified)
│  TMDB API ◄─────────┼── Metadata
└──────────────────────┘
```

### Repository Structure (Target)

```
veyra/
├── apps/
│   ├── web/                 # Existing Veyra web (to be migrated to Vercel)
│   ├── api/                 # Cloudflare Workers API
│   ├── landing/             # Vercel download/marketing site (NEW)
│   └── apk/                 # Capacitor Android project (NEW)
├── packages/
│   ├── db/                  # Shared Drizzle schema
│   └── tsconfig/            # Shared TypeScript config
├── HANDOFF.md               # This document (updated throughout)
├── CHANGELOG.md             # Auto-generated from GitHub Releases
└── README.md
```

---

## 4. API Design

### New Endpoints to Add

#### `POST /api/download`
Initiates a YouTube download using yt-dlp.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "movieId": 12345,
  "quality": "1080p"  // or "720p", "480p"
}
```

**Response:**
```json
{
  "taskId": "dl_abc123",
  "status": "queued",
  "estimatedTime": 120
}
```

#### `GET /api/download/:taskId`
Check download status.

**Response:**
```json
{
  "taskId": "dl_abc123",
  "status": "completed",  // queued | processing | completed | failed
  "url": "https://r2.veyra.dev/downloads/...",
  "expiresAt": "2026-01-11T00:00:00Z"
}
```

#### `GET /api/movies`
Returns the full movie catalog.

**Query params:** `?page=1&limit=20&genre=sci-fi&search=avatar`

#### `GET /api/movies/:slug`
Returns detailed movie info.

### yt-dlp Integration Strategy

**Challenge:** Cloudflare Workers run on V8 (JavaScript) — yt-dlp is Python.

**Solution Options:**

| Option | Approach | Pros | Cons |
|---|---|---|---|
| **A: Pyodide + WASM** | Run yt-dlp in-browser via Pyodide Python WASM | No server Python needed | Heavy, slow, browser-dependent |
| **B: Python Worker via CF** | Use Cloudflare's Python Workers (beta) | Full yt-dlp support, fast | Beta, limited ecosystem |
| **C: yt-dlp binary in R2** | Pre-built yt-dlp binary + Worker subprocess | Fast, reliable | Complex binary management |
| **D: Third-party API** | Use a hosted yt-dlp service | Fastest to implement | External dependency, cost |
| **E: CF AI Gateway + yt-dlp** | Route through AI gateway | Managed | Not ideal for this use case |

**Recommended: Option B (Python Worker)** or **Option C (binary)** depending on Cloudflare's Python Worker stability at build time.

> **Decision:** Start with **Option B (Python Workers)** — Cloudflare has native Python support in Workers. yt-dlp can be installed via pip in the Python worker.

### yt-dlp Worker Architecture

```
User taps "Download" in APK
        │
        ▼
APK → POST /api/download { url, quality }
        │
        ▼
Python Worker (Cloudflare)
  1. Validates YouTube URL
  2. Runs: yt-dlp -f "best[height<=1080]" -o /tmp/{uuid}.mp4 {url}
  3. Uploads output to R2
  4. Returns signed R2 URL with 24h expiry
        │
        ▼
APK downloads the file and saves to device storage
```

---

## 5. Capacitor Android Build

### Setup

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Veyra" "com.veyra.app" --web-dir=apps/web/out
npx cap add android
npx cap sync android
npx cap copy android
```

### Required Plugins

| Plugin | Purpose |
|---|---|
| `@capacitor/filesystem` | Save downloaded videos to device |
| `@capacitor/action-sheet` | Show "Open with" options |
| `@capacitor/toast` | Show download notifications |
| `@capacitor/browser` | Open external links |
| `@capacitor/share` | Share movie details |
| `@capacitor/haptics` | Tactile feedback on interactions |
| `@capacitor/app-launcher` | Open other apps |
| `@capacitor/network` | Check connectivity before download |
| `@capacitor/preferences` | Local settings (no account needed) |

### Android Configuration

- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 35 (Android 15)
- **Bundle ID:** `com.veyra.app`
- **Signing:** Debug keystore for development; release keystore for production
- **Permissions:** `INTERNET`, `WRITE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`, `ACCESS_NETWORK_STATE`

---

## 6. Download Flow UX

```
┌──────────────────────────────────────────────────┐
│           Movie Detail Page (/movie/[slug])      │
│                                                  │
│  [Backdrop Image - full width]                   │
│  ┌─────────────────────────────────────┐         │
│  │  Movie Title           Year  Runtime │        │
│  │  ⭐ 8.5  PG-13   [Genres...]        │        │
│  └─────────────────────────────────────┘         │
│                                                  │
│  Synopsis:                                       │
│  When a mysterious signal disrupts global...     │
│                                                  │
│  ┌──────────────┐  ┌───────────────────┐        │
│  │  ▶  Watch   │  │  ⬇ Download (1080p)│        │
│  │  (stream)   │  │  [Quality ▼]       │        │
│  └──────────────┘  └───────────────────┘        │
└──────────────────────────────────────────────────┘
```

### Download States

| State | UI |
|---|---|
| Idle | "Download" button with quality selector |
| Queued | Spinner + "Queued..." + estimated time |
| Downloading | Progress bar + "42% · 320MB / 800MB" |
| Processing | Spinner + "Processing video..." |
| Completed | "Save to device" + open/share buttons |
| Failed | Error message + "Retry" button |

---

## 7. Vercel Download Website

**URL:** `https://veyra.app` (or similar)

### Pages

| Route | Purpose |
|---|---|
| `/` | Hero landing page with APK download CTA |
| `/releases` | Full changelog from GitHub Releases API |
| `/changelog` | Latest release notes |

### Landing Page Sections

1. **Hero** — "Veyra — Free Movies & Series" + APK download button
2. **Features** — Why use Veyra (free, no login, HD downloads)
3. **Download** — APK version, file size, last updated date
4. **Screenshots** — App UI screenshots (device mockups)
5. **Changelog** — Recent updates from GitHub Releases
6. **FAQ** — Common questions
7. **Footer** — GitHub link, disclaimer

### Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS (same design system as APK)
- **Hosting:** Vercel (auto-deploys on `main` push)
- **Data:** GitHub Releases API for changelog

---

## 8. GitHub Releases Pipeline

### Release Workflow

```
Developer pushes git tag: v1.0.0
        │
        ▼
GitHub Actions triggered
  1. Build Android APK (debug or release)
  2. Sign APK (release keystore from GitHub Secrets)
  3. Create GitHub Release with changelog
  4. Upload APK as release asset
  5. Auto-update landing site (Vercel webhook)
        │
        ▼
Release available at:
  https://github.com/{org}/veyra/releases
  https://veyra.app/releases
```

### GitHub Actions (`release.yml`)

```yaml
on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build:web
      - run: npx cap sync android
      - run: npx cap copy android
      - name: Build APK
        run: |
          ./gradlew assembleRelease
          # Sign with release keystore
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: apps/apk/app-release.apk
          generate_release_notes: true
```

---

## 9. Migration: Removing Firebase Auth

Since the app is free with no login, we must remove all Firebase auth code.

### Files to Remove/Modify

| File | Action |
|---|---|
| `apps/web/src/lib/firebase.ts` | Delete entirely |
| `apps/web/src/lib/use-user.ts` | Delete entirely |
| `apps/web/src/lib/api.ts` | Remove Firebase ID token from all requests |
| `apps/api/src/lib/auth.ts` | Remove Firebase token verification |
| `apps/api/src/lib/users.ts` | Remove user creation/management |
| `apps/api/src/routes/auth.ts` | Remove all auth routes |
| `apps/api/src/routes/watch.ts` | Remove auth middleware |
| `apps/api/src/routes/ratings.ts` | Remove auth middleware |
| `apps/api/src/routes/storage.ts` | Remove (R2 storage managed server-side) |
| `apps/api/src/index.ts` | Remove auth middleware |
| `apps/api/src/db/schema.ts` | Keep movies/genres, remove users/storageAccounts |
| `apps/web/src/app/auth/` | Delete entire directory |
| `apps/web/src/app/profile/` | Delete entire directory |
| `apps/web/src/app/watchlist/` | Delete entire directory |
| `apps/web/src/app/admin/` | Delete entire directory |
| `apps/api/src/lib/db.ts` | Simplify DB connection |
| `apps/api/src/routes/admin.ts` | Remove entirely |

### Remaining API Routes (Simplified)

| Route | Auth | Purpose |
|---|---|---|
| `GET /` | No | Health check |
| `GET /api/movies` | No | List movies |
| `GET /api/movies/:slug` | No | Movie details |
| `GET /api/search` | No | Search TMDB |
| `GET /api/genres` | No | List genres |
| `GET /api/discovery` | No | TMDB trending/popular |
| `POST /api/download` | No | Initiate download |
| `GET /api/download/:taskId` | No | Download status |

---

## 10. Implementation Phases

### Phase 1 — Foundation ✅
- [ ] Create this handoff document
- [ ] Initialize GitHub repository (empty repo, as requested)
- [ ] Set up monorepo structure

### Phase 2 — Core Migration
- [ ] Remove Firebase auth from web app
- [ ] Remove auth routes from API
- [ ] Simplify database schema (keep movies, remove users)
- [ ] Clean up unused pages (auth, profile, watchlist, admin)
- [ ] Ensure all API routes work without auth
- [ ] Test the app flows work without login

### Phase 3 — Capacitor Android
- [ ] Initialize Capacitor in the project
- [ ] Install required plugins
- [ ] Configure Android build settings
- [ ] Build and verify shell APK
- [ ] Test basic navigation in APK

### Phase 4 — Download Engine
- [ ] Set up Cloudflare Python Worker for yt-dlp
- [ ] Implement `POST /api/download` endpoint
- [ ] Implement `GET /api/download/:taskId` status endpoint
- [ ] Test YouTube URL resolution
- [ ] Test R2 upload from Worker
- [ ] Integrate download flow in APK UI

### Phase 5 — APK Polish
- [ ] Port all web UI components to work in Capacitor
- [ ] Implement device file storage for downloads
- [ ] Implement download manager UI (queue, progress, cancel)
- [ ] Add offline playback support
- [ ] Add native share functionality
- [ ] Implement APK auto-update check

### Phase 6 — Landing Site
- [ ] Create Vercel Next.js project for landing page
- [ ] Design and build landing page
- [ ] Integrate GitHub Releases API for changelog
- [ ] Add APK download button (links to latest release)
- [ ] Add device screenshots
- [ ] SEO optimization

### Phase 7 — Release Pipeline
- [ ] Configure GitHub Actions for APK builds
- [ ] Set up release signing
- [ ] Create first production APK release
- [ ] Verify GitHub Releases page
- [ ] Verify Vercel site serves download correctly

### Phase 8 — Launch
- [ ] Publish landing page
- [ ] Announce on social platforms
- [ ] Monitor GitHub Releases for user feedback
- [ ] Fix critical bugs from user reports

---

## 11. Open Questions & Decisions Needed

| # | Question | Options | Owner |
|---|---|---|---|
| 1 | yt-dlp backend approach? | Python Worker vs binary WASM | Dev team |
| 2 | APK signing key management? | GitHub Secrets vs manual | Dev team |
| 3 | Content quality options? | 1080p only, 720p+1, or all | Dev team |
| 4 | TMDB API rate limits? | Use caching proxy or individual keys | Dev team |
| 5 | APK auto-update mechanism? | Firebase App Distribution, or manual | Dev team |
| 6 | Domain name for landing site? | veyra.app vs veyra.dev vs other | Dev team |
| 7 | GitHub repo organization? | monorepo vs separate repos per app | Dev team |
| 8 | Min Android version for APK? | 24 (Android 7) or 21 (Android 5) | Dev team |
| 9 | Video format for downloads? | MP4 (H.264) or MKV (HEVC) | Dev team |
| 10 | Download storage location? | Internal storage or Downloads folder | Dev team |

---

## 12. Key Files Reference

### Existing Source Files

| File | Purpose |
|---|---|
| `apps/web/src/app/page.tsx` | Home page — copy design from here |
| `apps/web/src/app/globals.css` | Tailwind base + custom utilities |
| `apps/web/tailwind.config.ts` | Complete design token system |
| `apps/web/src/app/layout.tsx` | Root layout with fonts, PWA meta |
| `apps/web/src/components/Navbar.tsx` | Top nav component |
| `apps/web/src/components/Hero.tsx` | Hero banner component |
| `apps/web/src/components/MovieCard.tsx` | Movie card component |
| `apps/web/src/components/MovieRow.tsx` | Horizontal movie row |
| `apps/web/src/components/DiscoveryRow.tsx` | TMDB discovery row |
| `apps/web/src/components/SkeletonCard.tsx` | Loading skeleton |
| `apps/web/src/components/VideoPlayer.tsx` | HLS video player |
| `apps/web/src/lib/api.ts` | API client — remove auth headers |
| `apps/api/src/index.ts` | Hono app entry — remove auth middleware |
| `apps/api/src/routes/movies.ts` | Movie routes |
| `apps/api/src/routes/discovery.ts` | TMDB discovery routes |
| `apps/api/src/lib/tmdb.ts` | TMDB API helper |

### Files to Create

| File | Purpose |
|---|---|
| `apps/landing/` | Vercel download site |
| `apps/apk/` | Capacitor Android project |
| `.github/workflows/release.yml` | APK build & release pipeline |
| `CHANGELOG.md` | Auto-managed changelog |
| `HANDOFF.md` | This document |

---

## 13. Veyra Design System — Quick Reference

### Typography Scale

```
display-xl:  72px / 80px line — hero headlines
headline-lg: 48px / 56px line — section titles
headline-md: 24px / 32px line — card titles
body-lg:     18px / 28px line — descriptions
body-md:     16px / 24px line — default text
label-caps:  12px / 16px line — badges, labels (ALL CAPS)
```

### Component Patterns

**Glass Panel:**
```css
background: rgba(20, 20, 22, 0.7);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.1);
```

**Primary Button:**
```css
background: #d0bcff;
color: #3c0091;
box-shadow: 0 0 20px rgba(208, 188, 255, 0.4);
border: 1px solid rgba(208, 188, 255, 0.5);
```

**Violet Glow Effect:**
```css
box-shadow: 0 0 15px rgba(208, 188, 255, 0.3);
border: 1px solid rgba(208, 188, 255, 0.5);
```

**Movie Card:**
```css
bg-surface-container-low, rounded-xl, overflow-hidden
hover: scale(1.05), border-primary/30, shadow-xl
```

---

*Last updated: 2026-01-10 | Phase 2 complete — auth stripped, Capacitor init in progress*
# Veyra standalone Android implementation plan

I've inspected the existing [`oliver4441/veyra`](https://github.com/oliver4441/veyra) repository and its documented API. The most important finding is that Veyra already has a substantial web foundation, but the repository is not yet a native Android project.

The right approach is to preserve the working services, add a native Android client, and finish the backend capabilities required by Veyra's new chat-first experience. We should not rewrite the entire platform.

## 1. What already exists

### Existing web application

Next.js 15, React 19, Tailwind CSS and PWA support under `apps/web`. It currently has a catalogue-oriented interface, search, movie rows, authentication UI and playback-related components.

### Existing API

Cloudflare Workers with Hono under `apps/api`, backed by Neon PostgreSQL and Drizzle ORM.

### Metadata and discovery

A server-side TMDB client and endpoints for movie/TV search, trending, popular titles, details and recommendations.

### Authentication and user data

Firebase authentication, watch progress, history, watchlists, and a database model for movies, series, seasons, episodes and media files.

### Incomplete or unverified areas

Native Android UI, AI chat orchestration, persistent conversation history, playback reliability, and end-to-end production behavior still need to be verified or implemented. The current watch API also contains a placeholder for continue-watching.

Sources: [`README.md`](https://github.com/oliver4441/veyra/blob/main/README.md), [`API entry point`](https://github.com/oliver4441/veyra/blob/main/apps/api/src/index.ts), [`discovery routes`](https://github.com/oliver4441/veyra/blob/main/apps/api/src/routes/discovery.ts), and [`watch routes`](https://github.com/oliver4441/veyra/blob/main/apps/api/src/routes/watch.ts).

One important implementation detail: the existing frontend API client defaults to mock-data fallback when requests fail. We must ensure that native-app integration and production testing never silently substitute mock results for real backend failures.

## 2. Target architecture

Keep the current web app and backend. Add a separate native Android client.

```
Android (Kotlin + Compose)          Web (existing Next.js app)
        |                                  |
        +---------- Existing Cloudflare API --+
                   |                          |
        Authentication · discovery · chat · playback · library
                   |
              Neon PostgreSQL
                   |
        Media storage · Metadata provider and AI service
                   |
        TMDB adapter · AI orchestration · verified playback connectors
```

For Android, I recommend Kotlin, Jetpack Compose, Navigation Compose, Retrofit or Ktor for API requests, Media3 ExoPlayer for authorized in-app playback, and the Firebase Android SDK for authentication. Keep dependencies modular and avoid unnecessary frameworks.

## 3. Implementation phases

Recommended order. Each phase has a testable completion condition.

### 01 — Audit and stabilize the existing backend

* Verify deployed routes, database migrations, Firebase authentication and environment configuration.
* Test discovery, title details, watchlists, progress and streaming URL generation against real services.
* Identify missing AI and conversation endpoints.
* Disable mock fallback in production and staging.
* Verify that streaming routes enforce authentication, title permissions and authorization.

**Complete when** a real client can rely on documented, tested API contracts.

### 02 — Create the native Android foundation

* Add an independent `apps/android` project without disrupting npm workspaces.
* Configure Kotlin, Compose, Gradle, app signing configuration and build variants.
* Implement the dark Veyra design system, navigation, loading states and error handling.
* Add API networking, Firebase sign-in and secure session handling.

**Complete when** the app builds and users can sign in and load real backend data.

### 03 — Build the chat-first experience

* Create the conversation list, new conversation flow, message composer and message history.
* Render rich movie and TV recommendation cards inside messages.
* Support title previews, recommendation explanations, follow-up prompts and retry behavior.
* Add backend persistence for conversations and messages if it is not already present.

**Complete when** a conversation survives app restarts and displays real discovery results.

### 04 — Implement AI orchestration

Add a backend AI service and controlled tools for `search_movies`, `search_tv`, `get_title_details`, `get_watch_options`, `save_to_watchlist` and `play_title`.

The AI should receive structured tool results, explain recommendations, ask clarifying questions and maintain conversational context. It must not invent provider URLs or bypass playback authorization.

**Complete when** natural-language requests reliably produce relevant, structured recommendations.

### 05 — Connect discovery, title details and playback

* Build the title details screen for movies and TV series.
* Support season selection and episode lists.
* Add a playback-options sheet showing authorized in-app and external options.
* Integrate Media3 for in-app playback, progress saving and resume.
* Implement supported external app/deep-link handoff.

**Complete when** the user can request a title, choose it and reach a valid playback destination.

### 06 — Finish the standalone MVP

* Add Library, watchlist, history and Continue Watching.
* Test network interruptions, expired playback links, empty results, unauthorized content and API timeouts.
* Test on a real Android device and verify the release build.
* Add privacy, content reporting and production error monitoring.

**Complete when** the full discovery-to-playback journey works without mock data.

## 4. First milestone: prove the complete journey

Do not start by building every screen. First, get this vertical slice working:

* Open Veyra and sign in.
* Start a conversation and ask, "Recommend a suspenseful sci-fi series."
* The backend calls the discovery tool and returns real TV results.
* The app displays recommendation cards.
* Open a series details screen and select an episode.
* Tap Play and either start an authorized in-app stream or open a supported external provider.
* Return to chat and retain the conversation context.

This tests the hardest integration points before investing in the rest of the UI.

## 5. Backend work to prioritize

The existing API already provides useful foundations, but these areas need explicit verification:

| Area           | Required work                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Discovery      | Reuse existing TMDB endpoints and add missing season/episode detail routes if necessary.                  |
| AI chat        | Implement the AI endpoint, tool schemas, conversation persistence and safe tool execution if absent.      |
| Playback       | Fix incomplete routes, validate stream permissions, handle expiring URLs and confirm media compatibility. |
| Watch progress | Finish continue-watching retrieval and ensure episode progress is handled consistently.                   |
| Licensing      | Confirm permission for TMDB use in an AI-powered commercial product before production.                    |
| Reliability    | Use structured errors, timeouts, limited retries and real integration tests.                              |

Do not start with live TV or social watch parties. They are follow-on features after the native app can reliably discover and play a movie or episode.

## 6. Definition of done

The first standalone release should meet these criteria:

* Native Android build installs and launches reliably.
* Firebase sign-in and protected API calls work.
* Chat history persists.
* Movie and TV search return real results.
* Recommendation cards and title details display correctly.
* At least one authorized in-app playback route works end to end.
* External handoff works for at least one supported provider.
* Watchlist and playback progress persist.
* Backend failures never masquerade as successful results.
* No Bro integration is required.

The implementation should begin with Phase 1, not a UI rewrite. Stabilize the API contracts, then create the Android project and connect one complete user journey before expanding the feature set.

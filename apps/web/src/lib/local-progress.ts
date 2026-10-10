/**
 * Local (device-only) watch progress.
 *
 * Veyra has no accounts, so watch progress lives entirely on the device in
 * localStorage. Nothing is uploaded — this keeps the app fully anonymous.
 */

export interface LocalProgress {
  movieId: number;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
}

const STORAGE_KEY = 'veyra:watch-progress';
const MAX_ENTRIES = 100;

function readAll(): Record<string, LocalProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, LocalProgress>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage full or unavailable — drop progress silently.
  }
}

/** All locally stored progress entries, most recently updated first. */
export function getAllProgress(): LocalProgress[] {
  return Object.values(readAll()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

/** Progress for a single title, or null when the user never started it. */
export function getProgress(movieId: number): LocalProgress | null {
  return readAll()[String(movieId)] ?? null;
}

/** Incomplete (still in-progress) entries, most recent first. */
export function getContinueWatching(limit = 6): LocalProgress[] {
  return getAllProgress()
    .filter((p) => !p.completed && p.position > 0)
    .slice(0, limit);
}

/** Record playback position. Marks complete at 90% watched. */
export function saveProgress(
  movieId: number,
  position: number,
  duration: number
): LocalProgress {
  const map = readAll();
  const entry: LocalProgress = {
    movieId,
    position: Math.floor(position),
    duration: Math.floor(duration),
    completed: duration > 0 && position >= duration * 0.9,
    updatedAt: new Date().toISOString(),
  };
  map[String(movieId)] = entry;

  // Keep the store bounded — drop the oldest entries past the cap.
  const keys = Object.keys(map).sort(
    (a, b) =>
      new Date(map[a].updatedAt).getTime() - new Date(map[b].updatedAt).getTime()
  );
  while (keys.length > MAX_ENTRIES) {
    delete map[keys.shift() as string];
  }

  writeAll(map);
  return entry;
}

/** Remove progress for a title. */
export function clearProgress(movieId: number) {
  const map = readAll();
  delete map[String(movieId)];
  writeAll(map);
}

/** Remove every stored entry. */
export function clearAllProgress() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
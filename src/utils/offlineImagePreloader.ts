import { Song, Playlist, UserProfile } from '../types';

/**
 * Cache of URLs already preloaded in memory during this browser session.
 */
const preloadedUrls = new Set<string>();

/**
 * Checks if a string is a valid remote image URL that can be preloaded.
 */
function isValidImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  // Base64 data URLs are already fully stored locally in IndexedDB/localStorage
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return false;
  // Must be http or https or absolute/relative path
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  );
}

/**
 * Preloads a single image by firing a no-cors fetch (handled by Service Worker)
 * and decoding an Image element for instant offline rendering.
 */
export async function preloadSingleImage(url: string): Promise<void> {
  if (!isValidImageUrl(url)) return;
  const trimmed = url.trim();
  if (preloadedUrls.has(trimmed)) return;
  preloadedUrls.add(trimmed);

  try {
    // 1. Fetch via Service Worker (populates IMAGE_CACHE)
    if (typeof fetch !== 'undefined') {
      fetch(trimmed, { mode: 'no-cors', cache: 'force-cache' }).catch(() => {});
    }

    // 2. Decode image in browser memory
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.decoding = 'async';
      img.src = trimmed;
    }
  } catch {
    // Non-blocking: background preloading should never crash the app
  }
}

/**
 * Collects and preloads all covers, album art, avatars, and playlist graphics
 * across the entire app so that they are stored in the Service Worker offline cache.
 */
export async function preloadAllAppImages(params: {
  songs?: Song[];
  playlists?: Playlist[];
  users?: UserProfile[];
  additionalUrls?: (string | undefined | null)[];
}): Promise<void> {
  const targetUrls = new Set<string>();

  // 1. Song covers
  if (params.songs && Array.isArray(params.songs)) {
    for (const song of params.songs) {
      if (isValidImageUrl(song.coverUrl)) {
        targetUrls.add(song.coverUrl.trim());
      }
    }
  }

  // 2. Playlist covers
  if (params.playlists && Array.isArray(params.playlists)) {
    for (const pl of params.playlists) {
      if (isValidImageUrl(pl.coverUrl)) {
        targetUrls.add(pl.coverUrl.trim());
      }
    }
  }

  // 3. User Avatars
  if (params.users && Array.isArray(params.users)) {
    for (const u of params.users) {
      if (isValidImageUrl(u.avatarUrl)) {
        targetUrls.add(u.avatarUrl.trim());
      }
    }
  }

  // 4. Any extra URLs
  if (params.additionalUrls && Array.isArray(params.additionalUrls)) {
    for (const extra of params.additionalUrls) {
      if (isValidImageUrl(extra)) {
        targetUrls.add(extra.trim());
      }
    }
  }

  // Filter out already preloaded
  const toProcess = Array.from(targetUrls).filter((u) => !preloadedUrls.has(u));
  if (toProcess.length === 0) return;

  // Process in small batches (e.g. 5 concurrent) to avoid congesting network
  const BATCH_SIZE = 5;
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map((url) => preloadSingleImage(url)));
    // Minimal yield between batches
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
}

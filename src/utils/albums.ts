import { Song, Album } from '../types';

/**
 * Extracts unified albums from catalog songs.
 * Groups by normalized album name so guest collaborations and multi-artist
 * tracks within the same album are never split into separate albums.
 */
export function getAlbumsFromCatalog(catalog: Song[]): Album[] {
  if (!catalog || catalog.length === 0) return [];

  const map = new Map<string, Album>();

  catalog.forEach((song) => {
    if (!song.album || song.album.trim().toLowerCase() === 'sencillo') return;
    const albumKey = song.album.trim().toLowerCase();

    // Primary artist extraction: supports "Aitana, Kenia Os", "Aitana & Kenia Os", "Aitana feat. Kenia Os"
    const parsedArtist = song.artist.split(/[,&/]|feat\.|ft\./i)[0].trim();
    const primaryArtist = song.albumArtist?.trim() || parsedArtist || song.artist.trim();

    if (!map.has(albumKey)) {
      map.set(albumKey, {
        name: song.album.trim(),
        artist: primaryArtist,
        coverUrl: song.coverUrl,
        year: song.year,
        genre: song.genre,
        songs: [],
      });
    }
    map.get(albumKey)!.songs.push(song);
  });

  // Consolidate album details (e.g. determine primary album artist & sort tracks)
  map.forEach((alb) => {
    // 1. Determine dominant album artist (most frequent primary artist or explicit albumArtist)
    const artistCounts = new Map<string, number>();
    alb.songs.forEach((s) => {
      const art = s.albumArtist?.trim() || s.artist.split(/[,&/]|feat\.|ft\./i)[0].trim();
      if (art) {
        artistCounts.set(art, (artistCounts.get(art) || 0) + 1);
      }
    });

    let bestArtist = alb.artist;
    let maxCount = 0;
    artistCounts.forEach((count, art) => {
      if (count > maxCount) {
        maxCount = count;
        bestArtist = art;
      }
    });
    alb.artist = bestArtist;

    // 2. Pick best cover
    const validCover = alb.songs.find((s) => Boolean(s.coverUrl))?.coverUrl;
    if (validCover) alb.coverUrl = validCover;

    // 3. Sort tracks by trackNumber if available
    alb.songs.sort((a, b) => {
      const numA = typeof a.trackNumber === 'number' && a.trackNumber > 0 ? a.trackNumber : 999;
      const numB = typeof b.trackNumber === 'number' && b.trackNumber > 0 ? b.trackNumber : 999;
      if (numA !== numB) return numA - numB;
      return a.title.localeCompare(b.title);
    });
  });

  return Array.from(map.values());
}

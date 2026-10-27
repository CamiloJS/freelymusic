/**
 * Metadata proxy for MusicBrainz and LRCLIB.
 * Keeps the required User-Agent, avoids browser CORS issues and applies a
 * small in-memory cache. No secrets are required.
 */

const USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT ||
  'freelymusic/1.0 ( https://freelymusic.vercel.app )';

const memoryCache = new Map();

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.end(JSON.stringify(payload));
}

function cacheGet(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttlMs = 60 * 60 * 1000) {
  if (memoryCache.size > 200) {
    const oldest = memoryCache.keys().next().value;
    memoryCache.delete(oldest);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function textMatch(a, b) {
  const normalize = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const first = normalize(a);
  const second = normalize(b);
  return Boolean(first && second) && (first === second || first.includes(second) || second.includes(first));
}

async function fetchJson(url, attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      });
      if (response.status === 503 && attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
        continue;
      }
      if (!response.ok) {
        const error = new Error(`Fuente respondió ${response.status}`);
        error.statusCode = response.status;
        throw error;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error('No se pudo consultar la fuente');
}

async function musicbrainz(title, artist) {
  const query = `recording:"${String(title).replace(/"/g, '')}" AND artist:"${String(
    artist
  ).replace(/"/g, '')}"`;
  const key = `mb:${query}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const payload = await fetchJson(
    `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(
      query
    )}&fmt=json&limit=5`
  );

  const recordings = (payload.recordings || []).map((recording) => ({
    id: recording.id,
    score: recording.score,
    title: recording.title,
    length: recording.length,
    'artist-credit': (recording['artist-credit'] || []).map((credit) => ({
      name: credit.name,
    })),
    isrcs: recording.isrcs || [],
    tags: (recording.tags || []).slice(0, 4).map((tag) => ({ name: tag.name })),
    releases: (recording.releases || []).slice(0, 4).map((release) => ({
      id: release.id,
      title: release.title,
      date: release.date,
      'release-group': release['release-group']
        ? {
            id: release['release-group'].id,
            title: release['release-group'].title,
          }
        : undefined,
    })),
  }));

  const result = { source: 'musicbrainz', recordings };
  cacheSet(key, result);
  return result;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function deezerArtist(name) {
  const key = `dz-artist:${normalizeName(name)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const payload = await fetchJson(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=25`
  );
  const normalized = normalizeName(name);
  const candidates = (payload.data || []).filter(
    (artist) => normalizeName(artist.name) === normalized
  );

  if (candidates.length === 0) {
    const error = new Error('Deezer no encontró el artista.');
    error.statusCode = 404;
    throw error;
  }

  const best = candidates.sort((a, b) => (Number(b.nb_fan) || 0) - (Number(a.nb_fan) || 0))[0];
  const result = {
    source: 'deezer',
    name: best.name,
    fans: Number(best.nb_fan) || undefined,
    url: best.link,
    fetchedAt: new Date().toISOString(),
    period: 'Datos actuales de Deezer (caché semanal)',
    note: 'Deezer publica fans totales, no oyentes mensuales. La cifra no equivale a Spotify.',
  };
  cacheSet(key, result, 7 * 24 * 60 * 60 * 1000);
  return result;
}

async function deezerTrack(title, artist) {
  const key = `dz-track:${normalizeName(artist)}:${normalizeName(title)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const payload = await fetchJson(
    `https://api.deezer.com/search?q=${encodeURIComponent(`${title} ${artist}`)}&limit=12`
  );
  const wantedTitle = normalizeName(title);
  const wantedArtist = normalizeName(artist);

  const candidates = (payload.data || [])
    .map((track) => {
      const trackTitle = normalizeName(track.title);
      const trackArtist = normalizeName(track.artist?.name);
      let score = 0;
      if (trackTitle === wantedTitle) score += 0.65;
      else if (trackTitle.includes(wantedTitle) || wantedTitle.includes(trackTitle)) score += 0.4;
      if (trackArtist === wantedArtist) score += 0.35;
      else if (trackArtist.includes(wantedArtist) || wantedArtist.includes(trackArtist)) score += 0.2;
      return { track, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 0.55) {
    const error = new Error('Deezer no encontró una coincidencia fiable para esta canción.');
    error.statusCode = 404;
    throw error;
  }

  const result = {
    source: 'deezer',
    name: best.track.title,
    artist: best.track.artist?.name,
    rank: Number(best.track.rank) || undefined,
    url: best.track.id ? `https://www.deezer.com/track/${best.track.id}` : undefined,
    fetchedAt: new Date().toISOString(),
    period: 'Datos actuales de Deezer (caché semanal)',
    note: 'Deezer no publica reproducciones; se muestra su ranking de popularidad (0-1.000.000).',
  };
  cacheSet(key, result, 7 * 24 * 60 * 60 * 1000);
  return result;
}

async function lyrics(title, artist, album, duration) {
  const key = `lyrics:${title}:${artist}:${album || ''}:${duration || ''}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    track_name: String(title),
    artist_name: String(artist),
  });
  if (album) params.set('album_name', String(album));
  if (duration) params.set('duration', String(Math.round(Number(duration))));

  try {
    const exact = await fetchJson(`https://lrclib.net/api/get?${params.toString()}`, 2);
    if (typeof exact.syncedLyrics === 'string' && exact.syncedLyrics.trim()) {
      const result = {
        source: 'LRCLIB',
        lrc: exact.syncedLyrics,
        trackName: exact.trackName,
        artistName: exact.artistName,
        duration: exact.duration,
      };
      cacheSet(key, result);
      return result;
    }
  } catch {
    // Search below.
  }

  const searchParams = new URLSearchParams({
    track_name: String(title),
    artist_name: String(artist),
  });
  const results = await fetchJson(
    `https://lrclib.net/api/search?${searchParams.toString()}`,
    3
  );

  const candidates = (Array.isArray(results) ? results : [])
    .filter((item) => typeof item.syncedLyrics === 'string' && item.syncedLyrics.trim())
    .map((item) => {
      const durationPenalty =
        duration && Number.isFinite(Number(item.duration))
          ? Math.min(Math.abs(Number(item.duration) - Number(duration)), 60)
          : 30;
      const score =
        (textMatch(item.trackName, title) ? 1 : 0) +
        (textMatch(item.artistName, artist) ? 1 : 0) -
        durationPenalty / 60;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0]?.item;
  const result = best
    ? {
        source: 'LRCLIB',
        lrc: best.syncedLyrics,
        trackName: best.trackName,
        artistName: best.artistName,
        duration: best.duration,
      }
    : { source: 'LRCLIB', lrc: null };

  cacheSet(key, result, best ? 60 * 60 * 1000 : 5 * 60 * 1000);
  return result;
}

async function cover(title, artist, album, isAlbum) {
  const query = [artist, album || title].filter(Boolean).join(' ');
  const key = `cover:${query}:${Boolean(isAlbum)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  // 1. iTunes Search
  try {
    const itunesEntity = isAlbum ? 'album' : 'song';
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=${itunesEntity}&limit=5`;
    const payload = await fetchJson(itunesUrl, 2);
    const results = Array.isArray(payload.results) ? payload.results : [];
    if (results.length > 0) {
      const best = results[0];
      const artwork = best.artworkUrl100 || best.artworkUrl60;
      if (typeof artwork === 'string') {
        const coverUrl = artwork.replace(/\/\d+x\d+bb\./, '/600x600bb.');
        const result = { source: 'iTunes', coverUrl };
        cacheSet(key, result);
        return result;
      }
    }
  } catch (err) {
    // Continue to Deezer
  }

  // 2. Deezer Search
  try {
    const deezerEndpoint = isAlbum ? 'album' : 'track';
    const deezerUrl = `https://api.deezer.com/search/${deezerEndpoint}?q=${encodeURIComponent(query)}&limit=5`;
    const payload = await fetchJson(deezerUrl, 2);
    const items = Array.isArray(payload.data) ? payload.data : [];
    if (items.length > 0) {
      const best = items[0];
      const artwork = isAlbum
        ? (best.cover_xl || best.cover_big || best.cover_medium)
        : (best.album?.cover_xl || best.album?.cover_big || best.album?.cover_medium);
      if (artwork) {
        const result = { source: 'Deezer', coverUrl: artwork };
        cacheSet(key, result);
        return result;
      }
    }
  } catch (err) {
    // Continue
  }

  return { source: 'none', coverUrl: null };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return send(res, 405, { error: 'method_not_allowed', message: 'Usa GET.' });
  }

  const source = String(req.query.source || '');
  const title = String(req.query.title || '');
  const artist = String(req.query.artist || '');
  const name = String(req.query.name || req.query.title || '');

  if (source === 'cover') {
    if (!title && !artist && !req.query.album) {
      return send(res, 400, { error: 'missing_params', message: 'Se requiere title, artist o album.' });
    }
  } else if (source === 'deezer-artist') {
    if (!name) {
      return send(res, 400, { error: 'missing_params', message: 'Se requiere name.' });
    }
  } else if (source === 'deezer-track') {
    if (!title || !artist) {
      return send(res, 400, {
        error: 'missing_params',
        message: 'Se requieren title y artist.',
      });
    }
  } else if (!title || !artist) {
    return send(res, 400, {
      error: 'missing_params',
      message: 'Se requieren title y artist.',
    });
  }

  try {
    if (source === 'cover') {
      return send(
        res,
        200,
        await cover(title, artist, req.query.album ? String(req.query.album) : undefined, req.query.isAlbum === 'true')
      );
    }
    if (source === 'musicbrainz') {
      return send(res, 200, await musicbrainz(title, artist));
    }
    if (source === 'lyrics') {
      return send(
        res,
        200,
        await lyrics(
          title,
          artist,
          req.query.album ? String(req.query.album) : undefined,
          req.query.duration ? Number(req.query.duration) : undefined
        )
      );
    }
    if (source === 'deezer-artist') {
      return send(res, 200, await deezerArtist(name));
    }
    if (source === 'deezer-track') {
      return send(res, 200, await deezerTrack(title, artist));
    }
    return send(res, 400, {
      error: 'unsupported_source',
      message: 'Usa source=cover, source=musicbrainz, source=lyrics, source=deezer-artist o source=deezer-track.',
    });
  } catch (error) {
    console.error('Metadata proxy failed:', error);
    return send(res, error.statusCode || 502, {
      error: 'metadata_failed',
      message: error.message || 'No se pudo consultar la fuente.',
    });
  }
}

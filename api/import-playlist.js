/**
 * Vercel serverless function: official playlist import for Spotify and Apple Music.
 * Deezer is public and handled directly in the client, but is also supported here.
 *
 * Required environment variables (Vercel → Project → Settings → Environment Variables):
 *   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET  (free Spotify Developer app)
 *   APPLE_MUSIC_DEVELOPER_TOKEN               (MusicKit developer token)
 */

let spotifyTokenCache = { token: null, expiresAt: 0 };

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

async function getSpotifyToken() {
  if (
    spotifyTokenCache.token &&
    Date.now() < spotifyTokenCache.expiresAt - 30_000
  ) {
    return spotifyTokenCache.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const error = new Error(
      'Falta configurar SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en Vercel. Créalos gratis en developer.spotify.com.'
    );
    error.statusCode = 503;
    throw error;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    const error = new Error(
      payload.error_description || 'Spotify rechazó las credenciales del servidor.'
    );
    error.statusCode = 502;
    throw error;
  }

  spotifyTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in || 3600) * 1000,
  };
  return payload.access_token;
}

function spotifyPlaylistId(url) {
  const match =
    String(url).match(/playlist\/([a-zA-Z0-9]+)/) ||
    String(url).match(/spotify:playlist:([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

async function importSpotify(url) {
  const id = spotifyPlaylistId(url);
  if (!id) {
    const error = new Error('El enlace de Spotify no contiene un ID de playlist válido.');
    error.statusCode = 400;
    throw error;
  }

  const token = await getSpotifyToken();
  const headers = { Authorization: `Bearer ${token}` };

  const firstResponse = await fetch(
    `https://api.spotify.com/v1/playlists/${id}?limit=100`,
    { headers }
  );
  if (!firstResponse.ok) {
    const error = new Error(
      firstResponse.status === 404
        ? 'Spotify no encontró la playlist. Debe ser pública.'
        : `Spotify respondió ${firstResponse.status}.`
    );
    error.statusCode = 502;
    throw error;
  }

  const playlist = await firstResponse.json();
  const tracks = [];
  let next = playlist.tracks?.next;
  let page = 0;
  const pages = [playlist];

  while (next && page < 9) {
    const response = await fetch(next, { headers });
    if (!response.ok) break;
    pages.push(await response.json());
    next = pages[pages.length - 1]?.next;
    page += 1;
  }

  pages.forEach((current) => {
    (current.tracks?.items || []).forEach((entry) => {
      const track = entry?.track || entry?.item;
      if (!track || track.is_local || !track.name) return;
      tracks.push({
        title: track.name,
        artist: (track.artists || []).map((artist) => artist.name).filter(Boolean).join(', '),
        album: track.album?.name,
        duration: track.duration_ms ? Math.round(track.duration_ms / 1000) : undefined,
        isrc: track.external_ids?.isrc,
        providerId: track.id,
      });
    });
  });

  return {
    name: playlist.name || 'Playlist de Spotify',
    description: playlist.description || undefined,
    source: 'spotify',
    tracks,
  };
}

function applePlaylistInfo(url) {
  const value = String(url);
  const idMatch = value.match(/playlist\/[^/]+\/(pl\.[a-zA-Z0-9-]+)/) || value.match(/(pl\.[a-zA-Z0-9-]+)/);
  const storeMatch = value.match(/music\.apple\.com\/([a-z]{2})\//i);
  return {
    id: idMatch ? idMatch[1] : null,
    storefront: storeMatch ? storeMatch[1].toLowerCase() : 'us',
  };
}

async function importAppleMusic(url, providedToken) {
  const { id, storefront } = applePlaylistInfo(url);
  if (!id) {
    const error = new Error('El enlace de Apple Music no contiene un ID de playlist válido.');
    error.statusCode = 400;
    throw error;
  }

  const token = providedToken || process.env.APPLE_MUSIC_DEVELOPER_TOKEN;
  if (!token) {
    const error = new Error(
      'Apple Music necesita un token de desarrollador de MusicKit. Configura APPLE_MUSIC_DEVELOPER_TOKEN en Vercel o pégalo en el importador. Apple requiere una cuenta de desarrollador (de pago). Mientras tanto, puedes importar la lista como texto.'
    );
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(
    `https://api.music.apple.com/v1/catalog/${storefront}/playlists/${id}?include=tracks&limit[tracks]=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const error = new Error(
      response.status === 401 || response.status === 403
        ? 'El token de Apple Music no es válido o expiró.'
        : `Apple Music respondió ${response.status}.`
    );
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json();
  const playlist = payload.data?.[0];
  if (!playlist) {
    const error = new Error('Apple Music no devolvió la playlist.');
    error.statusCode = 404;
    throw error;
  }

  const tracks = [];
  const push = (items) => {
    (items || []).forEach((item) => {
      const attributes = item.attributes || {};
      if (!attributes.name) return;
      tracks.push({
        title: attributes.name,
        artist: attributes.artistName || '',
        album: attributes.albumName,
        duration: attributes.durationInMillis
          ? Math.round(attributes.durationInMillis / 1000)
          : undefined,
        isrc: attributes.isrc,
        providerId: item.id,
      });
    });
  };

  push(playlist.relationships?.tracks?.data);

  // If the relationship was not included, fetch the dedicated tracks endpoint.
  if (tracks.length === 0) {
    const tracksResponse = await fetch(
      `https://api.music.apple.com/v1/catalog/${storefront}/playlists/${id}/tracks?limit=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (tracksResponse.ok) {
      const tracksPayload = await tracksResponse.json();
      push(tracksPayload.data);
    }
  }

  return {
    name: playlist.attributes?.name || 'Playlist de Apple Music',
    description: playlist.attributes?.description?.standard || undefined,
    source: 'apple-music',
    tracks,
  };
}

async function importDeezer(url) {
  const match = String(url).match(/playlist\/(\d+)/) || String(url).match(/^(\d+)$/);
  if (!match) {
    const error = new Error('El enlace de Deezer no contiene un ID de playlist válido.');
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch(`https://api.deezer.com/playlist/${match[1]}`);
  if (!response.ok) {
    const error = new Error('Deezer no devolvió la playlist.');
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json();
  if (payload.error) {
    const error = new Error(payload.error.message || 'Deezer no encontró la playlist.');
    error.statusCode = 404;
    throw error;
  }

  const tracks = [];
  let next = payload.tracks?.next;
  let page = 0;

  const push = (items) => {
    (items || []).forEach((item) => {
      if (!item.title) return;
      tracks.push({
        title: item.title,
        artist: item.artist?.name || '',
        album: item.album?.title,
        duration: item.duration,
        isrc: item.isrc,
        providerId: item.id !== undefined ? String(item.id) : undefined,
      });
    });
  };

  push(payload.tracks?.data);

  while (next && page < 4) {
    const nextResponse = await fetch(next);
    if (!nextResponse.ok) break;
    const nextPayload = await nextResponse.json();
    push(nextPayload.data);
    next = nextPayload.next;
    page += 1;
  }

  return {
    name: payload.title || 'Playlist de Deezer',
    description: payload.description || undefined,
    source: 'deezer',
    tracks,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'method_not_allowed', message: 'Usa POST.' });
  }

  const { provider, url, appleMusicToken } = parseBody(req);

  try {
    let result;
    if (provider === 'spotify') {
      result = await importSpotify(url);
    } else if (provider === 'apple-music') {
      result = await importAppleMusic(url, appleMusicToken);
    } else if (provider === 'deezer') {
      result = await importDeezer(url);
    } else {
      return send(res, 400, {
        error: 'unsupported_provider',
        message: 'Proveedor no soportado. Usa spotify, deezer o apple-music.',
      });
    }

    return send(res, 200, result);
  } catch (error) {
    console.error('Playlist import failed:', error);
    return send(res, error.statusCode || 500, {
      error: 'import_failed',
      message: error.message || 'No se pudo importar la playlist.',
    });
  }
}

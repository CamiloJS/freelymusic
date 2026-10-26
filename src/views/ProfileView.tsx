import React, { useMemo } from 'react';
import Headphones from 'lucide-react/dist/esm/icons/headphones.mjs';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.mjs';
import UserRound from 'lucide-react/dist/esm/icons/user-round.mjs';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.mjs';
import Flame from 'lucide-react/dist/esm/icons/flame.mjs';
import Clock from 'lucide-react/dist/esm/icons/clock.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Music from 'lucide-react/dist/esm/icons/music.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import Chart from 'lucide-react/dist/esm/icons/chart-no-axes-column.mjs';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Playlist, Song } from '../types';
import { formatListeningTime } from '../utils/lyrics';
import { ArtistLinks } from '../components/ArtistLinks';

interface ProfileViewProps {
  onSelectPlaylist: (playlist: Playlist) => void;
  onSelectArtist: (artistName: string) => void;
  onOpenCreatePlaylist: () => void;
  onOpenImportPlaylist?: () => void;
  onNavigate: (tab: string) => void;
}

interface ArtistRank {
  name: string;
  plays: number;
  seconds: number;
  coverUrl?: string;
}

function primaryArtist(artist: string): string {
  return (artist || 'Artista desconocido').split(/[,&/]|feat\.|ft\./i)[0].trim();
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onSelectPlaylist,
  onSelectArtist,
  onOpenCreatePlaylist,
  onOpenImportPlaylist,
  onNavigate,
}) => {
  const { currentUser } = useAuth();
  const {
    catalog,
    playlists,
    userFavoriteSongs,
    userPlayCounts,
    userSongListenSeconds,
    userArtistListenSeconds,
    userPlayHistory,
  } = useMusic();
  const { playSong, currentSong, isPlaying, togglePlayPause } = useAudio();

  const totalPlays = useMemo(
    () => Object.values(userPlayCounts || {}).reduce((total, count) => total + count, 0),
    [userPlayCounts]
  );

  const totalListenSeconds = useMemo(
    () =>
      Object.values(userSongListenSeconds || {}).reduce(
        (total, seconds) => total + seconds,
        0
      ),
    [userSongListenSeconds]
  );

  const topSongs = useMemo(
    () =>
      catalog
        .map((song) => ({
          song,
          plays: userPlayCounts?.[song.id] || 0,
          seconds: userSongListenSeconds?.[song.id] || 0,
        }))
        .filter((entry) => entry.plays > 0 || entry.seconds > 0)
        .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
        .slice(0, 8),
    [catalog, userPlayCounts, userSongListenSeconds]
  );

  const topArtists = useMemo((): ArtistRank[] => {
    const map = new Map<string, ArtistRank>();

    Object.entries(userArtistListenSeconds || {}).forEach(([name, seconds]) => {
      map.set(name, { name, plays: 0, seconds });
    });

    catalog.forEach((song) => {
      const plays = userPlayCounts?.[song.id] || 0;
      if (plays <= 0) return;

      const name = primaryArtist(song.artist);
      const existing = map.get(name) || { name, plays: 0, seconds: 0 };
      existing.plays += plays;
      existing.coverUrl = existing.coverUrl || song.coverUrl;
      map.set(name, existing);
    });

    map.forEach((rank) => {
      if (!rank.coverUrl) {
        const song = catalog.find((item) => primaryArtist(item.artist) === rank.name);
        rank.coverUrl = song?.coverUrl;
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
      .slice(0, 6);
  }, [catalog, userPlayCounts, userArtistListenSeconds]);

  const recentPlays = useMemo(
    () =>
      (userPlayHistory || [])
        .slice(0, 10)
        .map((event) => ({
          event,
          song: catalog.find((song) => song.id === event.songId),
        }))
        .filter((entry) => Boolean(entry.song)),
    [userPlayHistory, catalog]
  );

  const uniqueSongs = Object.keys(userPlayCounts || {}).length;
  const uniqueArtists = useMemo(() => {
    const names = new Set(Object.keys(userArtistListenSeconds || {}));
    catalog.forEach((song) => {
      if ((userPlayCounts?.[song.id] || 0) > 0) {
        names.add(primaryArtist(song.artist));
      }
    });
    return names.size;
  }, [catalog, userPlayCounts, userArtistListenSeconds]);
  const topSongsQueue = topSongs.map((entry) => entry.song);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto pb-32">
      {/* Profile hero */}
      <section className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/70 via-neutral-900 to-black p-6 md:p-8 shadow-2xl">
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.displayName}
            className="w-24 h-24 md:w-32 md:h-32 rounded-3xl object-cover ring-4 ring-emerald-500/30 shadow-2xl"
          />
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
              <UserRound className="w-3 h-3" />
              {currentUser.role === 'admin' ? 'Administrador' : 'Miembro'}
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mt-2 truncate">
              {currentUser.displayName}
            </h1>
            <p className="text-sm text-neutral-400 mt-1">@{currentUser.username}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-2">
              <CalendarDays className="w-3.5 h-3.5" />
              Miembro desde {new Date(currentUser.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('library')}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors"
            >
              Mi biblioteca
            </button>
            <button
              onClick={() => onNavigate('cloud')}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold transition-colors"
            >
              Explorar música
            </button>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
            <Headphones className="w-3.5 h-3.5" />
            Reproducciones
          </div>
          <p className="text-2xl md:text-3xl font-black text-white mt-2">{totalPlays}</p>
          <p className="text-[11px] text-neutral-500">en toda tu cuenta</p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            Tiempo escuchado
          </div>
          <p className="text-2xl md:text-3xl font-black text-white mt-2">
            {formatListeningTime(totalListenSeconds)}
          </p>
          <p className="text-[11px] text-neutral-500">tiempo registrado</p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
            <Music className="w-3.5 h-3.5" />
            Canciones
          </div>
          <p className="text-2xl md:text-3xl font-black text-white mt-2">{uniqueSongs}</p>
          <p className="text-[11px] text-neutral-500">distintas escuchadas</p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" />
            Artistas
          </div>
          <p className="text-2xl md:text-3xl font-black text-white mt-2">{uniqueArtists}</p>
          <p className="text-[11px] text-neutral-500">en tu ranking</p>
        </div>
      </section>

      {/* Top songs + top artists */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              <Flame className="w-5 h-5 text-emerald-400" />
              Tus canciones más escuchadas
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Top {topSongs.length}
            </span>
          </div>

          {topSongs.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-500">
              Aún no hay reproducciones registradas. Dale play a algo y vuelve aquí.
            </div>
          ) : (
            <div className="mt-4 space-y-1">
              {topSongs.map(({ song, plays, seconds }, index) => {
                const isCurrent = currentSong?.id === song.id;
                return (
                  <div
                    key={song.id}
                    className={`flex items-center gap-3 rounded-xl p-2 transition-colors ${
                      isCurrent ? 'bg-emerald-500/10' : 'hover:bg-neutral-800/60'
                    }`}
                  >
                    <span className="w-5 text-center text-xs font-mono text-neutral-500">
                      {index + 1}
                    </span>
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      loading="lazy"
                      decoding="async"
                      className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                    />
                    <button
                      onClick={() => {
                        if (isCurrent) togglePlayPause();
                        else playSong(song, topSongsQueue, { type: 'catalog', name: 'Top personal' });
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className={`truncate text-sm font-bold ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                        {song.title}
                      </p>
                      <p className="truncate text-[11px] text-neutral-400">
                        <ArtistLinks artists={song.artist} onSelectArtist={onSelectArtist} />
                      </p>
                    </button>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-neutral-200">{plays} plays</p>
                      <p className="text-[10px] text-neutral-500">{formatListeningTime(seconds)}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (isCurrent && isPlaying) togglePlayPause();
                        else playSong(song, topSongsQueue, { type: 'catalog', name: 'Top personal' });
                      }}
                      className="p-2 rounded-full bg-neutral-800 hover:bg-emerald-500 hover:text-black text-white transition-colors flex-shrink-0"
                      title="Reproducir"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              <Chart className="w-5 h-5 text-emerald-400" />
              Tus artistas favoritos
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Top {topArtists.length}
            </span>
          </div>

          {topArtists.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-500">
              Escucha algunas canciones para construir tu ranking de artistas.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {topArtists.map((artist, index) => (
                <button
                  key={artist.name}
                  onClick={() => onSelectArtist(artist.name)}
                  className="group rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3 text-left hover:bg-neutral-800/60 transition-colors"
                >
                  <div className="relative aspect-square rounded-full overflow-hidden bg-neutral-800 mb-2">
                    {artist.coverUrl ? (
                      <img
                        src={artist.coverUrl}
                        alt={artist.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <UserRound className="w-8 h-8" />
                      </div>
                    )}
                    <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/70 text-white text-[10px] font-black flex items-center justify-center">
                      #{index + 1}
                    </span>
                  </div>
                  <p className="truncate text-xs font-bold text-white">{artist.name}</p>
                  <p className="text-[10px] text-neutral-500">
                    {artist.plays} plays · {formatListeningTime(artist.seconds)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Playlists */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-black text-white">
            <Heart className="w-5 h-5 text-emerald-400" />
            Tus playlists
          </h2>
          <div className="flex items-center gap-2">
            {onOpenImportPlaylist && (
              <button
                onClick={onOpenImportPlaylist}
                className="px-3.5 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-emerald-300 text-xs font-extrabold transition-colors"
              >
                Importar
              </button>
            )}
            <button
              onClick={onOpenCreatePlaylist}
              className="px-3.5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold transition-transform active:scale-95"
            >
              Crear
            </button>
          </div>
        </div>

        {playlists.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-500">
            Todavía no tienes playlists. Crea una o importa una desde otra plataforma.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => onSelectPlaylist(playlist)}
                className="group rounded-2xl border border-neutral-800 bg-neutral-900/50 p-3 text-left hover:bg-neutral-800/60 transition-colors"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 relative">
                  {playlist.coverUrl ? (
                    <img
                      src={playlist.coverUrl}
                      alt={playlist.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                      <Music className="w-10 h-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-8 h-8 text-emerald-400 fill-emerald-400" />
                  </div>
                </div>
                <p className="truncate text-sm font-bold text-white">{playlist.name}</p>
                <p className="text-[11px] text-neutral-500">
                  {playlist.songIds.length} canciones
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Recent history */}
      <section className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-5">
        <h2 className="flex items-center gap-2 text-lg font-black text-white">
          <Clock className="w-5 h-5 text-emerald-400" />
          Historial reciente
        </h2>

        {recentPlays.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">
            Tu historial aparecerá aquí después de escuchar algunas canciones.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-neutral-800/70">
            {recentPlays.map(({ event, song }) => {
              if (!song) return null;
              return (
                <button
                  key={`${event.songId}-${event.playedAt}`}
                  onClick={() =>
                    playSong(song, recentPlays.map((entry) => entry.song).filter((item): item is Song => Boolean(item)))
                  }
                  className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-neutral-800/40 rounded-xl px-2 transition-colors"
                >
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    loading="lazy"
                    decoding="async"
                    className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{song.title}</p>
                    <p className="truncate text-[10px] text-neutral-500">{song.artist}</p>
                  </div>
                  <span className="text-[10px] text-neutral-600 flex-shrink-0">
                    {new Date(event.playedAt).toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

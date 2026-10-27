import React, { useState, useMemo, useRef } from 'react';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import Pause from 'lucide-react/dist/esm/icons/pause.mjs';
import Heart from 'lucide-react/dist/esm/icons/heart.mjs';
import Music from 'lucide-react/dist/esm/icons/eighth-notes.mjs';
import Disc from 'lucide-react/dist/esm/icons/disc.mjs';
import Clock from 'lucide-react/dist/esm/icons/clock.mjs';
import Pencil from 'lucide-react/dist/esm/icons/pencil.mjs';
import Upload from 'lucide-react/dist/esm/icons/upload.mjs';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.mjs';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus.mjs';
import UserCheck from 'lucide-react/dist/esm/icons/user-check.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.mjs';
import Flame from 'lucide-react/dist/esm/icons/flame.mjs';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { Song, Album, ArtistProfile } from '../types';
import { formatTime } from '../utils/lyrics';
import { getAlbumsFromCatalog } from '../utils/albums';
import { compressImage } from '../utils/imageCompressor';
import { ArtistLinks } from '../components/ArtistLinks';
import { DownloadedIcon } from '../components/DownloadedIcon';
import { SavedCheckIcon } from '../components/SavedCheckIcon';

interface ArtistProfileViewProps {
  artistName: string;
  onSelectArtist: (artistName: string) => void;
  onSelectAlbum: (album: Album) => void;
  onOpenAddToPlaylist: (song: Song) => void;
  onBack?: () => void;
}

export const ArtistProfileView: React.FC<ArtistProfileViewProps> = ({
  artistName,
  onSelectArtist,
  onSelectAlbum,
  onOpenAddToPlaylist,
  onBack,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const {
    catalog,
    getArtistProfile,
    updateArtistProfile,
    isFavorite,
    toggleFavorite,
    isDownloaded,
    toggleDownloadSong,
    getUserSongPlayCount,
    isFollowingArtist,
    toggleFollowArtist,
  } = useMusic();

  const { playSong, currentSong, isPlaying, togglePlayPause } = useAudio();

  // Artist profile from cloud/storage
  const profile = getArtistProfile(artistName);

  // Filter songs that belong to this artist (main artist or collaboration)
  const artistSongs = useMemo(() => {
    const q = artistName.trim().toLowerCase();
    return catalog.filter((song) => {
      const parts = song.artist.split(/[,&/]|feat\.|ft\./i).map((p) => p.trim().toLowerCase());
      return parts.includes(q) || song.artist.toLowerCase().includes(q);
    });
  }, [catalog, artistName]);

  // Filter albums where artist is present
  const artistAlbums = useMemo(() => {
    const allAlbums = getAlbumsFromCatalog(catalog);
    const q = artistName.trim().toLowerCase();
    return allAlbums.filter((alb) => {
      const isAlbumArtist = alb.artist.toLowerCase().includes(q);
      const hasSongInAlbum = alb.songs.some((s) => s.artist.toLowerCase().includes(q));
      return isAlbumArtist || hasSongInAlbum;
    });
  }, [catalog, artistName]);

  // Best fallback image from artist songs
  const fallbackCover = useMemo(() => {
    const songWithCover = artistSongs.find((s) => Boolean(s.coverUrl));
    return songWithCover?.coverUrl || '';
  }, [artistSongs]);

  // Edit Artist Modal State (Admin only)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editHeaderUrl, setEditHeaderUrl] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenEdit = () => {
    setEditAvatarUrl(profile?.avatarUrl || fallbackCover || '');
    setEditHeaderUrl(profile?.headerUrl || '');
    setEditBio(profile?.bio || '');
    setSaveSuccessMsg('');
    setIsEditModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida (.jpg, .png, .webp).');
      return;
    }

    try {
      // Raw FileReader base64 could be several MB and exceed Firestore's 1 MB
      // document limit. Compress it like the other image uploads.
      const compressed = await compressImage(file, 500, 0.8);
      if (compressed) {
        setEditAvatarUrl(compressed);
      }
    } catch (err) {
      console.error('Error comprimiendo la foto del artista:', err);
      alert('No se pudo procesar la imagen. Intenta con otra foto.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated: ArtistProfile = {
        id: artistName.trim().toLowerCase(),
        name: artistName.trim(),
        avatarUrl: editAvatarUrl.trim() || undefined,
        headerUrl: editHeaderUrl.trim() || undefined,
        bio: editBio.trim() || undefined,
      };

      await updateArtistProfile(updated);
      setSaveSuccessMsg('¡Perfil de artista guardado y sincronizado para todos los usuarios!');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setSaveSuccessMsg('');
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('Error al guardar el perfil del artista');
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatar = profile?.avatarUrl || fallbackCover;
  const following = isFollowingArtist(artistName);
  const isThisArtistPlaying =
    artistSongs.length > 0 && artistSongs.some((s) => s.id === currentSong?.id) && isPlaying;

  const handlePlayAll = () => {
    if (artistSongs.length === 0) return;
    if (isThisArtistPlaying) {
      togglePlayPause();
    } else {
      playSong(artistSongs[0], artistSongs, {
        type: 'artist',
        name: artistName,
        id: artistName,
      });
    }
  };

  return (
    <div className="pb-36 select-none animate-in fade-in duration-200">
      {/* Hero Header with Background Banner / Overlay */}
      <div className="relative min-h-[320px] md:min-h-[380px] bg-gradient-to-b from-neutral-800 via-neutral-900 to-black p-6 md:p-10 flex flex-col justify-end overflow-hidden">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-5 left-5 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 hover:bg-black/70 border border-white/10 text-white text-xs font-bold backdrop-blur-md transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver</span>
          </button>
        )}

        {/* Background Image Banner if exists */}
        {profile?.headerUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40 blur-sm scale-105"
            style={{ backgroundImage: `url(${profile.headerUrl})` }}
          />
        ) : displayAvatar ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25 blur-md scale-110"
            style={{ backgroundImage: `url(${displayAvatar})` }}
          />
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-end gap-6 max-w-7xl mx-auto w-full">
          {/* Avatar Picture */}
          <div className="w-36 h-36 md:w-52 md:h-52 rounded-full overflow-hidden shadow-2xl ring-4 ring-white/10 flex-shrink-0 bg-neutral-900 relative group">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={artistName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                <Music className="w-16 h-16" />
              </div>
            )}

            {/* Subtle pencil on avatar for Admin */}
            {isAdmin && (
              <button
                onClick={handleOpenEdit}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1.5"
                title="Cambiar foto de artista"
              >
                <Pencil className="w-4 h-4" />
                <span>Editar foto</span>
              </button>
            )}
          </div>

          {/* Artist Info */}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold select-none">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 fill-blue-400 text-black" />
                <span>Artista Verificado</span>
              </span>

              <button
                onClick={() => toggleFollowArtist(artistName)}
                className={`h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                  following
                    ? 'bg-white/10 border-white/25 text-white hover:bg-white/15'
                    : 'bg-emerald-500 border-emerald-500 text-black hover:bg-emerald-400'
                }`}
                title={following ? 'Dejar de seguir artista' : 'Seguir artista'}
              >
                {following ? (
                  <UserCheck className="w-3.5 h-3.5" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                <span>{following ? 'Siguiendo' : 'Seguir'}</span>
              </button>

              {/* Subtle Admin Edit Button */}
              {isAdmin && (
                <button
                  onClick={handleOpenEdit}
                  className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-700 transition-colors"
                  title="Configurar foto, portada y biografía del artista (Visible para todos)"
                >
                  <Pencil className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Configurar artista</span>
                </button>
              )}
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-none py-1 drop-shadow-md">
              {artistName}
            </h1>

            {profile?.bio && (
              <p className="text-xs md:text-sm text-neutral-300 max-w-2xl line-clamp-3 leading-relaxed">
                {profile.bio}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-neutral-400 font-semibold pt-1">
              <span>{artistSongs.length} canciones en catálogo</span>
              <span>•</span>
              <span>{artistAlbums.length} álbumes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="p-6 md:p-8 space-y-10 max-w-7xl mx-auto">
        {/* Play Controls Bar */}
        <div className="flex items-center gap-5">
          <button
            onClick={handlePlayAll}
            disabled={artistSongs.length === 0}
            className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            title={isThisArtistPlaying ? 'Pausar' : 'Reproducir catálogo'}
          >
            {isThisArtistPlaying ? (
              <Pause className="w-6 h-6 fill-black" />
            ) : (
              <Play className="w-6 h-6 fill-black ml-1" />
            )}
          </button>
        </div>

        {/* Section 1: Canciones Populares / Repertorio */}
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Flame className="w-6 h-6 text-emerald-400" />
            <span>Canciones de {artistName}</span>
          </h2>

          {artistSongs.length === 0 ? (
            <div className="p-8 text-center bg-neutral-900/40 rounded-2xl border border-neutral-800">
              <p className="text-neutral-400 text-sm">No se encontraron canciones registradas para este artista.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-900 border-t border-b border-neutral-900">
              {artistSongs.map((song, index) => {
                const isCurrent = currentSong?.id === song.id;
                const liked = isFavorite(song.id);
                const downloaded = isDownloaded(song.id);
                const personalPlayCount = getUserSongPlayCount(song.id);

                return (
                  <div
                    key={song.id}
                    onClick={() => playSong(song, artistSongs, { type: 'artist', name: artistName, id: artistName })}
                    className={`grid grid-cols-12 gap-3 px-4 py-3 rounded-xl items-center cursor-pointer transition-colors group select-none ${
                      isCurrent ? 'bg-neutral-900 text-emerald-400 font-bold' : 'hover:bg-neutral-900/60 text-neutral-300'
                    }`}
                  >
                    {/* # & Play Icon */}
                    <div className="col-span-1 flex items-center justify-center text-xs text-neutral-500">
                      <span className="group-hover:hidden">{index + 1}</span>
                      <Play className="w-3.5 h-3.5 text-white fill-white hidden group-hover:block" />
                    </div>

                    {/* Artwork & Title & Artists */}
                    <div className="col-span-6 md:col-span-5 flex items-center gap-3 truncate">
                      <img
                        src={song.coverUrl}
                        alt={song.title} loading="lazy" decoding="async"
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-neutral-800 shadow"
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          {song.isExplicit && (
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-neutral-600/80 text-black text-[9px] font-black flex-shrink-0">
                              E
                            </span>
                          )}
                          <span className={`text-sm truncate font-semibold ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                            {song.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 truncate mt-0.5">
                          {downloaded && (
                            <span title="Descargado" className="flex-shrink-0">
                              <DownloadedIcon size={12} />
                            </span>
                          )}
                          <ArtistLinks artists={song.artist} onSelectArtist={onSelectArtist} />
                        </div>
                      </div>
                    </div>

                    {/* Album (Clickable) */}
                    <div className="hidden md:block col-span-4 truncate text-xs text-neutral-400">
                      {song.album && song.album.trim().toLowerCase() !== 'sencillo' ? (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            const alb = artistAlbums.find(
                              (a) => a.name.trim().toLowerCase() === song.album.trim().toLowerCase()
                            );
                            if (alb) onSelectAlbum(alb);
                          }}
                          className="hover:underline hover:text-white cursor-pointer"
                          title={`Abrir álbum ${song.album}`}
                        >
                          {song.album}
                        </span>
                      ) : (
                        <span>Sencillo</span>
                      )}
                    </div>

                    {/* Personal Plays & Duration & Heart */}
                    <div className="col-span-5 md:col-span-2 flex items-center justify-end gap-3 text-xs text-neutral-400 font-mono">
                      {/* Personal Play Count */}
                      <span
                        className="text-[11px] text-neutral-500 font-sans hidden sm:inline"
                        title="Veces que has reproducido esta canción"
                      >
                        {personalPlayCount > 0 ? `${personalPlayCount} repros` : '—'}
                      </span>

                      {/* Chulito verde if liked, or plus icon on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(song.id);
                        }}
                        className={`p-1 rounded-full transition-transform active:scale-90 ${
                          liked
                            ? 'hover:scale-110'
                            : 'opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-white hover:scale-110'
                        }`}
                        title={liked ? 'Guardada en Tus me gusta (clic para quitar)' : 'Añadir a Tus me gusta'}
                      >
                        {liked ? (
                          <SavedCheckIcon size={16} />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>

                      <span>{formatTime(song.duration)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Discografía / Álbumes */}
        {artistAlbums.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Disc className="w-6 h-6 text-emerald-400" />
              <span>Discografía y Álbumes</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {artistAlbums.map((alb) => (
                <div
                  key={alb.name}
                  onClick={() => onSelectAlbum(alb)}
                  className="p-3.5 rounded-2xl bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800 cursor-pointer transition-all group"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-3 shadow relative flex items-center justify-center">
                    {alb.coverUrl ? (
                      <img
                        src={alb.coverUrl}
                        alt={alb.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <Disc className="w-12 h-12 text-neutral-600" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-8 h-8 text-emerald-400 fill-emerald-400 drop-shadow-lg" />
                    </div>
                  </div>
                  <h3 className="font-bold text-sm text-white truncate">{alb.name}</h3>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">
                    {alb.year ? `${alb.year} • ` : ''}{alb.songs.length} pistas
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Admin Edit Artist Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-emerald-400" />
                  <span>Configurar Perfil de {artistName}</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  La foto y biografía se sincronizan en la nube para todos los perfiles.
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl text-center font-bold">
                {saveSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Photo Preview & Upload */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-2">Foto de Perfil del Artista</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700 flex-shrink-0 shadow">
                    {editAvatarUrl ? (
                      <img src={editAvatarUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <Music className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 flex-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold border border-neutral-700"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Subir desde mi computador</span>
                    </button>
                    <input
                      type="url"
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      placeholder="O pega URL de imagen (https://...)"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Header / Banner URL */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Foto de Portada / Banner (Opcional)
                </label>
                <input
                  type="url"
                  value={editHeaderUrl}
                  onChange={(e) => setEditHeaderUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... o enlace de portada"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Bio / Description */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Biografía / Descripción del Artista
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Biografía breve, trayectoria, país de origen o descripción del artista..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar y Sincronizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';

interface ArtistLinksProps {
  artists: string;
  onSelectArtist?: (artistName: string) => void;
  className?: string;
  artistClassName?: string;
}

export const ArtistLinks: React.FC<ArtistLinksProps> = ({
  artists,
  onSelectArtist,
  className = '',
  artistClassName = 'hover:underline hover:text-white cursor-pointer transition-colors',
}) => {
  if (!artists) return null;

  // Split by comma while preserving names
  const artistList = artists
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);

  if (artistList.length === 0) {
    return <span className={className}>{artists}</span>;
  }

  return (
    <span className={className}>
      {artistList.map((artist, idx) => (
        <React.Fragment key={idx}>
          <span
            onClick={(e) => {
              if (onSelectArtist) {
                e.stopPropagation();
                onSelectArtist(artist);
              }
            }}
            className={onSelectArtist ? artistClassName : ''}
            title={onSelectArtist ? `Ver perfil de ${artist}` : undefined}
          >
            {artist}
          </span>
          {idx < artistList.length - 1 && <span className="text-neutral-500">, </span>}
        </React.Fragment>
      ))}
    </span>
  );
};

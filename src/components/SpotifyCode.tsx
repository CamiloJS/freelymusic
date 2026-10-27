import React, { useMemo } from 'react';
import { Song } from '../types';

interface SpotifyCodeProps {
  song: Song;
  className?: string;
  barColor?: string;
}

export const SpotifyCode: React.FC<SpotifyCodeProps> = ({
  song,
  className = '',
  barColor = 'var(--brand-color, #1DB954)',
}) => {
  const effectiveBarColor = barColor === '#1DB954' ? 'var(--brand-color, #1DB954)' : barColor;
  // Generate deterministic bar heights (values from 4 to 28) simulating Spotify Code soundwaves
  const bars = useMemo(() => {
    const seed = `${song.id}-${song.title}-${song.artist}`;
    const result: number[] = [];
    let hash = 0;

    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }

    const BAR_COUNT = 23;
    const POSSIBLE_HEIGHTS = [6, 10, 14, 18, 24, 28, 20, 12, 8, 16, 26, 22];

    for (let i = 0; i < BAR_COUNT; i++) {
      const pseudo = Math.abs(Math.sin(hash + i * 37) * 10000);
      const heightIdx = Math.floor(pseudo) % POSSIBLE_HEIGHTS.length;
      result.push(POSSIBLE_HEIGHTS[heightIdx]);
    }
    return result;
  }, [song.id, song.title, song.artist]);

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Spotify Circular Icon */}
      <svg
        className="w-5 h-5 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="var(--brand-color, #1DB954)"
      >
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.562.207.855zm1.225-2.724c-.227.367-.708.482-1.075.255-2.69-1.653-6.79-2.133-9.972-1.168-.413.125-.853-.109-.978-.522-.125-.413.109-.853.522-.978 3.633-1.103 8.147-.568 11.248 1.338.367.227.482.708.255 1.075zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.02-.132-1.17-.626-.15-.494.132-1.02.626-1.17 3.535-1.073 9.404-.866 13.115 1.338.445.264.59.838.326 1.282-.264.444-.838.59-1.282.326z"/>
      </svg>

      {/* Vertical Wave Bars */}
      <svg
        className="h-7 flex-1 max-w-[200px]"
        viewBox="0 0 160 32"
        fill="none"
      >
        {bars.map((height, idx) => {
          const x = idx * 7;
          const y = (32 - height) / 2;
          return (
            <rect
              key={idx}
              x={x}
              y={y}
              width="3"
              height={height}
              rx="1.5"
              fill={effectiveBarColor}
            />
          );
        })}
      </svg>
    </div>
  );
};

import { useState, useEffect } from 'react';

const COLOR_CACHE = new Map<string, string>();

const SPOTIFY_PALETTES = [
  '#7c2d12', // Warm amber / burnt orange
  '#1e3a8a', // Deep indigo / blue
  '#065f46', // Emerald forest
  '#581c87', // Rich violet
  '#831843', // Deep rose
  '#701a75', // Magenta purple
  '#0f766e', // Deep teal
  '#991b1b', // Bold crimson
  '#1e293b', // Deep slate
  '#374151', // Charcoal
];

/**
 * Returns a deterministic fallback color based on a seed string (e.g. title or artist).
 */
export function getDeterministicColor(seed = 'default'): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SPOTIFY_PALETTES.length;
  return SPOTIFY_PALETTES[index];
}

/**
 * Samples an image to extract its dominant vibrant color using HTML5 Canvas.
 * Automatically falls back to deterministic palette on CORS or error.
 */
export async function extractDominantColor(imageUrl?: string, fallbackSeed = ''): Promise<string> {
  if (!imageUrl) return getDeterministicColor(fallbackSeed);
  if (COLOR_CACHE.has(imageUrl)) return COLOR_CACHE.get(imageUrl)!;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Timeout fallback after 800ms
    const timer = setTimeout(() => {
      const fallback = getDeterministicColor(fallbackSeed || imageUrl);
      COLOR_CACHE.set(imageUrl, fallback);
      resolve(fallback);
    }, 800);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);

        const data = ctx.getImageData(0, 0, 32, 32).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < data.length; i += 16) {
          const pr = data[i];
          const pg = data[i + 1];
          const pb = data[i + 2];
          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          const saturation = max === 0 ? 0 : (max - min) / max;

          // Prefer colorful pixels over pure black, pure white, or gray
          if (saturation > 0.15 && max > 30 && min < 235) {
            r += pr;
            g += pg;
            b += pb;
            count++;
          }
        }

        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);

          // Boost color saturation slightly and ensure it is not too bright for white text
          r = Math.min(200, Math.max(30, r));
          g = Math.min(200, Math.max(30, g));
          b = Math.min(200, Math.max(30, b));

          const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          COLOR_CACHE.set(imageUrl, hex);
          resolve(hex);
          return;
        }
      } catch {
        // CORS or canvas security error fallback
      }

      const fallback = getDeterministicColor(fallbackSeed || imageUrl);
      COLOR_CACHE.set(imageUrl, fallback);
      resolve(fallback);
    };

    img.onerror = () => {
      clearTimeout(timer);
      const fallback = getDeterministicColor(fallbackSeed || imageUrl);
      COLOR_CACHE.set(imageUrl, fallback);
      resolve(fallback);
    };

    img.src = imageUrl;
  });
}

/**
 * React hook that dynamically calculates the dominant color of the current song's cover art
 * and returns gradient styles for the lyrics card and full-screen lyrics background.
 */
export function useArtworkColor(imageUrl?: string, fallbackSeed = '') {
  const initial = getDeterministicColor(fallbackSeed || imageUrl || 'seed');
  const [color, setColor] = useState<string>(() => (imageUrl && COLOR_CACHE.has(imageUrl) ? COLOR_CACHE.get(imageUrl)! : initial));

  useEffect(() => {
    let isCurrent = true;
    if (!imageUrl) {
      setColor(getDeterministicColor(fallbackSeed));
      return;
    }

    if (COLOR_CACHE.has(imageUrl)) {
      setColor(COLOR_CACHE.get(imageUrl)!);
      return;
    }

    extractDominantColor(imageUrl, fallbackSeed).then((extracted) => {
      if (isCurrent) {
        setColor(extracted);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [imageUrl, fallbackSeed]);

  return {
    color,
    gradient: `linear-gradient(145deg, ${color} 0%, #121212 100%)`,
    lyricsCardGradient: `linear-gradient(135deg, ${color} 0%, rgba(18, 18, 18, 0.95) 100%)`,
  };
}

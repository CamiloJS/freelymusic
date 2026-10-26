import { LyricLine } from '../types';

/**
 * Parses raw LRC formatted text into sorted LyricLine objects with timestamps in seconds.
 * Example input line: [01:23.45] Never gonna give you up
 */
export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText || typeof lrcText !== 'string') return [];

  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip metadata tags like [ti:Title], [ar:Artist], etc.
    if (/^\[(ti|ar|al|by|offset|length|re|ve):/i.test(line)) {
      continue;
    }

    const matches = Array.from(line.matchAll(timeRegex));
    if (matches.length === 0) continue;

    // The lyric text is whatever remains after removing all timestamps
    const text = line.replace(timeRegex, '').trim();

    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const msPart = match[3] || '0';
      const milliseconds = parseFloat('0.' + msPart);
      const totalSeconds = minutes * 60 + seconds + milliseconds;

      result.push({
        time: totalSeconds,
        text,
      });
    }
  }

  // Sort chronologically
  return result.sort((a, b) => a.time - b.time);
}

/**
 * Finds the index of the currently active lyric line for a given playback time
 */
export function getActiveLyricIndex(lyrics: LyricLine[], currentTime: number): number {
  if (lyrics.length === 0) return -1;

  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time - 0.2) { // 200ms lead for smoother feel
      return i;
    }
  }

  return 0;
}

export interface DisplayLyricLine extends LyricLine {
  translation?: string;
}

export function buildDisplayLyrics(
  original: LyricLine[],
  translated: LyricLine[],
  mode: 'original' | 'translation' | 'both'
): DisplayLyricLine[] {
  if (original.length === 0) return [];

  if (mode === 'original' || translated.length === 0) {
    return original;
  }

  if (mode === 'translation') {
    return original.map((line, index) => ({
      time: line.time,
      text: translated[index]?.text || line.text,
    }));
  }

  return original.map((line, index) => ({
    time: line.time,
    text: line.text,
    translation: translated[index]?.text || undefined,
  }));
}

/**
 * Formats a listening time for the personal statistics view.
 */
export function formatListeningTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 min';

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }
  return `${Math.max(1, minutes)} min`;
}

/**
 * Formats duration in seconds into mm:ss or hh:mm:ss
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const paddedSecs = secs < 10 ? `0${secs}` : `${secs}`;

  if (hrs > 0) {
    const paddedMins = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }
  return `${mins}:${paddedSecs}`;
}

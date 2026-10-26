import { describe, it, expect } from 'vitest';
import { parseLrc, getActiveLyricIndex, formatTime } from './lyrics';

describe('lyrics utils', () => {
  it('parses standard LRC format correctly', () => {
    const lrc = `[00:00.00] Line 0
[00:12.50] Line 1
[01:05.25] Line 2`;

    const parsed = parseLrc(lrc);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual({ time: 0, text: 'Line 0' });
    expect(parsed[1].time).toBeCloseTo(12.5);
    expect(parsed[1].text).toBe('Line 1');
    expect(parsed[2].time).toBeCloseTo(65.25);
    expect(parsed[2].text).toBe('Line 2');
  });

  it('ignores metadata tags like [ti:Title] and [ar:Artist]', () => {
    const lrc = `[ti:Song Title]
[ar:Song Artist]
[al:Album Name]
[00:10.00] Actual lyrics`;

    const parsed = parseLrc(lrc);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ time: 10, text: 'Actual lyrics' });
  });

  it('handles empty or malformed input safely', () => {
    expect(parseLrc('')).toEqual([]);
    expect(parseLrc('Just plain text with no brackets')).toEqual([]);
  });

  it('identifies active lyric line based on current playback time', () => {
    const lyrics = [
      { time: 5, text: 'First line' },
      { time: 15, text: 'Second line' },
      { time: 30, text: 'Third line' },
    ];

    expect(getActiveLyricIndex(lyrics, 0)).toBe(0);
    expect(getActiveLyricIndex(lyrics, 6)).toBe(0);
    expect(getActiveLyricIndex(lyrics, 16)).toBe(1);
    expect(getActiveLyricIndex(lyrics, 35)).toBe(2);
  });

  it('formats time duration correctly', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9)).toBe('0:09');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3665)).toBe('1:01:05');
    expect(formatTime(-5)).toBe('0:00');
  });
});

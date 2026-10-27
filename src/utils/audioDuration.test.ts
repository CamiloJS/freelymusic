import { describe, it, expect, vi } from 'vitest';
import { detectAudioDuration } from './audioDuration';

describe('detectAudioDuration', () => {
  it('returns 0 for empty string or null input', async () => {
    const resEmpty = await detectAudioDuration('');
    expect(resEmpty).toBe(0);

    // @ts-expect-error testing invalid argument
    const resNull = await detectAudioDuration(null);
    expect(resNull).toBe(0);
  });
});

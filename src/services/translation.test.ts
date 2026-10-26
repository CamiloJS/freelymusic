import { describe, expect, it } from 'vitest';
import { detectSourceLanguage } from './translation';

describe('translation language detection', () => {
  it('detects Spanish lyrics', () => {
    expect(
      detectSourceLanguage(
        '[00:01.00] Hola mi amor, te quiero y no puedo dejar de pensar en ti'
      )
    ).toBe('es');
  });

  it('detects English lyrics', () => {
    expect(
      detectSourceLanguage(
        "[00:01.00] I can't stop thinking about you and the love we had"
      )
    ).toBe('en');
  });

  it('detects Japanese and Korean scripts before word heuristics', () => {
    expect(detectSourceLanguage('[00:01.00] 君のことが好きだよ')).toBe('ja');
    expect(detectSourceLanguage('[00:01.00] 너를 사랑해')).toBe('ko');
  });
});

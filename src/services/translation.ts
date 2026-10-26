import { LyricsTranslation, LyricLine } from '../types';
import { parseLrc } from '../utils/lyrics';
import { loadFirebaseService } from './firebaseLoader';

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
const MAX_CHUNK_CHARS = 420;
const LOCAL_CACHE_PREFIX = 'musica_lyrics_translation_';
const PROVIDER_NAME = 'MyMemory';

export interface TranslateLyricsOptions {
  songId: string;
  versionId: string;
  lrc: string;
  targetLang: string;
  sourceLang?: string;
  songTitle?: string;
  artist?: string;
}

export interface TranslateLyricsResult {
  lines: LyricLine[];
  provider: string;
  updatedAt: string;
  cached: boolean;
  sourceLang: string;
}

export function detectSourceLanguage(text: string): string {
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/u.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/u.test(text)) return 'ko';
  if (/[\u0400-\u04ff]/u.test(text)) return 'ru';
  if (/[\u0600-\u06ff]/u.test(text)) return 'ar';
  return 'en';
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export function getTranslationCacheId(
  songId: string,
  versionId: string,
  targetLang: string,
  sourceHash: string
): string {
  return sanitizeId(`${songId}__${versionId}__${targetLang}__${sourceHash}`);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateChunk(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(
    text
  )}&langpair=${encodeURIComponent(sourceLang)}|${encodeURIComponent(targetLang)}`;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`El traductor respondió ${response.status}`);
      }

      const payload = await response.json();
      if (payload?.quotaFinished) {
        throw new Error(
          'La cuota gratuita diaria del traductor se agotó. Inténtalo de nuevo mañana.'
        );
      }

      const status = Number(payload?.responseStatus);
      if (status >= 400) {
        throw new Error(payload?.responseDetails || `Error del traductor (${status})`);
      }

      const translated = payload?.responseData?.translatedText;
      if (typeof translated !== 'string' || !translated.trim()) {
        throw new Error('El traductor no devolvió texto.');
      }

      return decodeHtmlEntities(translated);
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await sleep(900 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('No se pudo conectar con el traductor.');
}

async function translateLines(
  lines: LyricLine[],
  sourceLang: string,
  targetLang: string
): Promise<LyricLine[]> {
  const translatedTexts: string[] = new Array(lines.length).fill('');
  let cursor = 0;

  while (cursor < lines.length) {
    const batch: Array<{ index: number; text: string }> = [];
    let characters = 0;

    while (cursor < lines.length) {
      const text = lines[cursor].text.trim();

      if (!text) {
        translatedTexts[cursor] = '';
        cursor += 1;
        continue;
      }

      // Instrumental markers do not need translation.
      if (!/[\p{L}\p{N}]/u.test(text)) {
        translatedTexts[cursor] = text;
        cursor += 1;
        continue;
      }

      if (batch.length > 0 && characters + text.length + 1 > MAX_CHUNK_CHARS) {
        break;
      }

      batch.push({ index: cursor, text });
      characters += text.length + 1;
      cursor += 1;
    }

    if (batch.length === 0) continue;

    if (batch.length === 1) {
      translatedTexts[batch[0].index] = (
        await translateChunk(batch[0].text, sourceLang, targetLang)
      ).trim();
    } else {
      const joined = batch.map((item) => item.text).join('\n');
      const translated = await translateChunk(joined, sourceLang, targetLang);
      const parts = translated.split('\n');

      if (parts.length === batch.length) {
        batch.forEach((item, index) => {
          translatedTexts[item.index] = (parts[index] || item.text).trim();
        });
      } else {
        // The provider changed the line breaks: translate line by line so the
        // timestamps stay perfectly aligned.
        for (const item of batch) {
          translatedTexts[item.index] = (
            await translateChunk(item.text, sourceLang, targetLang)
          ).trim();
          await sleep(100);
        }
      }
    }

    await sleep(120);
  }

  return lines.map((line, index) => ({
    time: line.time,
    text: translatedTexts[index] || line.text,
  }));
}

function readLocalCache(cacheId: string, sourceHash: string): LyricsTranslation | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_CACHE_PREFIX}${cacheId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LyricsTranslation;
    if (!parsed || parsed.sourceHash !== sourceHash || !Array.isArray(parsed.lines)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(translation: LyricsTranslation): void {
  try {
    localStorage.setItem(
      `${LOCAL_CACHE_PREFIX}${translation.id}`,
      JSON.stringify(translation)
    );
  } catch {
    // Cache is optional; quota errors must not break the translation.
  }
}

export async function translateLyricsWithCache(
  options: TranslateLyricsOptions
): Promise<TranslateLyricsResult> {
  const { songId, versionId, lrc, targetLang } = options;
  const sourceLang =
    options.sourceLang && options.sourceLang !== 'auto'
      ? options.sourceLang
      : detectSourceLanguage(lrc);

  const sourceHash = hashString(lrc);
  const cacheId = getTranslationCacheId(songId, versionId, targetLang, sourceHash);

  if (sourceLang === targetLang) {
    return {
      lines: parseLrc(lrc),
      provider: 'Original',
      updatedAt: new Date().toISOString(),
      cached: true,
      sourceLang,
    };
  }

  const localCached = readLocalCache(cacheId, sourceHash);
  if (localCached) {
    return {
      lines: localCached.lines,
      provider: localCached.provider,
      updatedAt: localCached.updatedAt,
      cached: true,
      sourceLang: localCached.sourceLang,
    };
  }

  try {
    const firebase = await loadFirebaseService();
    const cloudCached = await firebase.getLyricsTranslation(cacheId);
    if (cloudCached && cloudCached.sourceHash === sourceHash) {
      writeLocalCache(cloudCached);
      return {
        lines: cloudCached.lines,
        provider: cloudCached.provider,
        updatedAt: cloudCached.updatedAt,
        cached: true,
        sourceLang: cloudCached.sourceLang,
      };
    }
  } catch (error) {
    console.warn('No se pudo consultar la caché de traducciones en la nube:', error);
  }

  const originalLines = parseLrc(lrc);
  if (originalLines.length === 0) {
    throw new Error('La letra no tiene líneas sincronizadas reconocibles.');
  }

  const lines = await translateLines(originalLines, sourceLang, targetLang);
  const updatedAt = new Date().toISOString();

  const translation: LyricsTranslation = {
    id: cacheId,
    songId,
    versionId,
    lang: targetLang,
    sourceLang,
    sourceHash,
    lines,
    provider: PROVIDER_NAME,
    updatedAt,
  };

  writeLocalCache(translation);
  try {
    const firebase = await loadFirebaseService();
    await firebase.saveLyricsTranslation(translation);
  } catch (error) {
    console.warn('La traducción quedó solo en este dispositivo:', error);
  }

  return {
    lines,
    provider: PROVIDER_NAME,
    updatedAt,
    cached: false,
    sourceLang,
  };
}

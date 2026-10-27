import { LyricsTranslation, LyricLine } from '../types';
import { parseLrc } from '../utils/lyrics';
import { loadFirebaseService } from './firebaseLoader';

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
const GOOGLE_TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const MAX_CHUNK_CHARS = 1200;
const LOCAL_CACHE_PREFIX = 'musica_lyrics_translation_';
const PROVIDER_NAME = 'Google Translate';

export interface TranslateLyricsOptions {
  songId: string;
  versionId: string;
  lrc: string;
  targetLang: string;
  sourceLang?: string;
  songTitle?: string;
  artist?: string;
}

const FEMALE_ARTIST_HINTS = new Set([
  'aitana',
  'marina',
  'marina and the diamonds',
  'kenia os',
  'nicki nicole',
  'danna paola',
  'taylor swift',
  'dua lipa',
  'billie eilish',
  'olivia rodrigo',
  'rosalia',
  'shakira',
  'ariana grande',
  'lady gaga',
  'beyonce',
  'adele',
  'lana del rey',
  'selena gomez',
  'miley cyrus',
  'katy perry',
  'rihanna',
  'camila cabello',
  'sabrina carpenter',
  'chappell roan',
  'charli xcx',
  'lorde',
  'halsey',
  'sia',
  'kesha',
  'carly rae jepsen',
  'demi lovato',
  'bebe rexha',
  'zara larsson',
  'becky g',
  'karol g',
  'natti natasha',
  'anitta',
  'maria becerra',
  'tini',
  'paloma mami',
  'emilia',
  'bad gyal',
  'lola indigo',
  'evaluna',
  'mon laferte',
]);

export function isFemaleArtist(artist?: string): boolean {
  if (!artist) return false;
  const normalized = artist
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  for (const name of FEMALE_ARTIST_HINTS) {
    if (normalized.includes(name) || name.includes(normalized)) {
      return true;
    }
  }

  if (/\b(girl|girls|lady|queen|princess|miss|mrs|sister|women)\b/i.test(normalized)) {
    return true;
  }

  return false;
}

export function applyFeminineConcordance(text: string): string {
  if (!text) return text;

  let result = text;
  const replacements: Array<[RegExp, string]> = [
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+solo\b/gi, '$1 sola'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+cansado\b/gi, '$1 cansada'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+listo\b/gi, '$1 lista'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+preparado\b/gi, '$1 preparada'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+seguro\b/gi, '$1 segura'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+enamorado\b/gi, '$1 enamorada'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+obsesionado\b/gi, '$1 obsesionada'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+herido\b/gi, '$1 herida'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+roto\b/gi, '$1 rota'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+agradecido\b/gi, '$1 agradecida'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+perdido\b/gi, '$1 perdida'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+loco\b/gi, '$1 loca'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+confundido\b/gi, '$1 confundida'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+atrapado\b/gi, '$1 atrapada'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+desesperado\b/gi, '$1 desesperada'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+acostumbrado\b/gi, '$1 acostumbrada'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+emocionado\b/gi, '$1 emocionada'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+muerto\b/gi, '$1 muerta'],
    [/\b(estoy|estaba|he estado|estuve|sigo|ando)\s+vivo\b/gi, '$1 viva'],

    [/\b(me siento|me sentía|me he sentido)\s+solo\b/gi, '$1 sola'],
    [/\b(me siento|me sentía|me he sentido)\s+cansado\b/gi, '$1 cansada'],
    [/\b(me siento|me sentía|me he sentido)\s+seguro\b/gi, '$1 segura'],
    [/\b(me siento|me sentía|me he sentido)\s+perdido\b/gi, '$1 perdida'],
    [/\b(me siento|me sentía|me he sentido)\s+loco\b/gi, '$1 loca'],
    [/\b(me siento|me sentía|me he sentido)\s+vivo\b/gi, '$1 viva'],
    [/\b(me siento|me sentía|me he sentido)\s+muerto\b/gi, '$1 muerta'],

    [/\b(quedarme|dejarme|encontrarme|verme)\s+solo\b/gi, '$1 sola'],

    [/\b(fui|era|seré|soy|he sido)\s+el único\b/gi, '$1 la única'],
    [/\b(fui|era|seré|soy|he sido)\s+el primero\b/gi, '$1 la primera'],
    [/\b(fui|era|seré|soy|he sido)\s+un chico malo\b/gi, '$1 una chica mala'],
    [/\b(fui|era|seré|soy|he sido)\s+un buen chico\b/gi, '$1 una buena chica'],
    [/\b(de|por|para|al)\s+estar solo\b/gi, '$1 estar sola'],
    [/\b(de|por|para|al)\s+sentirme solo\b/gi, '$1 sentirme sola'],
    [/\b(de|por|para|al)\s+quedarme solo\b/gi, '$1 quedarme sola'],
    [/\b(de|por|para|al)\s+vivir solo\b/gi, '$1 vivir sola'],
    [/\b(soy|era|fui)\s+un tonto\b/gi, '$1 una tonta'],
  ];

  for (const [pattern, repl] of replacements) {
    result = result.replace(pattern, repl);
  }

  return result;
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

  const lower = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const countWords = (words: string[]) =>
    words.reduce(
      (total, word) =>
        total + (lower.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length,
      0
    );

  const spanishScore = countWords([
    'el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'por',
    'con', 'para', 'no', 'te', 'mi', 'tu', 'como', 'pero', 'mas', 'sin',
    'cuando', 'me', 'si', 'lo', 'del', 'al', 'corazon', 'amor', 'ya',
  ]);
  const portugueseScore = countWords([
    'voce', 'nao', 'uma', 'com', 'para', 'que', 'meu', 'minha', 'coracao',
    'amor', 'voce', 'pra', 'sei', 'quando', 'mas', 'sem', 'por',
  ]);
  const englishScore = countWords([
    'the', 'you', 'and', 'to', 'of', 'in', 'it', 'is', 'that', 'my', 'me',
    'we', 'on', 'for', 'with', 'i', 'a', 'love', 'dont', 'cant', 'never',
    'just', 'be', 'your', 'all', 'so',
  ]);

  if (portugueseScore > spanishScore && portugueseScore > englishScore) return 'pt';
  if (spanishScore > englishScore + 1) return 'es';
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

async function translateChunkWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
  const url = `${GOOGLE_TRANSLATE_ENDPOINT}?client=gtx&sl=${encodeURIComponent(
    sl
  )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Translate respondió ${response.status}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload) && Array.isArray(payload[0])) {
    const combined = payload[0]
      .map((item: unknown) =>
        Array.isArray(item) && typeof item[0] === 'string' ? item[0] : ''
      )
      .join('');
    if (combined.trim()) {
      return combined;
    }
  }

  throw new Error('Google Translate devolvió respuesta vacía');
}

async function translateChunk(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  // 1. Try Google Translate first (best quality, preserves newlines, no restrictive quota)
  try {
    const googleResult = await translateChunkWithGoogle(text, sourceLang, targetLang);
    return decodeHtmlEntities(googleResult);
  } catch (googleError) {
    console.warn('Fallo Google Translate, reintentando con MyMemory:', googleError);
  }

  // 2. Fallback to MyMemory
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

  let lines = await translateLines(originalLines, sourceLang, targetLang);
  if (targetLang === 'es' && isFemaleArtist(options.artist)) {
    lines = lines.map((l) => ({
      ...l,
      text: applyFeminineConcordance(l.text),
    }));
  }
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

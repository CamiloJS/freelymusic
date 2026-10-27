import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const config = {
  apiKey: 'AIzaSyB-BDGpMhiNjSfGiGiGHHd6jbu5nQvoOfs',
  authDomain: 'ginadocente-unipamplona.firebaseapp.com',
  projectId: 'ginadocente-unipamplona',
  storageBucket: 'ginadocente-unipamplona.firebasestorage.app',
  messagingSenderId: '628380121872',
  appId: '1:628380121872:web:4766b1e2964b023f838395',
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

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
  'anitta',
]);

function isFemaleArtist(artist) {
  if (!artist) return false;
  const normalized = artist.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  for (const name of FEMALE_ARTIST_HINTS) {
    if (normalized.includes(name) || name.includes(normalized)) return true;
  }
  return false;
}

function applyFeminineConcordance(text) {
  if (!text) return text;
  let result = text;
  const replacements = [
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
    [/\b(quedarme|dejarme|encontrarme|verme)\s+solo\b/gi, '$1 sola'],
    [/\b(de|por|para|al)\s+estar solo\b/gi, '$1 estar sola'],
    [/\b(de|por|para|al)\s+sentirme solo\b/gi, '$1 sentirme sola'],
    [/\b(de|por|para|al)\s+quedarme solo\b/gi, '$1 quedarme sola'],
    [/\b(de|por|para|al)\s+vivir solo\b/gi, '$1 vivir sola'],
    [/\b(fui|era|seré|soy|he sido)\s+el único\b/gi, '$1 la única'],
    [/\b(fui|era|seré|soy|he sido)\s+el primero\b/gi, '$1 la primera'],
    [/\b(fui|era|seré|soy|he sido)\s+un chico malo\b/gi, '$1 una chica mala'],
    [/\b(fui|era|seré|soy|he sido)\s+un buen chico\b/gi, '$1 una buena chica'],
  ];
  for (const [pattern, repl] of replacements) {
    result = result.replace(pattern, repl);
  }
  return result;
}

function parseLrc(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^\[(ti|ar|al|by|offset|length|re|ve):/i.test(line)) continue;
    const matches = Array.from(line.matchAll(timeRegex));
    if (matches.length === 0) continue;
    const text = line.replace(timeRegex, '').trim();
    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const msPart = match[3] || '0';
      const totalSeconds = minutes * 60 + seconds + parseFloat('0.' + msPart);
      result.push({ time: totalSeconds, text });
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function sanitizeId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

async function translateTextWithGoogle(text, targetLang = 'es') {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google API error ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0].map(item => item && item[0] ? item[0] : '').join('');
  }
  return text;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('Autenticando en Firebase...');
  await signInAnonymously(auth);

  const colRef = collection(db, 'artifacts', 'freelymusic', 'public', 'data', 'catalog');
  const snap = await getDocs(colRef);
  const songs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const nonSpanishSongs = songs.filter(s => {
    if (!s.lyricsLrc) return false;
    const art = (s.artist || '').toLowerCase();
    // MARINA, The Weeknd, Absolutely, Justice, etc.
    return art.includes('marina') || art.includes('weeknd') || art.includes('justice') || art.includes('moroder') || art.includes('future') || art.includes('travis');
  });

  console.log(`Canciones en inglés para traducir y cachear: ${nonSpanishSongs.length}`);

  let completed = 0;
  for (const song of nonSpanishSongs) {
    try {
      const parsedLines = parseLrc(song.lyricsLrc);
      if (parsedLines.length === 0) continue;

      const sourceHash = hashString(song.lyricsLrc);
      const cacheId = sanitizeId(`${song.id}__original__es__${sourceHash}`);

      // Translate in chunks of ~20 lines so Google Translate maintains line count perfectly
      const translatedLyricLines = [];
      const isFemale = isFemaleArtist(song.artist);

      const chunkSize = 25;
      for (let i = 0; i < parsedLines.length; i += chunkSize) {
        const slice = parsedLines.slice(i, i + chunkSize);
        const joinedText = slice.map(l => l.text || '...').join('\n');
        
        let translatedText = '';
        try {
          translatedText = await translateTextWithGoogle(joinedText, 'es');
        } catch (e) {
          console.warn(`Error en lote para ${song.title}, reintentando línea por línea`);
        }

        const splitted = translatedText ? translatedText.split('\n') : [];
        if (splitted.length === slice.length) {
          slice.forEach((line, idx) => {
            let t = (splitted[idx] || line.text).trim();
            if (isFemale) t = applyFeminineConcordance(t);
            translatedLyricLines.push({ time: line.time, text: t });
          });
        } else {
          // Line by line fallback
          for (const line of slice) {
            if (!line.text.trim()) {
              translatedLyricLines.push({ time: line.time, text: '' });
              continue;
            }
            try {
              let t = await translateTextWithGoogle(line.text, 'es');
              if (isFemale) t = applyFeminineConcordance(t.trim());
              translatedLyricLines.push({ time: line.time, text: t.trim() });
            } catch {
              translatedLyricLines.push({ time: line.time, text: line.text });
            }
            await sleep(50);
          }
        }
        await sleep(100);
      }

      // Save to Firestore
      const translationDoc = {
        id: cacheId,
        songId: song.id,
        versionId: 'original',
        lang: 'es',
        sourceLang: 'en',
        sourceHash: sourceHash,
        lines: translatedLyricLines,
        provider: 'Google Translate (Curada con concordancia femenina)',
        updatedAt: new Date().toISOString(),
      };

      const docRef = doc(db, 'artifacts', 'freelymusic', 'public', 'data', 'lyricsTranslations', cacheId);
      await setDoc(docRef, translationDoc);
      completed++;
      console.log(`[${completed}/${nonSpanishSongs.length}] Traducida y guardada en Firestore: ${song.title} (${song.artist})`);
    } catch (err) {
      console.error(`Error traduciendo ${song.title}:`, err.message);
    }
  }

  console.log(`\n¡Listo! Se guardaron ${completed} traducciones sincronizadas de alta calidad en Firestore.`);
  process.exit(0);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

# Funcionalidades nuevas de FreelyMusic

Este documento describe lo que se implementó, cómo usarlo y los límites reales de
cada integración. Todo está desplegado en https://freelymusic.vercel.app.

## 1. Traducción de letras sincronizadas

- Motor: **MyMemory** (traducción automática gratuita, sin clave).
- Conserva los tiempos del LRC original: solo traduce el texto de cada línea.
- Selector de idioma original (Auto, EN, ES, JA, KO, FR, PT, IT, DE) y de destino
  (ES, EN, FR, PT, IT, JA, KO, DE).
- Modos de visualización: **Original**, **Traducción** y **Ambas**.
- Caché en dos niveles:
  - `localStorage` para respuesta instantánea.
  - Colección Firestore `translations` para reutilizarla en otros dispositivos.
- La clave de caché incluye canción, versión, idioma y un hash del LRC, así que si
  cambian las letras se genera una traducción nueva.
- Límite: MyMemory tiene cuota gratuita diaria. Si se agota, la interfaz muestra el
  error y mantiene la letra original. No se inventan traducciones.
- No se añadieron pronunciación fonética ni explicaciones de letras.

## 2. Videoclips

- Cada canción o versión puede tener `videoUrl`.
- El reproductor usa `<video>` nativo (HTML5), sin iframe de YouTube ni Spotify.
- Se abre desde la barra inferior, la pantalla completa o el panel derecho.
- Al abrir el video se pausa el audio; al cerrarlo se reanuda en el segundo que
  corresponda del video.
- `preload="metadata"`, `playsInline` y sin autoplay hasta que el usuario abre el
  videoclip.
- **Solo funciona con archivos directos** `.mp4` o `.webm` alojados en una fuente
  que permita streaming. Los enlaces de YouTube/Spotify no son archivos directos y
  no se pueden reproducir así; la interfaz lo indica.

## 3. Modo karaoke

- Cada canción/versión puede tener:
  - `instrumentalUrl`: pista instrumental.
  - `instrumentalLyricsLrc`: LRC propio del instrumental (opcional).
  - `instrumentalOffset`: desfase en segundos entre la versión original y la
    instrumental.
- El botón **Karaoke** cambia el audio a la pista instrumental y mantiene las
  letras sincronizadas. Si no hay un LRC propio del instrumental, los tiempos se
  desplazan automáticamente con `instrumentalOffset`.
- Al desactivarlo vuelve a la versión original y al punto correspondiente.

## 4. Versiones y covers dentro de la misma canción

- Modelo `SongVersion` dentro de `Song.versions`. Las versiones **no** se duplican
  en la biblioteca ni en las playlists.
- Cada versión puede tener audio, duración, letra LRC, videoclip, instrumental,
  LRC del instrumental, idioma y tipo (cover, instrumental, remix, live, otra).
- Selector de versión en la barra inferior, pantalla completa y panel derecho.
- La canción principal (`Song`) sigue siendo la versión original y conserva su ID
  para favoritos, playlists y estadísticas.
- Editor disponible en **Añadir Música** y en **Admin → Catálogo → editar canción**.

## 5. Estadísticas personales

- Se guardan por usuario en `usersData/{userId}`:
  - `playCounts`: reproducciones por canción.
  - `totalListenSeconds`: tiempo total escuchado.
  - `songListenSeconds`: tiempo por canción.
  - `artistListenSeconds`: tiempo por artista principal.
  - `playHistory`: últimas 200 reproducciones.
- El tiempo se acumula en bloques de 10 segundos mientras hay reproducción activa y
  también desde el reproductor de video.
- Vista **Mi Perfil**: totales, top canciones, top artistas, playlists e historial
  reciente.
- El tiempo empieza a acumularse desde esta versión; no se inventa tiempo anterior.
- Los datos se sincronizan entre dispositivos con la marca `updatedAt` y se
  mantienen en localStorage para uso offline.

## 6. Biblioteca, artistas seguidos y playlists fijadas

- La biblioteca personal contiene favoritos y canciones de playlists; el catálogo
  global solo aparece al buscarlo.
- **Artistas**: solo se muestran los artistas a los que el usuario sigue. El botón
  **Seguir / Siguiendo** está en el perfil del artista y se sincroniza en
  `followedArtists`.
- La foto del perfil de artista se usa en la barra lateral, en la biblioteca y en
  los rankings del perfil, además de su propia ficha.
- **Playlists fijadas**: clic derecho en escritorio o pulsación larga en móvil abre
  el menú contextual con **Fijar playlist / Desfijar playlist**. El orden se guarda
  en `pinnedPlaylistIds` y se sincroniza entre dispositivos.
- **Tus me gusta** permanece siempre fijada y en primer lugar.
- El indicador de descarga es la **flecha verde** en círculo (estilo Spotify), no
  un check. Se usa en la biblioteca, la búsqueda, el reproductor y el modo offline.

## 7. Estadísticas globales de artistas y canciones

- Fuente por defecto: **Deezer** (API pública, sin clave).
  - Artista: fans totales (`nb_fan`).
  - Canción: ranking de popularidad (`rank`, 0–1.000.000).
- Fuente opcional: **Last.fm**, si el administrador introduce una API key gratuita
  en **Ajustes → Personalización → Estadísticas globales · Last.fm**.
  - Artista: oyentes y reproducciones totales.
  - Canción: oyentes y reproducciones totales.
- **La interfaz solo muestra el número y la palabra “reproducciones”**. No muestra
  el nombre de la fuente, enlaces, períodos ni notas al pie.
- **YouTube / YouTube Music todavía no se suman**: YouTube Data API exige una API
  key y YouTube Music no publica un contador separado de reproducciones por canción.
  Sin credenciales no se inventan cifras; si más adelante se configura una clave, la
  suma se puede añadir dentro del mismo servicio.
- **No se muestran oyentes mensuales de Spotify**: ninguna de las fuentes gratuitas
  los ofrece.
- Caché de 7 días en `statsCache` (Firestore) y localStorage. Al cambiar de Last.fm
  a Deezer (o viceversa) se usa una clave de caché distinta.
- Las fichas muestran el total acumulado (o la popularidad pública cuando no hay un
  total de reproducciones) sin atribuir la fuente en pantalla.

## 8. Importación de playlists

- **Deezer**: funciona sin cuenta; el navegador llama a `/api/import-playlist`
  (proxy) para evitar el CORS inconsistente de Deezer.
- **Spotify**: usa la API oficial con Client Credentials. Requiere configurar en
  Vercel:
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`
  - Se crean gratis en https://developer.spotify.com/dashboard.
- **Apple Music**: usa la API oficial de MusicKit. Requiere:
  - `APPLE_MUSIC_DEVELOPER_TOKEN` en Vercel, o pegar un token en el importador.
  - Apple exige una cuenta de desarrollador (plan de pago). No se simula que
    funciona si falta el token.
- **Texto / CSV**: alternativa universal. Una canción por línea:
  `Artista - Título`.
- Coincidencia:
  - Primero por ISRC exacto.
  - Después por título/artista/álbum con similitud difusa.
  - Las canciones no encontradas se muestran en una lista aparte y **no se
    sustituyen** por otras. La playlist se crea solo con las coincidencias.
- Se evita el falso positivo de cadenas cortas (por ejemplo, “MØ” normalizado a “m”
  coincidiendo con “música”); hay una prueba de regresión.

## 9. Perfiles de usuario

- Cada perfil tiene su biblioteca, favoritos, playlists y estadísticas separadas.
- El perfil **Mi Perfil** muestra identidad, rol, fecha de alta, totales, tops,
  playlists e historial.
- Los datos se sincronizan entre dispositivos mediante Firestore y se cachean
  localmente.
- El desbloqueo por PIN sigue siendo una protección local de la interfaz, no una
  autenticación de servidor.

## 10. Enriquecimiento de metadatos

- Fuentes:
  - **MusicBrainz**: álbum, año, género, ISRC, candidato y confianza.
  - **iTunes Search API**: carátula.
  - **LRCLIB**: letras LRC sincronizadas.
- Se ejecuta desde **Admin → Catálogo → Enriquecer metadatos**:
  - “Analizar catálogo” procesa todas las canciones incompletas.
  - “Analizar esta canción” procesa una sola.
  - Solo completa campos vacíos; no sobrescribe título, artista, álbum, carátula ni
    letras existentes.
  - Los candidatos con confianza insuficiente se marcan como pendientes; no se
    aplican automáticamente.
- Al añadir una canción o un álbum se puede activar “Completar metadatos y letras
  automáticamente”. Se ejecuta en segundo plano.
- Respeta el límite de MusicBrainz (1 petición/segundo) mediante una cola.
- `/api/metadata` actúa como proxy con User-Agent correcto y caché en memoria para
  evitar CORS y reducir llamadas.
- Si una canción no se puede verificar, queda pendiente; no se inventan datos.

## 11. Endpoints desplegados

- `POST /api/import-playlist`
  - Body: `{ provider: "spotify" | "deezer" | "apple-music", url, appleMusicToken? }`.
- `GET /api/metadata`
  - `?source=musicbrainz&title=...&artist=...`
  - `?source=lyrics&title=...&artist=...&album=...&duration=...`
  - `?source=deezer-artist&name=...`
  - `?source=deezer-track&title=...&artist=...`

## 12. Variables de entorno opcionales

En Vercel → Project → Settings → Environment Variables:

| Variable | Uso | Obligatoria |
| --- | --- | --- |
| `SPOTIFY_CLIENT_ID` | Importar playlists de Spotify | Solo para Spotify |
| `SPOTIFY_CLIENT_SECRET` | Importar playlists de Spotify | Solo para Spotify |
| `APPLE_MUSIC_DEVELOPER_TOKEN` | Importar playlists de Apple Music | Solo para Apple |
| `MUSICBRAINZ_USER_AGENT` | User-Agent del proxy de metadatos | No |

La clave de Last.fm se guarda desde la interfaz de administración, no en variables
de entorno.

## 13. Límites y notas de seguridad

- MyMemory y LRCLIB son servicios gratuitos con cuotas y caídas puntuales; la app
  reintenta y muestra errores claros.
- Spotify y Apple Music no están configurados actualmente en este proyecto: si se
  intenta importar sin credenciales, el endpoint devuelve un mensaje explicando qué
  falta. No se simula una importación exitosa.
- El video solo admite archivos directos; no se descargan ni alojan videos en
  Firebase.
- No se almacenan archivos de audio/video pesados en Firestore; solo enlaces y
  metadatos.
- Las reglas actuales de Firestore permiten lectura/escritura a usuarios anónimos
  autenticados y el PIN es validado en el cliente. Para un uso público habría que
  migrar a autenticación real y reglas por usuario.
- Las cifras globales no equivalen a los oyentes mensuales de Spotify. La interfaz
  muestra únicamente el número de reproducciones para no atribuir ni comparar
  fuentes.

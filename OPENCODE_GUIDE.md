# Guía de Configuración y Entorno para Opencode 🎵

Esta guía contiene todas las credenciales, rutas, comandos y arquitectura necesarias para que el agente **Opencode** pueda trabajar, compilar, probar y desplegar la aplicación **FreelyMusic** en este computador exactamente igual que el agente principal.

---

## 1. Repositorio y Directorio Local

* **Ruta del Proyecto en este computador**:
  ```powershell
  C:\Users\Camilo\.gemini\antigravity\scratch\sonora
  ```
* **Repositorio Remoto GitHub**:
  ```text
  https://github.com/CamiloJS/freelymusic.git
  ```
* **Rama Principal**: `main`
* **Flujo de Git**:
  ```powershell
  cd "C:\Users\Camilo\.gemini\antigravity\scratch\sonora"
  git status
  git add -A
  git commit -m "feat/fix: descripción del cambio"
  git push origin main
  ```

---

## 2. Despliegue en Vercel (Producción)

* **URL en Producción**: [https://freelymusic.vercel.app](https://freelymusic.vercel.app)
* **Proyecto en Vercel**: `gina-docente/freelymusic`
* **Ubicación del Token de Vercel en este equipo**:
  ```text
  C:\Users\Camilo\AppData\Local\Temp\opencode\vercel_token.txt
  ```
* **Comando para desplegar a Producción con Vercel CLI**:
  ```powershell
  cd "C:\Users\Camilo\.gemini\antigravity\scratch\sonora"
  npx --yes vercel deploy --prod --yes --token (Get-Content C:\Users\Camilo\AppData\Local\Temp\opencode\vercel_token.txt)
  ```

---

## 3. Firebase (Base de Datos en Tiempo Real y Autenticación)

* **ID del Proyecto**: `ginadocente-unipamplona`
* **Credenciales de Configuración Web**:
  ```typescript
  export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB-BDGpMhiNjSfGiGiGHHd6jbu5nQvoOfs",
    authDomain: "ginadocente-unipamplona.firebaseapp.com",
    projectId: "ginadocente-unipamplona",
    storageBucket: "ginadocente-unipamplona.firebasestorage.app",
    messagingSenderId: "628380121872",
    appId: "1:628380121872:web:4766b1e2964b023f838395",
  };
  ```
* **Ruta Base de Documentos en Firestore**:
  Debido a las reglas de seguridad (`match /artifacts/{appId} { match /public/data/{document=**} { allow read, write: if isAuth(); } }`), todos los documentos se leen y escriben bajo la siguiente ruta:
  ```typescript
  const BASE_PATH = ['artifacts', 'freelymusic', 'public', 'data'];
  ```
  * `catalog`: Canciones globales subidas (`Song`).
  * `profiles`: Perfiles de usuario registrados (`UserProfile`).
  * `usersData`: Datos privados de cada usuario (`favoriteSongIds`, `playlists`, `playCounts`, `playHistory`).
  * `artists`: Perfiles y biografías de artistas (`ArtistProfile`).
  * `appSettings/global`: Nombre global de la app e iconos subidos por el administrador.
* **Autenticación requerida para Firestore**:
  Siempre utilizar la función `ensureAuth()` de `src/services/firebase.ts`, la cual realiza `signInAnonymously(auth)` antes de ejecutar cualquier lectura o escritura en Firestore para evitar errores `PERMISSION_DENIED`.

---

## 4. Credenciales de Administrador en la App

* **Usuario Administrador**: `camilo`
* **PIN / Contraseña**: `2410`
* **ID de Perfil**: `camilo-admin`
* **Rol**: `admin`

---

## 5. Estructura y Contextos Principales

* `src/context/AuthContext.tsx`: Control de inicio de sesión con usuario y contraseña/PIN, perfiles locales y sincronización con Firestore.
* `src/context/MusicContext.tsx`: Catálogo de canciones, playlists, perfiles de artistas (`artistProfiles`), contador de reproducciones personales por usuario (`playCounts`), historial para Top/Wrapped (`playHistory`), y descarga offline.
* `src/context/AudioContext.tsx`: Elemento HTML5 `<audio>`, cola de reproducción, letras sincronizadas (.lrc), controles de volumen, aleatorio y repetición.
* `src/context/CustomizationContext.tsx`: Tema claro/oscuro, 7 colores de acento, nombre de app personalizable y galería global de iconos.
* `src/utils/albums.ts`: Algoritmo `getAlbumsFromCatalog` que unifica las pistas de un mismo álbum sin importar colaboradores y extrae el artista dominante.
* `src/components/ArtistLinks.tsx`: Componente que divide las colaboraciones (`"Aitana, Kenia Os"`) permitiendo hacer clic en cada artista por separado para abrir su perfil.

---

## 6. Comandos de Pruebas y Compilación

* **Instalar dependencias**:
  ```powershell
  npm install
  ```
* **Ejecutar Pruebas Unitarias (Vitest)**:
  ```powershell
  npx vitest run
  ```
* **Compilar Proyecto para Producción (TypeScript + Vite)**:
  ```powershell
  npm run build
  ```

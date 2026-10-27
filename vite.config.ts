import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

/**
 * Injects the complete list of built assets (JS chunks, CSS stylesheets, media)
 * into dist/sw.js so the Service Worker precaches 100% of the production app
 * shell on install, guaranteeing offline functionality in airplane mode.
 */
function pwaAssetInjector(): Plugin {
  return {
    name: 'pwa-asset-injector',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(import.meta.dirname || process.cwd(), 'dist');
      const assetsDir = path.join(distDir, 'assets');
      const swPath = path.join(distDir, 'sw.js');

      if (!fs.existsSync(swPath) || !fs.existsSync(assetsDir)) return;

      const assetFiles = fs
        .readdirSync(assetsDir)
        .filter((file) => !file.endsWith('.map'))
        .map((file) => `/assets/${file}`);

      let swContent = fs.readFileSync(swPath, 'utf-8');

      const jsonList = JSON.stringify(assetFiles, null, 2);
      swContent = swContent.replace(
        /\/\* VITE_PRECACHE_ASSETS_START \*\/[\s\S]*?\/\* VITE_PRECACHE_ASSETS_END \*\//,
        `/* VITE_PRECACHE_ASSETS_START */\nconst VITE_BUILT_ASSETS = ${jsonList};\n/* VITE_PRECACHE_ASSETS_END */`
      );

      fs.writeFileSync(swPath, swContent, 'utf-8');
      console.log(`[PWA] Inyectados ${assetFiles.length} assets de producción en dist/sw.js para caché offline inmediata`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pwaAssetInjector(),
  ],
});

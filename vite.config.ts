import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // Standard AI Studio resolution
  const resolveKey = (...keys: (string | undefined)[]) => {
    for (const k of keys) {
      if (k && k !== "MY_GEMINI_API_KEY") return k;
    }
    return '';
  };
  const finalKey = resolveKey(process.env.GEMINI_API_KEY, env.GEMINI_API_KEY, env.VITE_GEMINI_API_KEY);

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(finalKey || ''),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(finalKey || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

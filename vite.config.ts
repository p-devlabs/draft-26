import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Release name pro Sentry. Em build do Cloudflare Pages vira o SHA curto
// (CF expõe CF_PAGES_COMMIT_SHA no env de build); local vira 'dev'.
const APP_RELEASE = process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ?? 'dev'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_APP_RELEASE': JSON.stringify(APP_RELEASE),
  },
  build: {
    rollupOptions: {
      output: {
        // Sentry é lazy-loaded via initAnalytics(); chunk separado evita
        // inflar o bundle inicial (~100 KB gzip) quando o DSN não está setado.
        manualChunks: {
          sentry: ['@sentry/react'],
        },
      },
    },
  },
})

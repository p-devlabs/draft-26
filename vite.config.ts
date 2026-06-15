import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Release name pro Sentry. Em build do Cloudflare Pages vira o SHA curto
// (CF expõe CF_PAGES_COMMIT_SHA no env de build); local vira 'dev'.
const APP_RELEASE = process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ?? 'dev'

// Upload de sourcemap só roda quando SENTRY_AUTH_TOKEN está presente
// (build-time, never exposed to client). Sem token = no-op gracioso: build
// local e CI passam normalmente, .map nem chega a ser gerado.
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN
const SOURCEMAP_UPLOAD = Boolean(SENTRY_AUTH_TOKEN)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    SOURCEMAP_UPLOAD
      ? sentryVitePlugin({
          org: 'p-dev-labs',
          project: 'javascript-react',
          authToken: SENTRY_AUTH_TOKEN,
          release: { name: APP_RELEASE },
          // Apaga os .map do dist depois do upload pra não vazar pro client.
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        })
      : null,
  ],
  define: {
    'import.meta.env.VITE_APP_RELEASE': JSON.stringify(APP_RELEASE),
  },
  build: {
    // Sourcemaps só são gerados quando o plugin vai consumir + apagar.
    // Caso contrário, ficariam no dist e seriam servidos publicamente.
    sourcemap: SOURCEMAP_UPLOAD,
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

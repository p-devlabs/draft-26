import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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

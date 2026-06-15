/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // Injetado em vite.config.ts via define() — SHA curto em CF Pages, 'dev' local.
  readonly VITE_APP_RELEASE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

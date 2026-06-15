import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes — copie .env.example para .env.local e preencha.',
  )
}

/**
 * Em dev sem .env.local o supabase-js joga "supabaseUrl is required" no
 * createClient, derrubando o app. Quando não configurado, exportamos um
 * placeholder com URL/key fake — qualquer chamada real (auth/from) deve
 * ser gateada por `isSupabaseConfigured` (track.ts e runs.ts já fazem).
 */
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'd26:supabase.auth',
      },
    })
  : createClient('https://localhost.invalid', 'public-anon-placeholder', {
      auth: { persistSession: false, autoRefreshToken: false },
    })

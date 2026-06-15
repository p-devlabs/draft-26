import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from './supabase'
import { ensureAnonUser } from './runs'
import { collectSessionContext } from './session'

const SESSION_KEY = 'd26:sessionId'
const SESSION_INIT_KEY = 'd26:sessionInitSent'

/**
 * UUID por aba (sessionStorage) — agrega eventos de uma mesma sessão de navegação
 * sem precisar de cookie. Persiste entre reloads da mesma aba, some quando fecha.
 */
function sessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

/**
 * Tracking pontual de funil/comportamento. Fire-and-forget: nunca lança,
 * nunca bloqueia a UI. Se Supabase não estiver configurado, é no-op.
 *
 * `runs.ts` cobre snapshots de estado da campanha; `track()` cobre ações
 * discretas (view_home, draft_started, draft_completed, etc).
 */
export async function track(eventType: string, props?: Record<string, unknown>): Promise<void> {
  if (!isSupabaseConfigured) return
  const userId = await ensureAnonUser()
  if (!userId) return
  try {
    const { error } = await supabase.from('events').insert({
      user_id: userId,
      event_type: eventType,
      props: props ?? {},
      session_id: sessionId(),
    })
    if (error) console.warn('[track] insert falhou:', error.message)
  } catch (err) {
    console.warn('[track] insert jogou exceção:', err)
  }
}

/**
 * Dispara session_init UMA vez por sessionStorage flag — mesmo que chamado N vezes
 * em hot-reload ou mounts duplicados (StrictMode), só envia o primeiro.
 */
export function trackSessionOnce(): void {
  if (typeof window === 'undefined') return
  if (sessionStorage.getItem(SESSION_INIT_KEY)) return
  sessionStorage.setItem(SESSION_INIT_KEY, '1')
  void track('session_init', collectSessionContext() as unknown as Record<string, unknown>)
}

/**
 * Componente invisível que dispara `view_page` a cada mudança de rota.
 * Monta UMA vez dentro do <BrowserRouter> (no main.tsx). React Router 7 cobre
 * tanto `<Link>` quanto `navigate()` programático via mudança de location.
 *
 * Complementa o CF Web Analytics: CF dá pageviews agregados por URL; aqui
 * cruzamos com user_id/session_id pra funnel ("quem viu /teams converteu pra
 * /draft?").
 */
export function PageViewTracker(): null {
  const location = useLocation()
  useEffect(() => {
    void track('view_page', {
      path: location.pathname,
      search: location.search || null,
    })
  }, [location.pathname, location.search])
  return null
}

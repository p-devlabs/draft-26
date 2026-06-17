/**
 * Contexto da sessão pro evento session_init: identidade de share, atribuição
 * (first-touch), UTM, referrer, device, viewport.
 * Coletado uma vez por aba (sessionStorage flag em track.ts).
 */

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

const PLAYER_TOKEN_KEY = 'd26:player'
const FIRST_TOUCH_KEY = 'd26:firstTouch'

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>

/**
 * Origem do jogador, capturada na 1ª visita e nunca sobrescrita. Carimba a
 * carreira inteira (todas as temporadas) num canal de aquisição.
 */
export interface FirstTouch {
  ts: string
  landing: string
  referrer: string | null
  /** Token do jogador que compartilhou o link que trouxe este usuário (?r=). */
  ref: string | null
  utm: UtmParams
}

export interface SessionContext {
  /** Primeira visita deste browser (não havia first-touch salvo). */
  isNew: boolean
  /** Token de share deste jogador — vai no ?r= dos links que ele compartilha. */
  playerToken: string
  /** Token do compartilhador que trouxe este usuário nesta sessão (?r=), se houver. */
  ref: string | null
  /** Origem persistida do jogador (capturada na 1ª visita). */
  firstTouch: FirstTouch | null
  referrer: string | null
  utm: UtmParams
  deviceType: 'mobile' | 'tablet' | 'desktop'
  viewport: { w: number; h: number }
  locale: string
  timezone: string | null
  pixelRatio: number
}

function readUtm(params: URLSearchParams): UtmParams {
  const utm: UtmParams = {}
  for (const k of UTM_KEYS) {
    const v = params.get(k)
    if (v) utm[k] = v
  }
  return utm
}

/**
 * Token curto e estável deste jogador (localStorage), usado pra atribuição
 * pessoa-a-pessoa do loop de share. Não é o auth uid — é um id opaco próprio,
 * pra não expor o uid em URLs públicas.
 */
export function getPlayerToken(): string {
  if (typeof window === 'undefined') return ''
  let t = localStorage.getItem(PLAYER_TOKEN_KEY)
  if (!t) {
    t = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    localStorage.setItem(PLAYER_TOKEN_KEY, t)
  }
  return t
}

function readFirstTouch(): FirstTouch | null {
  try {
    const raw = localStorage.getItem(FIRST_TOUCH_KEY)
    return raw ? (JSON.parse(raw) as FirstTouch) : null
  } catch {
    return null
  }
}

export function collectSessionContext(): SessionContext {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const utm = readUtm(params)
  const ref = params.get('r')
  const referrer = (typeof document !== 'undefined' && document.referrer) || null

  // First-touch: grava a origem na 1ª visita e nunca sobrescreve. Define isNew.
  let firstTouch = readFirstTouch()
  const isNew = firstTouch === null
  if (isNew) {
    firstTouch = {
      ts: new Date().toISOString(),
      landing: window.location.pathname,
      referrer,
      ref: ref ?? null,
      utm,
    }
    try {
      localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch))
    } catch {
      // storage cheio/bloqueado — segue sem persistir (isNew fica true em sessões futuras)
    }
  }

  return {
    isNew,
    playerToken: getPlayerToken(),
    ref: ref ?? null,
    firstTouch,
    referrer,
    utm,
    deviceType: classifyDevice(),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    locale: navigator.language ?? 'unknown',
    timezone: safeTimezone(),
    pixelRatio: window.devicePixelRatio ?? 1,
  }
}

function classifyDevice(): SessionContext['deviceType'] {
  const w = window.innerWidth
  // Heurística por largura — UA sniffing é frágil; pageviews mobile vs desktop
  // são o sinal que queremos pro produto.
  if (w < 640) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

function safeTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    return null
  }
}

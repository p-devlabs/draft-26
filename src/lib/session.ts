/**
 * Contexto da sessão pro evento session_init: UTM, referrer, device, viewport.
 * Coletado uma vez por aba (sessionStorage flag em track.ts).
 */

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

export interface SessionContext {
  referrer: string | null
  utm: Partial<Record<(typeof UTM_KEYS)[number], string>>
  deviceType: 'mobile' | 'tablet' | 'desktop'
  viewport: { w: number; h: number }
  locale: string
  timezone: string | null
  pixelRatio: number
}

export function collectSessionContext(): SessionContext {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const utm: SessionContext['utm'] = {}
  for (const k of UTM_KEYS) {
    const v = params.get(k)
    if (v) utm[k] = v
  }

  return {
    referrer: document.referrer || null,
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

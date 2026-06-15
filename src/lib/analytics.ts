const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const CF_BEACON_TOKEN = import.meta.env.VITE_CF_BEACON_TOKEN as string | undefined
const APP_RELEASE = import.meta.env.VITE_APP_RELEASE

/**
 * Inicializa Sentry (erros) e injeta o beacon do Cloudflare Web Analytics
 * (pageviews + Core Web Vitals). Cada um é opt-in via env var — se a chave
 * não estiver presente, simplesmente não roda.
 *
 * Sentry é dynamic-import pra não inflar o initial bundle (~100 KB gzip).
 * Trade-off: erros nos primeiros milissegundos antes do chunk carregar podem
 * passar despercebidos. Pra um SPA single-player, aceitável.
 *
 * Chamar UMA vez, antes do createRoot.
 */
export function initAnalytics(): void {
  if (SENTRY_DSN) {
    void import('@sentry/react')
      .then((Sentry) => {
        Sentry.init({
          dsn: SENTRY_DSN,
          environment: import.meta.env.MODE,
          release: APP_RELEASE,
          // Sem tracing/replay por ora — só erros, pra manter o chunk pequeno.
          tracesSampleRate: 0,
        })
      })
      .catch((err) => {
        console.warn('[analytics] sentry lazy-load falhou:', err)
      })
  }

  if (CF_BEACON_TOKEN && typeof document !== 'undefined') {
    const s = document.createElement('script')
    s.defer = true
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js'
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_BEACON_TOKEN }))
    document.head.appendChild(s)
  }
}

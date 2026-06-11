/**
 * Feature flags. Ativadas via:
 *   1. localStorage: `localStorage.setItem('feature:dev', '1')`
 *   2. URL param: `?dev=1`
 *
 * URL persiste o flag no localStorage automaticamente.
 */

function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false
  const url = new URLSearchParams(window.location.search)
  if (url.get(key) === '1') {
    try {
      window.localStorage.setItem(`feature:${key}`, '1')
    } catch {
      /* ignore */
    }
    return true
  }
  try {
    return window.localStorage.getItem(`feature:${key}`) === '1'
  } catch {
    return false
  }
}

export const features = {
  /** Modo desenvolvedor: mostra atalhos pra preencher XI e ir direto pra Copa. */
  get dev() {
    return readFlag('dev')
  },
}

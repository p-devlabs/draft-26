import { Component, type ErrorInfo, type ReactNode } from 'react'

import { ServerErrorPage } from './ErrorPages'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Boundary global que captura throws lançados durante render/lifecycle de
 * qualquer rota e reporta pro Sentry. Sem isso, erros de render viram tela
 * branca silenciosa — não disparam window.onerror nem chegam no SDK.
 *
 * Lazy-import do @sentry/react no componentDidCatch pra preservar o chunk
 * splitting (mesma razão do initAnalytics em src/lib/analytics.ts).
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void import('@sentry/react')
      .then((Sentry) => {
        Sentry.captureException(error, {
          contexts: {
            react: { componentStack: info.componentStack ?? '' },
          },
        })
      })
      .catch(() => {
        // Chunk do Sentry não carregou (offline, adblock). React já logou o
        // erro original no console — sem fallback de reporting.
      })
  }

  render(): ReactNode {
    if (this.state.error) {
      return <ServerErrorPage error={this.state.error} />
    }
    return this.props.children
  }
}

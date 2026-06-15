import { Component, type ErrorInfo, type ReactNode } from 'react'

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
      return <ErrorFallback error={this.state.error} />
    }
    return this.props.children
  }
}

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--color-paper)',
        color: 'var(--color-ink)',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <p
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-soft)',
            margin: '0 0 12px',
          }}
        >
          erro inesperado
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 32,
            lineHeight: 1.15,
            margin: '0 0 12px',
          }}
        >
          Algo quebrou por aqui.
        </h1>
        <p style={{ color: 'var(--color-ink-soft)', margin: '0 0 24px' }}>
          Já reportamos o erro. Tenta recarregar — sua campanha em andamento fica salva no navegador.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            background: 'var(--color-ink)',
            color: 'var(--color-paper)',
            border: 'none',
            borderRadius: 8,
            padding: '10px 22px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Recarregar
        </button>
        {import.meta.env.DEV && (
          <pre
            style={{
              marginTop: 32,
              padding: 16,
              textAlign: 'left',
              fontSize: 11,
              lineHeight: 1.5,
              background: 'var(--color-sand)',
              borderRadius: 6,
              maxHeight: 260,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {error.stack ?? error.message}
          </pre>
        )}
      </div>
    </div>
  )
}

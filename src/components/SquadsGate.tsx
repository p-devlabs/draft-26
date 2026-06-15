import { useEffect, useState, type ReactNode } from 'react'

import { loadSquads } from '../data/squads'

/**
 * Gate de boot: aguarda o fetch de `public/data/squads-enriched.json`
 * resolver antes de renderizar as rotas. Sem ele, qualquer rota que importa
 * `squads`/`groupedSquads`/etc do `src/data/squads.ts` veria arrays vazios.
 *
 * Loading state: minimalista, sem flicker (tela em branco com `aria-busy`).
 * Failure state: aviso visível — sem o JSON, o app simplesmente não funciona.
 */
export function SquadsGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadSquads()
      .then(() => {
        if (!cancelled) setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setErrorMsg(msg)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'loading') {
    return (
      <div
        aria-busy="true"
        aria-label="Carregando dados das seleções"
        style={{ minHeight: '100dvh', background: '#0b0b0e' }}
      />
    )
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#0b0b0e',
          color: '#f5f5f0',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 12px' }}>
            Não consegui carregar os dados das seleções
          </h1>
          <p style={{ margin: '0 0 16px', opacity: 0.8 }}>
            Cheque sua conexão e recarregue. Se o problema persistir, o servidor pode estar fora do
            ar.
          </p>
          {errorMsg ? (
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', opacity: 0.6 }}>{errorMsg}</p>
          ) : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            Recarregar
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

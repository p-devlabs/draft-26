import { useMemo, type CSSProperties, type ReactNode } from 'react'

// Telas full-screen no padrão broadcast-stadium (DRAFT 26 — Páginas de Erro).
// `NotFoundPage` (4xx) atende o catch-all do router; `ServerErrorPage` (5xx)
// é o fallback do AppErrorBoundary — que vive ACIMA do <BrowserRouter>, então
// nenhum <Link> sobreviveria no fallback. Usamos <a href> em ambas as telas
// pra manter o componente reutilizável fora do router (custo: o navegador
// recarrega ao clicar, aceitável num estado de erro).

interface ErrorFrameProps {
  variant: 'four' | 'five'
  statusPill: ReactNode
  kicker: string
  kickerColor: string
  digitLeft: string
  digitRight: string
  diceBg: string
  diceGlow: string
  diceChar: string
  title: string
  body: string
  primary: ReactNode
  secondary: ReactNode
  footer: ReactNode
  heroBg: string
}

function ErrorFrame(props: ErrorFrameProps) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: props.heroBg,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
      data-screen-label={props.variant === 'four' ? 'erro-4xx' : 'erro-5xx'}
    >
      <PitchMotif />
      <AppBar statusPill={props.statusPill} />
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 'clamp(28px, 5vw, 52px) clamp(20px, 4vw, 40px)',
        }}
      >
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            letterSpacing: '0.18em',
            color: props.kickerColor,
            marginBottom: 24,
          }}
        >
          {props.kicker}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(6px, 1.6vw, 16px)',
            marginBottom: 30,
          }}
        >
          <span
            style={{
              fontFamily: 'Anton',
              fontSize: 'clamp(96px, 16vw, 168px)',
              lineHeight: 0.78,
              color: 'var(--color-d-ink)',
            }}
          >
            {props.digitLeft}
          </span>
          <div
            style={{
              width: 'clamp(86px, 14vw, 148px)',
              height: 'clamp(86px, 14vw, 148px)',
              borderRadius: 'clamp(18px, 2.6vw, 28px)',
              background: props.diceBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Anton',
              fontSize: 'clamp(60px, 10vw, 104px)',
              color: 'var(--color-d-bg)',
              boxShadow: `0 18px 50px -16px ${props.diceGlow}`,
              animation: 'd26-float 4.5s ease-in-out infinite',
            }}
          >
            {props.diceChar}
          </div>
          <span
            style={{
              fontFamily: 'Anton',
              fontSize: 'clamp(96px, 16vw, 168px)',
              lineHeight: 0.78,
              color: 'var(--color-d-ink)',
            }}
          >
            {props.digitRight}
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'Archivo',
            fontWeight: 800,
            fontSize: 'clamp(22px, 3vw, 30px)',
            letterSpacing: '-0.01em',
            margin: '0 0 12px',
            color: 'var(--color-d-ink)',
          }}
        >
          {props.title}
        </h1>
        <p
          style={{
            color: 'var(--color-d-mut)',
            fontSize: 15,
            lineHeight: 1.6,
            maxWidth: 460,
            margin: '0 0 30px',
          }}
        >
          {props.body}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11, justifyContent: 'center' }}>
          {props.primary}
          {props.secondary}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          borderTop: '1px solid var(--color-d-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 14,
          background: '#070806',
          flexWrap: 'wrap',
        }}
      >
        {props.footer}
      </div>
    </div>
  )
}

function PitchMotif() {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 1,
          background: 'var(--color-d-line)',
          opacity: 0.5,
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 'min(46vmin, 360px)',
          height: 'min(46vmin, 360px)',
          border: '1px solid var(--color-d-line)',
          borderRadius: '50%',
          opacity: 0.4,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />
    </>
  )
}

function AppBar({ statusPill }: { statusPill: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '13px clamp(16px, 3vw, 24px)',
        borderBottom: '1px solid var(--color-d-line)',
      }}
    >
      <a
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          textDecoration: 'none',
          color: 'var(--color-d-ink)',
        }}
        aria-label="Voltar pro início"
      >
        <DiceMark />
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontFamily: 'Anton', fontSize: 21, letterSpacing: '0.02em' }}>DRAFT</span>
          <span
            style={{
              fontFamily: 'Space Mono',
              fontSize: 11,
              color: 'var(--color-d-lime)',
              fontWeight: 700,
            }}
          >
            26
          </span>
        </span>
      </a>
      {statusPill}
    </div>
  )
}

function DiceMark() {
  const dot: CSSProperties = {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: 'var(--color-d-bg)',
  }
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: 9,
        background: 'var(--color-d-lime)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 3,
        padding: 7,
      }}
      aria-hidden
    >
      <i style={dot} />
      <i />
      <i style={{ ...dot, justifySelf: 'end' }} />
      <i />
      <i style={{ ...dot, justifySelf: 'center' }} />
      <i />
      <i style={dot} />
      <i />
      <i style={{ ...dot, justifySelf: 'end' }} />
    </span>
  )
}

// ============================================================
// 4xx — página não encontrada
// ============================================================

export function NotFoundPage() {
  return (
    <div className="d26-scope" style={{ background: '#070806' }}>
      <title>404 · DRAFT 26</title>
      <ErrorFrame
        variant="four"
        heroBg="radial-gradient(120% 80% at 50% -10%, #101310, #0a0b09 60%)"
        statusPill={
          <span
            style={{
              fontFamily: 'Space Mono',
              fontSize: 11,
              color: 'var(--color-d-mut)',
              border: '1px solid var(--color-d-line)',
              borderRadius: 7,
              padding: '5px 10px',
            }}
          >
            ERRO 404
          </span>
        }
        kicker="BOLA PRA FORA · LINHA DE FUNDO"
        kickerColor="var(--color-d-lime)"
        digitLeft="4"
        digitRight="4"
        diceBg="var(--color-d-lime)"
        diceGlow="rgba(212, 255, 61, 0.6)"
        diceChar="?"
        title="Essa jogada não existe."
        body="O lance que você procurou saiu pela linha de fundo — link quebrado, página movida ou rolagem que nunca caiu. Volte pro campo e role o dado de novo."
        primary={
          <a
            href="/draft"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: 'var(--color-d-lime)',
              color: 'var(--color-d-bg)',
              borderRadius: 11,
              padding: '14px 22px',
              fontFamily: 'Anton',
              fontSize: 17,
              letterSpacing: '0.02em',
              textDecoration: 'none',
            }}
          >
            VOLTAR PRO JOGO →
          </a>
        }
        secondary={
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: 'transparent',
              color: 'var(--color-d-ink)',
              border: '1px solid var(--color-d-line)',
              borderRadius: 11,
              padding: '13px 22px',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Ir pro início
          </a>
        }
        footer={
          <>
            <span
              style={{
                fontFamily: 'Space Mono',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-d-mut)',
              }}
            >
              VOCÊ
            </span>
            <span style={{ fontFamily: 'Anton', fontSize: 26, color: 'var(--color-d-ink)' }}>
              0
            </span>
            <span style={{ fontFamily: 'Anton', fontSize: 16, color: 'var(--color-d-mut)' }}>
              —
            </span>
            <span style={{ fontFamily: 'Anton', fontSize: 26, color: 'var(--color-d-lime)' }}>
              404
            </span>
            <span
              style={{
                fontFamily: 'Space Mono',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-d-mut)',
              }}
            >
              PÁGINA
            </span>
          </>
        }
      />
    </div>
  )
}

// ============================================================
// 5xx — erro do servidor / boundary fallback
// ============================================================

interface ServerErrorPageProps {
  error?: Error
  onRetry?: () => void
}

export function ServerErrorPage({ error, onRetry }: ServerErrorPageProps) {
  // Ref curta apenas visual — ajuda usuário a citar o incidente, sem PII.
  const ref = useMemo(() => 'D26-' + Math.random().toString(36).slice(2, 7).toUpperCase(), [])
  const handleRetry = () => {
    if (onRetry) onRetry()
    else {
      try {
        window.location.reload()
      } catch {
        /* noop */
      }
    }
  }
  return (
    <div className="d26-scope" style={{ background: '#070806' }}>
      <title>500 · DRAFT 26</title>
      <ErrorFrame
        variant="five"
        heroBg="radial-gradient(120% 80% at 50% -10%, #1a0f0f, #0a0b09 60%)"
        statusPill={
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontFamily: 'Space Mono',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-d-red)',
              border: '1px solid rgba(255, 59, 59, 0.4)',
              borderRadius: 7,
              padding: '5px 10px',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--color-d-red)',
                animation: 'd26-blink 1.1s ease-in-out infinite',
              }}
            />
            JOGO SUSPENSO
          </span>
        }
        kicker="PARTIDA PARALISADA · ERRO DO SERVIDOR"
        kickerColor="var(--color-d-red)"
        digitLeft="5"
        digitRight="0"
        diceBg="var(--color-d-red)"
        diceGlow="rgba(255, 59, 59, 0.6)"
        diceChar="!"
        title="O gramado encharcou."
        body="Algo do nosso lado falhou e a partida foi paralisada. A equipe técnica já está secando o campo — tente o lance de novo em instantes."
        primary={
          <button
            type="button"
            onClick={handleRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: 'var(--color-d-lime)',
              color: 'var(--color-d-bg)',
              border: 'none',
              borderRadius: 11,
              padding: '14px 22px',
              fontFamily: 'Anton',
              fontSize: 17,
              letterSpacing: '0.02em',
              cursor: 'pointer',
            }}
          >
            ↻ TENTAR DE NOVO
          </button>
        }
        secondary={
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: 'transparent',
              color: 'var(--color-d-ink)',
              border: '1px solid var(--color-d-line)',
              borderRadius: 11,
              padding: '13px 22px',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Voltar ao início
          </a>
        }
        footer={
          <>
            <span
              style={{
                fontFamily: 'Space Mono',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-d-red)',
              }}
            >
              STATUS 500
            </span>
            <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--color-d-mut)' }}>
              ·
            </span>
            <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--color-d-mut)' }}>
              INTERNAL SERVER ERROR
            </span>
            <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--color-d-mut)' }}>
              ·
            </span>
            <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--color-d-mut)' }}>
              REF {ref}
            </span>
          </>
        }
      />
      {import.meta.env.DEV && error && (
        <details
          style={{
            maxWidth: 880,
            margin: '0 auto 40px',
            padding: '0 clamp(20px, 5vw, 40px)',
            color: 'var(--color-d-mut)',
            fontFamily: 'Space Mono',
            fontSize: 11,
          }}
        >
          <summary style={{ cursor: 'pointer', padding: '8px 0' }}>stack trace (dev only)</summary>
          <pre
            style={{
              marginTop: 8,
              padding: 16,
              background: 'var(--color-d-surface)',
              border: '1px solid var(--color-d-line)',
              borderRadius: 8,
              maxHeight: 280,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              color: 'var(--color-d-ink)',
            }}
          >
            {error.stack ?? error.message}
          </pre>
        </details>
      )}
    </div>
  )
}

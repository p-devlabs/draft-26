import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BracketView } from '../components/BracketView'
import {
  nextUserMatch,
  ROUND_LABEL,
  ROUND_ORDER,
  setupBracket,
  userPath,
  type BracketMatch,
  type KnockoutBracket,
  type KORound,
} from '../lib/bracket'
import { clearBracket, loadBracket, loadWorldCup, saveBracket } from '../lib/persistence'
import { syncRun, type FinishedRound } from '../lib/runs'
import { track } from '../lib/track'

import type { DraftState } from '../lib/draft'

export function MataMata() {
  const navigate = useNavigate()
  const [bracket, setBracket] = useState<KnockoutBracket | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [missingStage, setMissingStage] = useState(false)

  useEffect(() => {
    const persisted = loadWorldCup()
    if (!persisted) {
      setMissingStage(true)
      return
    }
    setDraft(persisted.draft)
    const existing = loadBracket()
    if (existing) {
      setBracket(existing)
      return
    }
    const created = setupBracket(persisted.worldCup)
    saveBracket(created)
    setBracket(created)
  }, [])

  useEffect(() => {
    if (!bracket) return
    const userChampion = bracket.champion === bracket.userCode
    const stillIn = nextUserMatch(bracket) != null
    let finishedRound: FinishedRound | undefined
    if (userChampion) {
      finishedRound = 'CHAMPION'
    } else if (!stillIn) {
      // User não tem próximo jogo e não é campeão → foi eliminado em algum
      // round (inclusive a Final, em que o adversário fica como bracket.champion).
      const lostMatch = [...bracket.matches]
        .reverse()
        .find(
          (m) =>
            m.winnerCode &&
            (m.homeCode === bracket.userCode || m.awayCode === bracket.userCode) &&
            m.winnerCode !== bracket.userCode,
        )
      if (lostMatch) finishedRound = lostMatch.round
    }
    void syncRun({ bracket, ...(finishedRound ? { finishedRound } : {}) })
    if (finishedRound) {
      void track('cup_ended', {
        finishedRound,
        champion: bracket.champion ?? null,
        userWon: userChampion,
      })
    }
  }, [bracket])

  if (missingStage) {
    return (
      <div className="d26-scope">
        <AppBar phaseLabel="" onReset={undefined} />
        <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 24px', textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'Space Mono',
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'var(--color-d-lime)',
              marginBottom: 8,
            }}
          >
            CHAVEAMENTO
          </div>
          <h1 style={{ fontFamily: 'Anton', fontSize: 40, margin: '0 0 12px', lineHeight: 0.95 }}>
            FALTOU A FASE DE GRUPOS
          </h1>
          <p style={{ color: 'var(--color-d-mut)', marginBottom: 24 }}>
            Você precisa terminar a fase de grupos antes de entrar no mata-mata.
          </p>
          <Link
            to="/draft"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--color-d-lime)',
              color: 'var(--color-d-bg)',
              padding: '14px 24px',
              borderRadius: 11,
              fontFamily: 'Anton',
              fontSize: 16,
              textDecoration: 'none',
            }}
          >
            IR PRO DRAFT →
          </Link>
        </div>
      </div>
    )
  }

  if (!bracket || !draft) {
    return (
      <div className="d26-scope">
        <AppBar phaseLabel="" onReset={undefined} />
        <div
          style={{
            padding: 60,
            textAlign: 'center',
            color: 'var(--color-d-mut)',
            fontFamily: 'Space Mono',
            fontSize: 12,
            letterSpacing: '0.12em',
          }}
        >
          MONTANDO CHAVE…
        </div>
      </div>
    )
  }

  const next = nextUserMatch(bracket)
  const userOut = !next && bracket.champion !== bracket.userCode
  const userChampion = bracket.champion === bracket.userCode
  const phaseLabel = computePhaseLabel(bracket, next, userOut, userChampion)

  const handleReset = () => {
    void track('reset_clicked', { from: 'bracket' })
    clearBracket()
    const persisted = loadWorldCup()!
    const created = setupBracket(persisted.worldCup)
    saveBracket(created)
    setBracket(created)
  }

  return (
    <div className="d26-scope" style={{ overflowX: 'hidden' }}>
      <AppBar phaseLabel={phaseLabel} onReset={handleReset} partidaEnabled={!!next} />
      <Masthead />
      <PathStrip bracket={bracket} />
      <BracketView bracket={bracket} />
      <FooterNav
        next={next}
        userOut={userOut}
        userChampion={userChampion}
        onPlay={() => next && navigate(`/match?kind=knockout&id=${next.id}`)}
      />
    </div>
  )
}

function computePhaseLabel(
  bracket: KnockoutBracket,
  next: BracketMatch | null,
  userOut: boolean,
  userChampion: boolean,
): string {
  if (userChampion) return 'SEU XI · CAMPEÃO'
  if (userOut) {
    const lost = [...bracket.matches]
      .reverse()
      .find(
        (m) =>
          m.winnerCode &&
          (m.homeCode === bracket.userCode || m.awayCode === bracket.userCode) &&
          m.winnerCode !== bracket.userCode,
      )
    return `SEU XI · ELIMINADO ${lost ? `· ${ROUND_LABEL[lost.round].toUpperCase()}` : ''}`
  }
  if (next) return `SEU XI · ${ROUND_LABEL[next.round].toUpperCase()}`
  return 'CHAVEAMENTO'
}

// ============================================================
// App bar
// ============================================================

function AppBar({
  phaseLabel,
  onReset,
  partidaEnabled = true,
}: {
  phaseLabel: string
  onReset?: () => void
  /** PARTIDA disabled quando user já caiu ou venceu o torneio. */
  partidaEnabled?: boolean
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px clamp(16px, 4vw, 28px)',
        borderBottom: '1px solid var(--color-d-line)',
        background: 'linear-gradient(180deg, #101310, #0d0f0c)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <DiceMark />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontFamily: 'Anton', fontSize: 23, letterSpacing: '0.02em' }}>DRAFT</span>
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
        </div>
      </Link>
      <nav
        style={{
          display: 'flex',
          gap: 4,
          background: 'var(--color-d-bg)',
          border: '1px solid var(--color-d-line)',
          borderRadius: 11,
          padding: 5,
          overflowX: 'auto',
          maxWidth: '100%',
          order: 3,
          flex: '1 1 320px',
          justifyContent: 'center',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <NavPill disabled label="ESCALAÇÃO" />
        <NavPill disabled label="GRUPOS" />
        <NavPill active label="CHAVEAMENTO" />
        <NavPill
          to={partidaEnabled ? '/match' : undefined}
          disabled={!partidaEnabled}
          label="PARTIDA"
        />
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            color: 'var(--color-d-lime)',
            whiteSpace: 'nowrap',
          }}
        >
          {phaseLabel}
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title="Refazer chave"
            style={{
              background: 'var(--color-d-surface2)',
              border: '1px solid var(--color-d-line)',
              color: 'var(--color-d-mut)',
              borderRadius: 8,
              width: 30,
              height: 30,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ↻
          </button>
        )}
      </div>
    </div>
  )
}

function NavPill({
  to,
  label,
  active,
  disabled,
}: {
  to?: string
  label: string
  active?: boolean
  disabled?: boolean
}) {
  const base: CSSProperties = {
    fontFamily: 'Space Mono',
    fontSize: 12,
    padding: '8px 13px',
    borderRadius: 8,
    whiteSpace: 'nowrap',
  }
  if (active) {
    return (
      <span
        style={{
          ...base,
          fontWeight: 700,
          background: 'var(--color-d-lime)',
          color: 'var(--color-d-bg)',
        }}
      >
        {label}
      </span>
    )
  }
  if (disabled) {
    return (
      <span
        role="link"
        aria-disabled="true"
        title="Use o ↻ no header pra recomeçar essa etapa"
        style={{ ...base, color: 'var(--color-d-mut)', opacity: 0.55, cursor: 'not-allowed' }}
      >
        {label}
      </span>
    )
  }
  return (
    <Link to={to ?? '#'} style={{ ...base, color: 'var(--color-d-mut)' }}>
      {label}
    </Link>
  )
}

function DiceMark() {
  const dot = (justify?: 'end' | 'center'): CSSProperties => {
    const s: CSSProperties = {
      width: 4,
      height: 4,
      borderRadius: '50%',
      background: 'var(--color-d-bg)',
    }
    if (justify === 'end') s.justifySelf = 'end'
    if (justify === 'center') s.justifySelf = 'center'
    return s
  }
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 9,
        background: 'var(--color-d-lime)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 3,
        padding: 7,
      }}
    >
      <span style={dot()} />
      <span />
      <span style={dot('end')} />
      <span />
      <span style={dot('center')} />
      <span />
      <span style={dot()} />
      <span />
      <span style={dot('end')} />
    </div>
  )
}

// ============================================================
// Masthead
// ============================================================

function Masthead() {
  return (
    <div
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: 'clamp(20px, 3.5vw, 30px) clamp(16px, 4vw, 28px) 12px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 6,
            height: 54,
            borderRadius: 4,
            background: 'var(--color-d-lime)',
            flexShrink: 0,
          }}
        />
        <div>
          <div
            style={{
              fontFamily: 'Space Mono',
              fontSize: 11,
              letterSpacing: '0.16em',
              color: 'var(--color-d-lime)',
              marginBottom: 5,
            }}
          >
            COPA 2026 · MATA-MATA · 5 FASES
          </div>
          <h1
            style={{
              fontFamily: 'Anton',
              fontSize: 'clamp(34px, 7vw, 52px)',
              margin: 0,
              lineHeight: 0.9,
            }}
          >
            CHAVEAMENTO
          </h1>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 9,
          flexWrap: 'wrap',
          fontFamily: 'Space Mono',
          fontSize: 11,
        }}
      >
        <span
          style={{
            padding: '9px 13px',
            border: '1px solid var(--color-d-line)',
            borderRadius: 8,
            color: 'var(--color-d-mut)',
            whiteSpace: 'nowrap',
          }}
        >
          32 CLASSIFICADOS
        </span>
        <span
          style={{
            padding: '9px 13px',
            border: '1px solid rgba(212,255,61,0.4)',
            borderRadius: 8,
            color: 'var(--color-d-lime)',
            background: 'rgba(212,255,61,0.07)',
            whiteSpace: 'nowrap',
          }}
        >
          SEU CAMINHO EM DESTAQUE
        </span>
      </div>
    </div>
  )
}

// ============================================================
// SEU CAMINHO strip
// ============================================================

interface PathStep {
  round: KORound
  label: string
  state: 'win' | 'loss' | 'now' | 'pending'
  result: string
}

function buildPath(bracket: KnockoutBracket): PathStep[] {
  const path = userPath(bracket)
  const next = nextUserMatch(bracket)
  return ROUND_ORDER.map((round) => {
    const m = path.find((pm) => pm.round === round)
    const label = ROUND_LABEL[round].toUpperCase()
    if (m?.winnerCode) {
      const won = m.winnerCode === bracket.userCode
      const hg = (m.result?.homeGoals ?? 0) + (m.extraTime?.homeGoals ?? 0)
      const ag = (m.result?.awayGoals ?? 0) + (m.extraTime?.awayGoals ?? 0)
      const userIsHome = m.homeCode === bracket.userCode
      const u = userIsHome ? hg : ag
      const o = userIsHome ? ag : hg
      return {
        round,
        label,
        state: won ? 'win' : 'loss',
        result: `${u}–${o}`,
      }
    }
    if (next?.round === round) {
      const oppCode = next.homeCode === bracket.userCode ? next.awayCode : next.homeCode
      const opp = oppCode ? bracket.teams[oppCode] : null
      return {
        round,
        label,
        state: 'now',
        result: opp ? `vs ${opp.code.toUpperCase()}` : 'a definir',
      }
    }
    return { round, label, state: 'pending', result: '—' }
  })
}

function PathStrip({ bracket }: { bracket: KnockoutBracket }) {
  const path = buildPath(bracket)
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '2px clamp(16px, 4vw, 28px) 6px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          overflowX: 'auto',
          paddingBottom: 6,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 10,
            letterSpacing: '0.14em',
            color: 'var(--color-d-mut)',
            flexShrink: 0,
            marginRight: 4,
          }}
        >
          SEU CAMINHO
        </span>
        {path.map((step, i) => (
          <PathStepEl key={step.round} step={step} showArrow={i < path.length - 1} />
        ))}
      </div>
    </div>
  )
}

function PathStepEl({ step, showArrow }: { step: PathStep; showArrow: boolean }) {
  const style = stepStyle(step.state)
  return (
    <>
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '8px 13px',
          borderRadius: 10,
          background: style.bg,
          border: `1px solid ${style.border}`,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--color-d-bg)',
            background: style.dotBg,
          }}
        >
          {style.icon}
        </span>
        <div>
          <div
            style={{
              fontFamily: 'Space Mono',
              fontSize: 9,
              letterSpacing: '0.08em',
              color: style.labelColor,
            }}
          >
            {step.label}
          </div>
          <div
            style={{
              fontFamily: 'Anton',
              fontSize: 15,
              lineHeight: 1,
              color: style.resColor,
            }}
          >
            {step.result}
          </div>
        </div>
      </div>
      {showArrow && (
        <span style={{ flex: '0 0 auto', color: 'var(--color-d-line)', fontSize: 13 }}>→</span>
      )}
    </>
  )
}

function stepStyle(state: PathStep['state']) {
  if (state === 'win') {
    return {
      bg: 'var(--color-d-surface)',
      border: 'var(--color-d-line)',
      dotBg: 'var(--color-d-lime)',
      icon: '✓',
      labelColor: 'var(--color-d-mut)',
      resColor: 'var(--color-d-ink)',
    }
  }
  if (state === 'loss') {
    return {
      bg: 'rgba(255,59,59,0.06)',
      border: 'rgba(255,59,59,0.3)',
      dotBg: 'var(--color-d-red)',
      icon: '×',
      labelColor: 'var(--color-d-red)',
      resColor: 'var(--color-d-red)',
    }
  }
  if (state === 'now') {
    return {
      bg: 'rgba(212,255,61,0.09)',
      border: 'rgba(212,255,61,0.5)',
      dotBg: 'var(--color-d-lime)',
      icon: '›',
      labelColor: 'var(--color-d-lime)',
      resColor: 'var(--color-d-lime)',
    }
  }
  return {
    bg: 'transparent',
    border: 'var(--color-d-line)',
    dotBg: 'var(--color-d-surface2)',
    icon: '·',
    labelColor: 'var(--color-d-mut)',
    resColor: 'var(--color-d-mut)',
  }
}

// ============================================================
// Footer nav
// ============================================================

function FooterNav({
  next,
  userOut,
  userChampion,
  onPlay,
}: {
  next: BracketMatch | null
  userOut: boolean
  userChampion: boolean
  onPlay: () => void
}) {
  let cta: {
    label: string
    to?: string
    onClick?: () => void
    bg: string
    color: string
    border: string
  } = {
    label: 'IR PARA A PARTIDA →',
    onClick: onPlay,
    bg: 'var(--color-d-ink)',
    color: 'var(--color-d-bg)',
    border: 'var(--color-d-ink)',
  }
  if (userChampion) {
    cta = {
      label: '🏆 JOGAR DE NOVO →',
      to: '/draft',
      bg: 'var(--color-d-lime)',
      color: 'var(--color-d-bg)',
      border: 'var(--color-d-lime)',
    }
  } else if (userOut) {
    cta = {
      label: 'TENTAR DE NOVO →',
      to: '/draft',
      bg: 'var(--color-d-red)',
      color: '#fff',
      border: 'var(--color-d-red)',
    }
  } else if (!next) {
    cta = {
      label: 'AGUARDANDO PRÓXIMA FASE',
      bg: 'var(--color-d-surface)',
      color: 'var(--color-d-mut)',
      border: 'var(--color-d-line)',
    }
  }

  const ctaStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    background: cta.bg,
    color: cta.color,
    border: `1px solid ${cta.border}`,
    borderRadius: 11,
    padding: '14px 22px',
    fontFamily: 'Anton',
    fontSize: 15,
    letterSpacing: '0.02em',
    textDecoration: 'none',
    cursor: cta.to || cta.onClick ? 'pointer' : 'default',
  }

  return (
    <div
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: '0 clamp(16px, 4vw, 28px) 44px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
      }}
    >
      <Link
        to="/groups"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          background: 'transparent',
          color: 'var(--color-d-mut)',
          border: '1px solid var(--color-d-line)',
          borderRadius: 11,
          padding: '13px 20px',
          fontFamily: 'Space Mono',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textDecoration: 'none',
        }}
      >
        ← FASE DE GRUPOS
      </Link>
      {cta.to ? (
        <Link to={cta.to} style={ctaStyle}>
          {cta.label}
        </Link>
      ) : (
        <button
          type="button"
          onClick={cta.onClick}
          style={{ ...ctaStyle, border: ctaStyle.border }}
        >
          {cta.label}
        </button>
      )}
    </div>
  )
}

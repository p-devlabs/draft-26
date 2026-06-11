import { useEffect, useState, type CSSProperties } from 'react'
import { SLOT_LABEL } from '../lib/positions'
import { rollUntilCompatible, useSkip, type DraftState } from '../lib/draft'
import type { Player, Squad } from '../data/squads'

interface PickDrawerProps {
  open: boolean
  state: DraftState
  slotIndex: number | null
  onClose: () => void
  onPick: (player: Player, squad: Squad) => void
  onStateChange: (state: DraftState) => void
}

type Phase =
  | { kind: 'roll' }
  | { kind: 'rolling' }
  | { kind: 'result'; squad: Squad; candidates: Player[]; skipped: number }

export function PickDrawer({
  open,
  state,
  slotIndex,
  onClose,
  onPick,
  onStateChange,
}: PickDrawerProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'roll' })

  useEffect(() => {
    if (open) setPhase({ kind: 'roll' })
  }, [open, slotIndex])

  if (!open || slotIndex == null) return null

  const slot = state.slots[slotIndex]
  const slotLabel = SLOT_LABEL[slot.pos].toUpperCase()
  const canSkip = state.skipsRemaining > 0

  const handleRoll = () => {
    setPhase({ kind: 'rolling' })
    window.setTimeout(() => {
      try {
        const result = rollUntilCompatible(state, slotIndex)
        onStateChange(result.state)
        setPhase({
          kind: 'result',
          squad: result.squad,
          candidates: result.candidates,
          skipped: result.skipped.length,
        })
      } catch (err) {
        console.error(err)
        setPhase({ kind: 'roll' })
      }
    }, 1050)
  }

  const handlePick = (player: Player) => {
    if (phase.kind !== 'result') return
    onPick(player, phase.squad)
  }

  const handleSkip = () => {
    if (!canSkip || phase.kind !== 'result') return
    onStateChange(useSkip(state))
    handleRoll()
  }

  const handleClose = () => {
    if (phase.kind === 'result' && canSkip) {
      onStateChange(useSkip(state))
    }
    onClose()
  }

  const recent = state.rolledCountries.slice(-5)
  const recentStr = recent.length > 0 ? recent.join(' · ') : 'NENHUMA'

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6,7,5,0.72)',
          backdropFilter: 'blur(3px)',
          zIndex: 30,
          animation: 'd26-fade-in .2s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 31,
          display: 'flex',
          justifyContent: 'center',
          animation: 'd26-sheet-up .3s cubic-bezier(.2,.9,.3,1)',
          pointerEvents: 'none',
        }}
      >
        <div
          className="az-sheet"
          style={{
            width: '100%',
            maxWidth: 560,
            background: 'var(--color-d-surface)',
            border: '1px solid var(--color-d-line)',
            borderBottom: 'none',
            borderRadius: '22px 22px 0 0',
            padding: '22px 26px 30px',
            boxShadow: '0 -30px 60px -20px rgba(0,0,0,0.6)',
            maxHeight: '92vh',
            overflowY: 'auto',
            pointerEvents: 'auto',
          }}
        >
          <Header label={slotLabel} onClose={handleClose} />
          {phase.kind === 'roll' && (
            <RollState slotLabel={slotLabel} recentStr={recentStr} onRoll={handleRoll} />
          )}
          {phase.kind === 'rolling' && <RollingState />}
          {phase.kind === 'result' && (
            <ResultState
              squad={phase.squad}
              candidates={phase.candidates}
              skipped={phase.skipped}
              skipsRemaining={state.skipsRemaining}
              activeLabel={slotLabel}
              onPick={handlePick}
              onSkip={handleSkip}
            />
          )}
        </div>
      </div>
    </>
  )
}

function Header({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}
    >
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 11,
          letterSpacing: '0.14em',
          color: 'var(--color-d-lime)',
        }}
      >
        SORTEIO · {label}
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'var(--color-d-surface2)',
          border: '1px solid var(--color-d-line)',
          color: 'var(--color-d-mut)',
          borderRadius: 8,
          width: 30,
          height: 30,
          fontSize: 15,
          cursor: 'pointer',
          flex: '0 0 auto',
        }}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  )
}

function RollState({
  slotLabel,
  recentStr,
  onRoll,
}: {
  slotLabel: string
  recentStr: string
  onRoll: () => void
}) {
  const dot = (justify?: 'end' | 'center'): CSSProperties => {
    const s: CSSProperties = { width: 8, height: 8, borderRadius: '50%', background: 'var(--color-d-lime)' }
    if (justify === 'end') s.justifySelf = 'end'
    if (justify === 'center') s.justifySelf = 'center'
    return s
  }
  return (
    <div style={{ textAlign: 'center', padding: '18px 0 8px' }}>
      <div
        style={{
          width: 84,
          height: 84,
          margin: '0 auto 20px',
          borderRadius: 18,
          background: 'var(--color-d-surface2)',
          border: '1px solid var(--color-d-line)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          padding: 18,
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
      <div
        style={{
          fontSize: 15,
          color: 'var(--color-d-mut)',
          maxWidth: 340,
          margin: '0 auto 22px',
        }}
      >
        Role o dado pra sortear uma seleção e ver seus jogadores de{' '}
        <b style={{ color: 'var(--color-d-ink)' }}>{slotLabel}</b>.
      </div>
      <button
        type="button"
        onClick={onRoll}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: 'var(--color-d-lime)',
          color: 'var(--color-d-bg)',
          border: 'none',
          borderRadius: 13,
          padding: 18,
          fontFamily: 'Anton',
          fontSize: 22,
          letterSpacing: '0.02em',
          cursor: 'pointer',
          animation: 'd26-pulse 2.4s infinite',
        }}
      >
        <span style={{ fontSize: 22 }}>⚄</span> ROLAR O DADO
      </button>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 10,
          color: 'var(--color-d-mut)',
          marginTop: 16,
          letterSpacing: '0.06em',
        }}
      >
        EM COOLDOWN (5 SORTEIOS): <span style={{ color: 'var(--color-d-ink)' }}>{recentStr}</span>
      </div>
    </div>
  )
}

function RollingState() {
  return (
    <div style={{ textAlign: 'center', padding: '34px 0 40px' }}>
      <div
        style={{
          width: 84,
          height: 84,
          margin: '0 auto 22px',
          borderRadius: 18,
          background: 'var(--color-d-lime)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 9,
          padding: 21,
          animation: 'd26-spin 1s linear infinite',
          boxShadow: '0 0 32px -2px rgba(212,255,61,0.6)',
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-d-bg)' }}
          />
        ))}
      </div>
      <div
        style={{
          fontFamily: 'Anton',
          fontSize: 24,
          color: 'var(--color-d-lime)',
          letterSpacing: '0.04em',
        }}
      >
        SORTEANDO…
      </div>
    </div>
  )
}

function ResultState({
  squad,
  candidates,
  skipped,
  skipsRemaining,
  activeLabel,
  onPick,
  onSkip,
}: {
  squad: Squad
  candidates: Player[]
  skipped: number
  skipsRemaining: number
  activeLabel: string
  onPick: (p: Player) => void
  onSkip: () => void
}) {
  const code = squad.code.toUpperCase()
  const canSkip = skipsRemaining > 0
  const sorted = [...candidates].sort((a, b) => b.overall - a.overall)
  return (
    <div style={{ animation: 'd26-fade-in .3s ease' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'var(--color-d-surface2)',
          border: '1px solid var(--color-d-line)',
          borderRadius: 12,
          padding: '13px 16px',
          margin: '6px 0 16px',
          flexWrap: 'wrap',
        }}
      >
        <SquadBadge code={code} />
        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Space Mono',
              fontSize: 10,
              color: 'var(--color-d-lime)',
              letterSpacing: '0.12em',
            }}
          >
            SELEÇÃO SORTEADA
          </div>
          <div style={{ fontFamily: 'Anton', fontSize: 24, lineHeight: 1 }}>
            {squad.country.toUpperCase()}
          </div>
        </div>
        {canSkip ? (
          <button
            type="button"
            onClick={onSkip}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-d-lime)',
              color: 'var(--color-d-lime)',
              borderRadius: 8,
              padding: '9px 12px',
              fontFamily: 'Space Mono',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
            }}
          >
            ⤳ PULAR ({skipsRemaining})
          </button>
        ) : (
          <span
            style={{
              border: '1px solid var(--color-d-line)',
              color: 'var(--color-d-mut)',
              borderRadius: 8,
              padding: '9px 12px',
              fontFamily: 'Space Mono',
              fontSize: 11,
              fontWeight: 700,
              opacity: 0.5,
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
            }}
          >
            SEM PULOS
          </span>
        )}
      </div>
      {skipped > 0 && (
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 10,
            color: 'var(--color-d-mut)',
            marginBottom: 10,
            letterSpacing: '0.06em',
          }}
        >
          {skipped} seleção{skipped === 1 ? '' : 'ões'} pulada{skipped === 1 ? '' : 's'} (sem
          jogador compatível)
        </div>
      )}
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 11,
          color: 'var(--color-d-mut)',
          letterSpacing: '0.1em',
          marginBottom: 10,
        }}
      >
        ESCALE 1 PARA {activeLabel}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((p) => (
          <CandidateRow key={`${p.name}-${p.shirt}`} player={p} onPick={() => onPick(p)} />
        ))}
        {sorted.length === 0 && (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--color-d-mut)',
              fontFamily: 'Space Mono',
              fontSize: 12,
            }}
          >
            Nenhum jogador compatível.
          </div>
        )}
      </div>
    </div>
  )
}

function SquadBadge({ code }: { code: string }) {
  return (
    <div
      style={{
        width: 52,
        height: 36,
        borderRadius: 6,
        background: gradientFor(code),
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.14)',
        flex: '0 0 auto',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Space Mono',
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          letterSpacing: '0.04em',
        }}
      >
        {code}
      </span>
    </div>
  )
}

function gradientFor(code: string): string {
  let h = 0
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) | 0
  const h1 = Math.abs(h) % 360
  const h2 = (h1 + 95) % 360
  return `linear-gradient(135deg, hsl(${h1} 65% 42%), hsl(${h2} 70% 52%))`
}

function CandidateRow({ player, onPick }: { player: Player; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '12px 14px',
        borderRadius: 11,
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color .15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-d-lime)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-d-line)')}
    >
      <div
        style={{
          width: 30,
          fontFamily: 'Anton',
          fontSize: 19,
          color: 'var(--color-d-mut)',
          textAlign: 'center',
          flex: '0 0 auto',
        }}
      >
        {player.shirt ?? '·'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--color-d-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {player.name}
          {player.isCaptain && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 9,
                fontFamily: 'Space Mono',
                color: 'var(--color-d-lime)',
                letterSpacing: '0.1em',
              }}
            >
              CAP
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 9,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.08em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {player.primaryPosition ?? player.position} · {player.club}
        </div>
      </div>
      <div style={{ fontFamily: 'Anton', fontSize: 22, color: 'var(--color-d-lime)', flex: '0 0 auto' }}>
        {player.overall}
      </div>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: 'var(--color-d-lime)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-d-bg)',
          fontWeight: 800,
          fontSize: 15,
          flex: '0 0 auto',
        }}
      >
        →
      </div>
    </button>
  )
}

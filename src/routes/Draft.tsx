import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Field } from '../components/Field'
import { PickDrawer } from '../components/PickDrawer'
import { SetupDrawer } from '../components/SetupDrawer'
import { autoFillXI } from '../lib/autofill'
import { averageOverall, createDraft, isComplete, pickPlayer, type DraftState } from '../lib/draft'
import { features } from '../lib/features'
import { saveDraft, clearWorldCup } from '../lib/persistence'
import { track } from '../lib/track'

import type { Difficulty, Style } from '../lib/formations'

export function Draft() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [pickingSlot, setPickingSlot] = useState<number | null>(null)
  const autoFillUsedRef = useRef(false)

  useEffect(() => {
    void track('draft_started')
  }, [])

  const handleStart = (formationName: string, style: Style, difficulty: Difficulty) => {
    setDraft(createDraft(formationName, style, difficulty))
    void track('draft_setup', { formation: formationName, style, difficulty })
  }

  const handleReset = () => {
    void track('reset_clicked', { from: 'draft', hadDraft: !!draft })
    setDraft(null)
    setPickingSlot(null)
    autoFillUsedRef.current = false
  }

  const handleAutoFill = () => {
    if (!draft) return
    autoFillUsedRef.current = true
    setDraft(autoFillXI(draft))
    void track('autofill_clicked', { filledBefore: draft.slots.filter((s) => s.player).length })
  }

  const handleSimulate = () => {
    if (!draft || !isComplete(draft)) return
    saveDraft(draft)
    clearWorldCup()
    const topPicks = [...draft.slots]
      .filter((s) => s.player)
      .sort((a, b) => (b.player!.player.overall ?? 0) - (a.player!.player.overall ?? 0))
      .slice(0, 3)
      .map((s) => ({
        name: s.player!.player.name,
        country: s.player!.countryCode,
        overall: s.player!.player.overall,
      }))
    void track('draft_completed', {
      formation: draft.formationName,
      style: draft.style,
      difficulty: draft.difficulty,
      avgOverall: Math.round(averageOverall(draft)),
      rollsUsed: draft.rolledCountries.length,
      skipsUsed: draft.skipsTotal - draft.skipsRemaining,
      skipsTotal: draft.skipsTotal,
      autoFillUsed: autoFillUsedRef.current,
      topPicks,
    })
    navigate('/groups')
  }

  const slotsForRender = draft?.slots ?? []
  const filled = draft?.slots.filter((s) => s.player).length ?? 0
  const buildPhase = !!draft
  const complete = !!draft && isComplete(draft)
  const ovr = draft && filled > 0 ? Math.round(averageOverall(draft)) : null

  return (
    <div className="d26-scope" style={{ position: 'relative', overflowX: 'hidden' }}>
      <AppBar ovr={ovr} onReset={buildPhase ? handleReset : undefined} />
      {buildPhase && draft && (
        <ProgressStrip
          formation={draft.formationName}
          style={draft.style}
          skipsLeft={draft.skipsRemaining}
          filled={filled}
        />
      )}
      <div
        className="az-wrap"
        style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 28px 120px' }}
      >
        {buildPhase ? (
          <Field slots={slotsForRender} buildPhase onSlotClick={(i) => setPickingSlot(i)} />
        ) : (
          // Placeholder field rendered while setup sheet is open
          <Field slots={emptyPreviewSlots()} buildPhase={false} onSlotClick={() => {}} />
        )}
        {features.dev && buildPhase && draft && !complete && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <button
              type="button"
              onClick={handleAutoFill}
              style={{
                fontFamily: 'Space Mono',
                fontSize: 11,
                color: 'var(--color-d-lime)',
                background: 'transparent',
                border: '1px dashed var(--color-d-lime)',
                borderRadius: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                letterSpacing: '0.06em',
              }}
            >
              ⚡ dev · preencher todos
            </button>
          </div>
        )}
      </div>

      <SetupDrawer open={!buildPhase} onStart={handleStart} />

      {buildPhase && <SimBar complete={complete} filled={filled} onSimulate={handleSimulate} />}

      {buildPhase && draft && (
        <PickDrawer
          open={pickingSlot != null}
          state={draft}
          slotIndex={pickingSlot}
          onClose={() => setPickingSlot(null)}
          onPick={(player, squad) => {
            if (pickingSlot == null) return
            setDraft(pickPlayer(draft, pickingSlot, player, squad))
            setPickingSlot(null)
          }}
          onStateChange={(s) => setDraft(s)}
        />
      )}
    </div>
  )
}

// ============================================================
// App bar
// ============================================================

function AppBar({ ovr, onReset }: { ovr: number | null; onReset?: () => void }) {
  return (
    <div
      className="az-appbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        padding: '14px 28px',
        borderBottom: '1px solid var(--color-d-line)',
        background: 'linear-gradient(180deg, #101310, #0a0b09)',
      }}
    >
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 13, flex: '0 0 auto' }}>
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
      <div
        className="az-nav"
        style={{
          display: 'flex',
          gap: 4,
          background: 'var(--color-d-bg)',
          border: '1px solid var(--color-d-line)',
          borderRadius: 11,
          padding: 5,
        }}
      >
        <NavPill active label="ESCALAÇÃO" />
        <NavPill to="/groups" label="GRUPOS" />
        <NavPill to="/bracket" label="CHAVEAMENTO" />
        <NavPill to="/match" label="PARTIDA" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 auto' }}>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontFamily: 'Space Mono',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--color-d-mut)',
            }}
          >
            OVR DO TIME
          </div>
          <div
            style={{
              fontFamily: 'Anton',
              fontSize: 24,
              lineHeight: 0.9,
              color: 'var(--color-d-lime)',
            }}
          >
            {ovr ?? '—'}
          </div>
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title="Recomeçar"
            style={{
              background: 'var(--color-d-surface2)',
              border: '1px solid var(--color-d-line)',
              color: 'var(--color-d-mut)',
              borderRadius: 8,
              width: 34,
              height: 34,
              fontSize: 15,
              cursor: 'pointer',
              flex: '0 0 auto',
            }}
          >
            ↻
          </button>
        )}
      </div>
    </div>
  )
}

function NavPill({ to, label, active }: { to?: string; label: string; active?: boolean }) {
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
        className="az-navpill"
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
  return (
    <Link className="az-navpill" to={to ?? '#'} style={{ ...base, color: 'var(--color-d-mut)' }}>
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
        flex: '0 0 auto',
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
// Progress strip
// ============================================================

function ProgressStrip({
  formation,
  style,
  skipsLeft,
  filled,
}: {
  formation: string
  style: string
  skipsLeft: number
  filled: number
}) {
  const pct = (filled / 11) * 100
  return (
    <div
      className="az-strip"
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '16px 28px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
      }}
    >
      <div className="az-strip-h" style={{ fontFamily: 'Anton', fontSize: 18 }}>
        MONTANDO O TIME
      </div>
      <Chip>{formation}</Chip>
      <Chip muted>{style.toUpperCase()}</Chip>
      <Chip lime>⚄ {skipsLeft} pulos</Chip>
      <div
        className="az-stripprog"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          justifyContent: 'flex-end',
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.1em',
          }}
        >
          XI
        </span>
        <span style={{ fontFamily: 'Anton', fontSize: 18, color: 'var(--color-d-lime)' }}>
          {filled}
        </span>
        <span style={{ fontFamily: 'Anton', fontSize: 18, color: 'var(--color-d-mut)' }}>/11</span>
        <div
          className="az-bar"
          style={{
            width: 200,
            height: 7,
            borderRadius: 6,
            background: 'var(--color-d-surface2)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'var(--color-d-lime)',
              transition: 'width .4s',
            }}
          />
        </div>
      </div>
    </div>
  )
}

function Chip({
  children,
  muted,
  lime,
}: {
  children: React.ReactNode
  muted?: boolean
  lime?: boolean
}) {
  return (
    <span
      style={{
        fontFamily: 'Space Mono',
        fontSize: 11,
        fontWeight: muted ? 400 : 700,
        padding: '5px 11px',
        borderRadius: 7,
        background: lime ? 'rgba(212,255,61,0.1)' : 'var(--color-d-surface2)',
        border: `1px solid ${lime ? 'rgba(212,255,61,0.3)' : 'var(--color-d-line)'}`,
        color: lime ? 'var(--color-d-lime)' : muted ? 'var(--color-d-mut)' : 'var(--color-d-ink)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// ============================================================
// Sim bar
// ============================================================

function SimBar({
  complete,
  filled,
  onSimulate,
}: {
  complete: boolean
  filled: number
  onSimulate: () => void
}) {
  const remaining = 11 - filled
  const statusLine = complete
    ? 'XI COMPLETO — PRONTO PRA COPA'
    : `FALTAM ${remaining} ${remaining === 1 ? 'POSIÇÃO' : 'POSIÇÕES'}`
  return (
    <div
      className="az-simbar"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        borderTop: '1px solid var(--color-d-line)',
        background: 'linear-gradient(180deg, rgba(10,11,9,0.6), #0a0b09)',
        backdropFilter: 'blur(8px)',
        padding: '14px 28px',
        zIndex: 15,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div
          className="az-simtxt"
          style={{
            fontFamily: 'Space Mono',
            fontSize: 12,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.06em',
            minWidth: 0,
          }}
        >
          {statusLine}
        </div>
        {complete ? (
          <button
            type="button"
            onClick={onSimulate}
            className="az-simbtn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--color-d-lime)',
              color: 'var(--color-d-bg)',
              border: 'none',
              borderRadius: 11,
              padding: '15px 26px',
              fontFamily: 'Anton',
              fontSize: 19,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              animation: 'd26-pulse 2.4s infinite',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
            }}
          >
            SIMULAR COPA <span style={{ fontSize: 16 }}>→</span>
          </button>
        ) : (
          <div
            className="az-simbtn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--color-d-surface)',
              color: 'var(--color-d-mut)',
              border: '1px solid var(--color-d-line)',
              borderRadius: 11,
              padding: '15px 26px',
              fontFamily: 'Anton',
              fontSize: 19,
              letterSpacing: '0.02em',
              opacity: 0.6,
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
            }}
          >
            SIMULAR COPA <span style={{ fontSize: 16 }}>→</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Empty preview slots (shown behind setup sheet, no draft yet)
// ============================================================

function emptyPreviewSlots() {
  // Show a 4-3-3 silhouette while user is configuring
  return [
    { pos: 'GK' as const, x: 50, y: 5 },
    { pos: 'LB' as const, x: 15, y: 25 },
    { pos: 'CB' as const, x: 38, y: 22 },
    { pos: 'CB' as const, x: 62, y: 22 },
    { pos: 'RB' as const, x: 85, y: 25 },
    { pos: 'CDM' as const, x: 50, y: 48 },
    { pos: 'CM' as const, x: 28, y: 55 },
    { pos: 'CM' as const, x: 72, y: 55 },
    { pos: 'LW' as const, x: 18, y: 82 },
    { pos: 'ST' as const, x: 50, y: 88 },
    { pos: 'RW' as const, x: 82, y: 82 },
  ]
}

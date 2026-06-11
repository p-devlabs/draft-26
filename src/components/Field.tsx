import type { CSSProperties } from 'react'
import { SLOT_LABEL } from '../lib/positions'
import type { DraftSlot } from '../lib/draft'

interface FieldProps {
  slots: DraftSlot[]
  onSlotClick: (index: number) => void
  /** When true, slots without players show the lime "+" button instead of the faint placeholder. */
  buildPhase?: boolean
}

export function Field({ slots, onSlotClick, buildPhase = false }: FieldProps) {
  return (
    <div
      className="az-fieldcard"
      style={{
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        className="az-pitch"
        style={{
          position: 'relative',
          height: 580,
          borderRadius: 12,
          border: '1px solid var(--color-d-line)',
          overflow: 'hidden',
          background:
            'repeating-linear-gradient(0deg, #0f2014, #0f2014 46px, #0d1c12 46px, #0d1c12 92px)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(120% 80% at 50% 0%, transparent 38%, rgba(0,0,0,.5) 100%)',
          }}
        />
        <PitchMarkings />
        {slots.map((slot, i) => {
          // Codebase Y: 0 = defesa (linha de fundo), 100 = ataque adversário.
          // Pitch desenhado: GK na base → top = 100 - y.
          const top = 100 - slot.y
          return (
            <SlotChip
              key={i}
              slot={slot}
              top={top}
              left={slot.x}
              buildPhase={buildPhase}
              onClick={() => onSlotClick(i)}
            />
          )
        })}
      </div>
    </div>
  )
}

function PitchMarkings() {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 16,
          border: '2px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          top: '50%',
          height: 0,
          borderTop: '2px solid rgba(255,255,255,0.1)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 104,
          height: 104,
          border: '2px solid rgba(255,255,255,0.1)',
          borderRadius: '50%',
          transform: 'translate(-50%,-50%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '28%',
          right: '28%',
          top: 16,
          height: 62,
          border: '2px solid rgba(255,255,255,0.09)',
          borderTop: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '28%',
          right: '28%',
          bottom: 16,
          height: 62,
          border: '2px solid rgba(255,255,255,0.09)',
          borderBottom: 'none',
        }}
      />
    </>
  )
}

function SlotChip({
  slot,
  top,
  left,
  buildPhase,
  onClick,
}: {
  slot: DraftSlot
  top: number
  left: number
  buildPhase: boolean
  onClick: () => void
}) {
  const wrapStyle: CSSProperties = {
    position: 'absolute',
    left: `${left}%`,
    top: `${top}%`,
    transform: 'translate(-50%,-50%)',
    textAlign: 'center',
    width: 112,
  }

  if (slot.player) {
    return (
      <div className="az-chipwrap" style={wrapStyle}>
        <FilledChip slot={slot} />
      </div>
    )
  }
  if (buildPhase) {
    return (
      <div className="az-chipwrap" style={wrapStyle}>
        <PlusChip onClick={onClick} posLabel={SLOT_LABEL[slot.pos].toUpperCase()} />
      </div>
    )
  }
  return (
    <div className="az-chipwrap" style={wrapStyle}>
      <FaintChip posLabel={SLOT_LABEL[slot.pos].toUpperCase()} />
    </div>
  )
}

function FilledChip({ slot }: { slot: DraftSlot }) {
  const chosen = slot.player!
  const player = chosen.player
  const lastName = nameForChip(player.name)
  const ovr = player.overall
  const code = chosen.countryCode.toUpperCase()
  return (
    <div style={{ animation: 'd26-pop-in .3s ease' }}>
      <div
        className="az-chipcircle"
        style={{
          width: 54,
          height: 54,
          margin: '0 auto',
          borderRadius: '50%',
          background: 'var(--color-d-surface)',
          border: '2px solid var(--color-d-lime)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Anton',
          fontSize: 23,
          color: 'var(--color-d-lime)',
          boxShadow: '0 6px 18px -6px rgba(212,255,61,.45)',
          position: 'relative',
        }}
      >
        {player.shirt ?? '·'}
        <span
          title="Travado"
          style={{
            position: 'absolute',
            top: -3,
            right: -3,
            width: 17,
            height: 17,
            borderRadius: '50%',
            background: 'var(--color-d-lime)',
            color: 'var(--color-d-bg)',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            border: '2px solid var(--color-d-surface)',
          }}
        >
          ✓
        </span>
      </div>
      <div
        className="az-chipname"
        style={{
          fontWeight: 800,
          fontSize: 12,
          marginTop: 6,
          letterSpacing: '-0.01em',
          lineHeight: 1.1,
          textWrap: 'balance',
        }}
      >
        {lastName}
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 3 }}>
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 9,
            color: 'var(--color-d-bg)',
            background: 'var(--color-d-lime)',
            padding: '1px 6px',
            borderRadius: 4,
            fontWeight: 700,
          }}
        >
          {ovr} · {code}
        </span>
      </div>
    </div>
  )
}

function PlusChip({ onClick, posLabel }: { onClick: () => void; posLabel: string }) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        className="az-plus"
        style={{
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'rgba(212,255,61,0.07)',
          border: '2px dashed rgba(212,255,61,0.55)',
          color: 'var(--color-d-lime)',
          fontSize: 26,
          fontWeight: 300,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          transition: 'transform .15s, background .15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)'
          e.currentTarget.style.background = 'rgba(212,255,61,0.16)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.background = 'rgba(212,255,61,0.07)'
        }}
      >
        +
      </button>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 9,
          color: 'var(--color-d-mut)',
          marginTop: 6,
          letterSpacing: '0.06em',
        }}
      >
        {posLabel}
      </div>
    </div>
  )
}

function FaintChip({ posLabel }: { posLabel: string }) {
  return (
    <div style={{ opacity: 0.45 }}>
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: '50%',
          border: '1.5px dashed var(--color-d-mut)',
          margin: '0 auto',
        }}
      />
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 9,
          color: 'var(--color-d-mut)',
          marginTop: 6,
          letterSpacing: '0.06em',
        }}
      >
        {posLabel}
      </div>
    </div>
  )
}

function nameForChip(full: string): string {
  // Mostra "Vinícius Jr.", "B. Fernandes", "C. Ronaldo" — sobrenome simples + variantes
  // Compactar pra caber em ~14ch sem virar inútil.
  const trimmed = full.trim()
  if (trimmed.length <= 14) return trimmed
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]
  // último token + inicial do primeiro
  const last = parts[parts.length - 1]
  if (last.length >= 12) return last
  return `${parts[0][0]}. ${last}`
}

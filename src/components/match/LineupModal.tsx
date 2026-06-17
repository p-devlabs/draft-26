/**
 * Modal aninhada do OutcomeDrawer — mostra os 11 do XI sem trocar de rota.
 *
 * Pegamos o `DraftState` direto do `OutcomeContext` (já passado pelo drawer)
 * em vez de reler do localStorage — o drawer só monta em fim de partida e
 * o ctx daquela jogada é mais autoritativo do que o save.
 */
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { USER_TEAM_CODE, userGroup, userMatches } from '../../lib/groups'
import { nationGradient } from '../../lib/nation-colors'
import { loadBracket, loadWorldCup } from '../../lib/persistence'
import { SLOT_LABEL } from '../../lib/positions'

import type { DraftSlot, DraftState } from '../../lib/draft'

interface Props {
  draft: DraftState
  title: string
  /** Fallback se a UI da modal não tem dados — leva pro /draft?view=1 clássico. */
  fallbackTo: string
  onClose: () => void
}

/** Ordem visual do XI: GK → DEF → MID → FWD (mesma do LineupCard de partida). */
const POS_BUCKET: Record<string, number> = {
  GK: 0,
  CB: 1,
  LB: 1,
  RB: 1,
  LWB: 1,
  RWB: 1,
  CDM: 2,
  CM: 2,
  CAM: 2,
  LM: 2,
  RM: 2,
  LW: 3,
  RW: 3,
  CF: 3,
  ST: 3,
}

/**
 * Conta gols por NOME do jogador acumulando os match events salvos no
 * worldcup + bracket do localStorage. Considera goals de tempo regulamentar
 * e ET; pênaltis de shootout NÃO contam (estatística pessoal não absorve
 * cobrança decisiva).
 */
function collectUserGoalsByPlayer(): Map<string, number> {
  const map = new Map<string, number>()
  let wc, br
  try {
    wc = loadWorldCup()
  } catch {
    /* noop */
  }
  try {
    br = loadBracket()
  } catch {
    /* noop */
  }
  if (wc) {
    const stage = userGroup(wc.worldCup)
    for (const m of userMatches(stage)) {
      for (const e of m.events ?? []) {
        if (e.type === 'goal' && e.teamCode === USER_TEAM_CODE) {
          map.set(e.player, (map.get(e.player) ?? 0) + 1)
        }
      }
    }
  }
  if (br) {
    for (const m of br.matches) {
      if (m.homeCode !== br.userCode && m.awayCode !== br.userCode) continue
      for (const e of m.events ?? []) {
        if (e.type === 'goal' && e.teamCode === br.userCode) {
          map.set(e.player, (map.get(e.player) ?? 0) + 1)
        }
      }
    }
  }
  return map
}

export function LineupModal({ draft, title, fallbackTo, onClose }: Props) {
  // ESC fecha a modal aninhada — drawer pai mantém seu próprio listener,
  // mas o React já roda os listeners do filho antes (mounted depois → roda
  // primeiro). `stopPropagation` no handler do filho garante que só uma
  // camada fecha por ESC.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onClose])

  const goalsByPlayer = useMemo(() => collectUserGoalsByPlayer(), [])

  const filledSlots = draft.slots.filter((s) => s.player)
  // Sem dados: cai pra rota clássica /draft?view=1 igual ao comportamento antigo.
  if (filledSlots.length === 0) {
    return <FallbackPanel fallbackTo={fallbackTo} onClose={onClose} />
  }

  const ordered = [...filledSlots].sort((a, b) => {
    const ra = POS_BUCKET[a.pos] ?? 9
    const rb = POS_BUCKET[b.pos] ?? 9
    return ra - rb
  })

  return (
    <NestedModalShell title={title} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ordered.map((slot, i) => (
          <LineupRow
            key={`${slot.pos}-${i}`}
            slot={slot}
            goals={goalsByPlayer.get(slot.player!.player.name) ?? 0}
          />
        ))}
      </div>
    </NestedModalShell>
  )
}

function LineupRow({ slot, goals }: { slot: DraftSlot; goals: number }) {
  const player = slot.player!
  const posLabel = SLOT_LABEL[slot.pos]?.toUpperCase() ?? slot.pos
  const isGK = slot.pos === 'GK'
  const shirt = player.player.shirt

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 11,
      }}
    >
      <ShirtBadge isGK={isGK} shirt={shirt} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'Anton',
            fontSize: 16,
            color: 'var(--color-d-ink)',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.player.name}</span>
          {goals > 0 && (
            <span
              aria-label={`${goals} gol${goals > 1 ? 's' : ''} marcado${goals > 1 ? 's' : ''}`}
              style={{
                fontFamily: 'Space Mono',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-d-lime)',
                letterSpacing: '0.02em',
                flex: '0 0 auto',
              }}
            >
              ⚽ ({goals})
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 9,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.08em',
            marginTop: 2,
          }}
        >
          {slot.pos} · {posLabel}
        </div>
      </div>
      <CountryPill code={player.countryCode} />
      <OverallChip overall={player.player.overall} />
    </div>
  )
}

function ShirtBadge({ isGK, shirt }: { isGK: boolean; shirt: number | null }) {
  // GK ganha um badge "GK" pra reforçar o papel (mesmo padrão do Field). Os
  // demais usam o número da camisa; `·` quando faltar.
  const text = isGK ? 'GK' : shirt != null ? String(shirt) : '·'
  return (
    <div
      style={{
        width: 36,
        height: 36,
        flex: '0 0 auto',
        borderRadius: 9,
        background: isGK ? 'rgba(212,255,61,0.12)' : 'var(--color-d-surface)',
        border: `1px solid ${isGK ? 'var(--color-d-lime)' : 'var(--color-d-line)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Anton',
        fontSize: isGK ? 13 : 15,
        color: isGK ? 'var(--color-d-lime)' : 'var(--color-d-ink)',
        letterSpacing: isGK ? '0.04em' : 0,
      }}
    >
      {text}
    </div>
  )
}

/**
 * Pílula bandeira+sigla. Mantém o hardening do BadgeChip de Copa (PR #58):
 * borderRadius + backgroundClip:padding-box + overflow:hidden + borda
 * translúcida 1px — evita halo do gradient saindo da pílula.
 */
function CountryPill({ code }: { code: string }) {
  const c = (code ?? '').toUpperCase()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: '0 0 auto',
      }}
    >
      <div
        role="img"
        aria-label={c}
        style={{
          width: 26,
          height: 18,
          borderRadius: 5,
          background: nationGradient(c),
          backgroundClip: 'padding-box',
          border: '1px solid rgba(255,255,255,0.14)',
          overflow: 'hidden',
        }}
      />
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--color-d-mut)',
          letterSpacing: '0.06em',
        }}
      >
        {c}
      </span>
    </div>
  )
}

function OverallChip({ overall }: { overall: number }) {
  return (
    <div style={{ textAlign: 'right', flex: '0 0 auto', minWidth: 32 }}>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 8,
          color: 'var(--color-d-mut)',
          letterSpacing: '0.08em',
        }}
      >
        OVR
      </div>
      <div
        style={{
          fontFamily: 'Anton',
          fontSize: 18,
          color: 'var(--color-d-lime)',
          lineHeight: 1,
        }}
      >
        {overall}
      </div>
    </div>
  )
}

function FallbackPanel({ fallbackTo, onClose }: { fallbackTo: string; onClose: () => void }) {
  return (
    <NestedModalShell title="SEU XI" onClose={onClose}>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 12,
          color: 'var(--color-d-mut)',
          lineHeight: 1.6,
          marginBottom: 14,
        }}
      >
        Não consegui carregar o XI pra mostrar aqui. Abra a tela do draft pra revisar a escalação
        completa.
      </div>
      <Link
        to={fallbackTo}
        onClick={onClose}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-d-lime)',
          color: 'var(--color-d-bg)',
          border: '1px solid var(--color-d-lime)',
          borderRadius: 11,
          padding: 13,
          fontFamily: 'Anton',
          fontSize: 15,
          letterSpacing: '0.02em',
          textDecoration: 'none',
        }}
      >
        ABRIR TELA DO DRAFT →
      </Link>
    </NestedModalShell>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Shell compartilhada das modais aninhadas — backdrop + sheet + close button.
// Mora aqui (e re-exporta) pra não criar um terceiro arquivo só pra 60 linhas.
// ────────────────────────────────────────────────────────────────────────

export function NestedModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6,7,5,0.7)',
          backdropFilter: 'blur(2px)',
          // Acima do drawer pai (zIndex 30 backdrop / 31 sheet); fica sobre o
          // drawer mas abaixo da modal em si.
          zIndex: 40,
          animation: 'd26-fade-in .2s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 41,
          display: 'flex',
          justifyContent: 'center',
          animation: 'd26-sheet-up .28s cubic-bezier(.2,.9,.3,1)',
          pointerEvents: 'none',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          style={{
            width: '100%',
            maxWidth: 560,
            maxHeight: '86vh',
            overflowY: 'auto',
            background: 'var(--color-d-surface)',
            border: '1px solid var(--color-d-line)',
            borderBottom: 'none',
            borderRadius: '18px 18px 0 0',
            boxShadow: '0 -30px 60px -20px rgba(0,0,0,0.7)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px clamp(16px, 5vw, 24px)',
              borderBottom: '1px solid var(--color-d-line)',
              position: 'sticky',
              top: 0,
              background: 'var(--color-d-surface)',
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: 32,
                height: 4,
                borderRadius: 4,
                background: 'rgba(255,255,255,0.2)',
                position: 'absolute',
                top: 6,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
              aria-hidden="true"
            />
            <h3
              style={{
                fontFamily: 'Anton',
                fontSize: 20,
                margin: 0,
                color: 'var(--color-d-ink)',
                letterSpacing: '0.02em',
              }}
            >
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--color-d-surface2)',
                border: '1px solid var(--color-d-line)',
                color: 'var(--color-d-mut)',
                fontFamily: 'Space Mono',
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ padding: '16px clamp(16px, 5vw, 24px) 22px' }}>{children}</div>
        </div>
      </div>
    </>
  )
}

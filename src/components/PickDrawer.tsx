import { useEffect, useState } from 'react'
import { Drawer } from './Drawer'
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
  | { kind: 'idle' }
  | { kind: 'rolling' }
  | { kind: 'rolled'; squad: Squad; candidates: Player[]; skipped: number }

export function PickDrawer({
  open,
  state,
  slotIndex,
  onClose,
  onPick,
  onStateChange,
}: PickDrawerProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  // Reseta quando abre / fecha
  useEffect(() => {
    if (open) setPhase({ kind: 'idle' })
  }, [open, slotIndex])

  if (slotIndex == null) return null

  const slot = state.slots[slotIndex]
  const slotLabel = SLOT_LABEL[slot.pos]
  const canSkip = state.skipsRemaining > 0
  // No estado rolled, fechar sem decidir vira um skip implícito — bloqueia
  // o close se não tiver skips restantes.
  const drawerLocked = phase.kind === 'rolled' && !canSkip

  const handleRoll = () => {
    setPhase({ kind: 'rolling' })
    setTimeout(() => {
      try {
        const result = rollUntilCompatible(state, slotIndex)
        onStateChange(result.state)
        setPhase({
          kind: 'rolled',
          squad: result.squad,
          candidates: result.candidates,
          skipped: result.skipped.length,
        })
      } catch (err) {
        console.error(err)
        setPhase({ kind: 'idle' })
      }
    }, 420)
  }

  const handlePick = (player: Player) => {
    if (phase.kind !== 'rolled') return
    onPick(player, phase.squad)
    setPhase({ kind: 'idle' })
  }

  const handleSkip = () => {
    if (!canSkip || phase.kind !== 'rolled') return
    onStateChange(useSkip(state))
    setPhase({ kind: 'idle' })
  }

  const handleClose = () => {
    // Se rolou e ainda não escolheu, fechar gasta um skip
    if (phase.kind === 'rolled' && canSkip) {
      onStateChange(useSkip(state))
    }
    onClose()
  }

  return (
    <Drawer open={open} onClose={handleClose} locked={drawerLocked}>
      <div className="px-6 pb-8 pt-2 max-w-2xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-clay">Posição {slot.pos}</p>
            <h2 className="font-display text-3xl text-ink">{slotLabel}</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            <span>
              <span className="font-mono tabular-nums text-ink">
                {state.skipsRemaining}
              </span>
              /{state.skipsTotal} skip{state.skipsTotal === 1 ? '' : 's'}
            </span>
            {!drawerLocked && (
              <button
                type="button"
                onClick={handleClose}
                className="hover:text-ink text-sm"
                aria-label="Fechar"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {phase.kind === 'idle' && (
          <div className="py-8">
            <p className="text-ink-soft text-sm mb-6">
              Role o dado e veja qual seleção entra na disputa por essa vaga.
              Países sorteados ficam fora dos próximos 5 lances.
            </p>
            <button
              type="button"
              onClick={handleRoll}
              className="w-full h-14 rounded-md bg-clay text-paper font-medium hover:bg-ink transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-2xl">🎲</span>
              Rolar o dado
            </button>
          </div>
        )}

        {phase.kind === 'rolling' && (
          <div className="py-16 flex flex-col items-center">
            <div className="text-6xl animate-spin">🎲</div>
            <p className="mt-4 text-ink-soft text-sm">Sorteando…</p>
          </div>
        )}

        {phase.kind === 'rolled' && (
          <RolledView
            squad={phase.squad}
            candidates={phase.candidates}
            skipped={phase.skipped}
            canSkip={canSkip}
            onPick={handlePick}
            onSkip={handleSkip}
          />
        )}
      </div>
    </Drawer>
  )
}

function RolledView({
  squad,
  candidates,
  skipped,
  canSkip,
  onPick,
  onSkip,
}: {
  squad: Squad
  candidates: Player[]
  skipped: number
  canSkip: boolean
  onPick: (p: Player) => void
  onSkip: () => void
}) {
  const sorted = [...candidates].sort((a, b) => b.overall - a.overall)

  return (
    <div className="pb-4">
      <div className="border border-rule rounded-lg p-4 mb-5 bg-sand/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{squad.flag}</span>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">
                Sele&ccedil;&atilde;o sorteada · Grupo {squad.group}
              </p>
              <h3 className="font-display text-2xl text-ink">{squad.country}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onSkip}
            disabled={!canSkip}
            className="text-xs px-3 py-1.5 rounded-md border border-rule text-ink
              hover:border-ink hover:bg-paper transition-all
              disabled:text-ink-soft disabled:border-rule disabled:cursor-not-allowed"
            title={canSkip ? 'Gasta um skip e sorteia outra seleção' : 'Sem skips restantes'}
          >
            Pular ↻
          </button>
        </div>
        {skipped > 0 && (
          <p className="mt-3 text-xs text-ink-soft">
            ({skipped} {skipped === 1 ? 'seleção pulada por' : 'seleções puladas por'} não ter
            jogador compatível com a posição)
          </p>
        )}
      </div>

      <p className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-3">
        Escolha um — sua escolha é definitiva
      </p>

      <ul className="space-y-1.5">
        {sorted.map((p) => (
          <li key={p.name + p.shirt}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="w-full text-left flex items-center gap-3 p-3 rounded-md
                border border-rule hover:border-ink hover:bg-sand transition-all"
            >
              <span className="text-xs font-mono text-ink-soft w-6 text-right tabular-nums">
                {p.shirt ?? '—'}
              </span>
              <span className="font-mono text-[11px] text-ink-soft w-12">
                {p.primaryPosition ?? p.position}
              </span>
              <span className="flex-1">
                <div className="text-ink text-sm font-medium">
                  {p.name}
                  {p.isCaptain && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-clay">cap</span>
                  )}
                </div>
                <div className="text-xs text-ink-soft truncate">{p.club}</div>
              </span>
              <span className="font-display text-2xl text-ink tabular-nums">{p.overall}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

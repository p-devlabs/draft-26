import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SetupDrawer } from '../components/SetupDrawer'
import { PickDrawer } from '../components/PickDrawer'
import { Field } from '../components/Field'
import { DraftSummary } from './DraftSummary'
import {
  averageOverall,
  createDraft,
  eligibleCountries,
  isComplete,
  pickPlayer,
  type DraftState,
} from '../lib/draft'
import { autoFillXI } from '../lib/autofill'
import { features } from '../lib/features'
import type { Difficulty, Style } from '../lib/formations'

export function Draft() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [pickingSlot, setPickingSlot] = useState<number | null>(null)

  const handleStart = (formationName: string, style: Style, difficulty: Difficulty) => {
    setDraft(createDraft(formationName, style, difficulty))
  }

  if (!draft) {
    return (
      <div className="min-h-[calc(100vh-7rem)] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-sm uppercase tracking-[0.18em] text-clay mb-3">Draft</p>
          <h1 className="font-display text-4xl text-ink mb-4">Monte seu XI</h1>
          <p className="text-ink-soft mb-8">
            48 seleções, 11 vagas. Você escolhe a tática, sorteia o dado posição por posição
            e cria o time dos sonhos.
          </p>
        </div>
        <SetupDrawer open onStart={handleStart} />
      </div>
    )
  }

  if (isComplete(draft)) {
    return <DraftSummary state={draft} onReset={() => setDraft(null)} />
  }

  const filled = draft.slots.filter((s) => s.player).length
  const cooldown = draft.rolledCountries.slice(-5)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-clay mb-1">
            {draft.formationName} · {draft.style}
          </p>
          <h1 className="font-display text-2xl text-ink">
            <span className="tabular-nums">{filled}/11</span> escalados
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-xs text-ink-soft hover:text-ink"
        >
          ← Sair
        </button>
      </div>

      <Field slots={draft.slots} onSlotClick={(i) => setPickingSlot(i)} />

      {features.dev && filled < 11 && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setDraft(autoFillXI(draft))}
            className="text-xs px-3 py-1.5 rounded border border-dashed border-clay text-clay hover:bg-clay-soft transition-colors"
          >
            ⚡ dev · preencher todos
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <StatBlock label="Rating médio" value={averageOverall(draft).toFixed(1)} />
        <StatBlock
          label="Skips"
          value={`${draft.skipsRemaining}/${draft.skipsTotal}`}
        />
        <StatBlock
          label="Em cooldown"
          value={cooldown.length > 0 ? cooldown.join(' · ') : '—'}
          mono
        />
        <StatBlock
          label="Países restantes"
          value={String(eligibleCountries(draft).length)}
        />
      </div>

      <PickDrawer
        open={pickingSlot != null}
        slotIndex={pickingSlot}
        state={draft}
        onClose={() => setPickingSlot(null)}
        onStateChange={setDraft}
        onPick={(player, squad) => {
          if (pickingSlot == null) return
          setDraft(pickPlayer(draft, pickingSlot, player, squad))
          setPickingSlot(null)
        }}
      />
    </div>
  )
}

function StatBlock({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-t border-rule pt-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft mb-1">{label}</p>
      <p className={`text-ink ${mono ? 'font-mono text-xs' : 'font-display text-lg'}`}>{value}</p>
    </div>
  )
}

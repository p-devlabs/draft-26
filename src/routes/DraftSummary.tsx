import { useNavigate } from 'react-router-dom'
import { Field } from '../components/Field'
import { averageOverall, totalValueEur, type DraftState } from '../lib/draft'
import { saveDraft } from '../lib/persistence'

interface DraftSummaryProps {
  state: DraftState
  onReset: () => void
}

export function DraftSummary({ state, onReset }: DraftSummaryProps) {
  const navigate = useNavigate()
  const totalValue = totalValueEur(state)
  const countries = [...new Set(state.slots.map((s) => s.player?.countryFlag).filter(Boolean))]

  const handlePlayCup = () => {
    saveDraft(state)
    navigate('/copa')
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="text-sm uppercase tracking-[0.18em] text-clay mb-2">XI completo</p>
        <h1 className="font-display text-4xl md:text-5xl tracking-tight text-ink mb-3">
          Seu time tá em campo
        </h1>
        <p className="text-ink-soft max-w-xl">
          Onze jogadores de {countries.length} seleções diferentes. Tática {state.formationName},
          estilo {state.style}.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-10 items-start">
        <Field slots={state.slots} onSlotClick={() => {}} />

        <div>
          <div className="grid grid-cols-2 gap-6 mb-8 pb-6 border-b border-rule">
            <Stat label="Rating médio" value={averageOverall(state).toFixed(1)} big />
            <Stat label="Valor total" value={formatBigEur(totalValue)} />
            <Stat label="Formação · Estilo" value={`${state.formationName} · ${capitalize(state.style)}`} />
            <Stat
              label="Dificuldade"
              value={`${capitalize(state.difficulty)} (${state.skipsTotal - state.skipsRemaining}/${state.skipsTotal} skips)`}
            />
          </div>

          <h2 className="font-display text-xl text-ink mb-3">XI titular</h2>
          <ul className="space-y-1.5">
            {state.slots.map((slot, i) => (
              <li
                key={i}
                className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-sand"
              >
                <span className="font-mono text-[11px] text-ink-soft w-10">{slot.pos}</span>
                <span className="text-xl">{slot.player?.countryFlag}</span>
                <span className="flex-1">
                  <span className="text-ink text-sm font-medium">{slot.player?.player.name}</span>
                  <span className="block text-xs text-ink-soft truncate">
                    {slot.player?.countryName} · {slot.player?.player.club}
                  </span>
                </span>
                <span className="font-display text-xl text-ink tabular-nums">
                  {slot.player?.player.overall}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 pt-6 border-t border-rule">
            <button
              type="button"
              onClick={handlePlayCup}
              className="w-full h-12 rounded-md bg-ink text-paper text-sm font-medium hover:bg-clay transition-colors"
            >
              Disputar a Copa →
            </button>
            <button
              type="button"
              onClick={onReset}
              className="mt-2 w-full h-10 rounded-md border border-rule text-ink text-sm hover:bg-sand transition-colors"
            >
              Novo draft
            </button>
            <p className="text-xs text-ink-soft text-center mt-4">
              Seu XI vai substituir o time mais fraco de um grupo sorteado da Copa de 2026.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-1">{label}</p>
      <p className={`font-display text-ink ${big ? 'text-4xl' : 'text-xl'}`}>{value}</p>
    </div>
  )
}

function formatBigEur(eur: number): string {
  if (eur >= 1_000_000_000) return `€${(eur / 1_000_000_000).toFixed(2)}B`
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(0)}M`
  return `€${eur.toLocaleString('pt-BR')}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

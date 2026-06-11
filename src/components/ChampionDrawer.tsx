import { Drawer } from './Drawer'
import { Field } from './Field'
import { ROUND_LABEL, userPath, type KnockoutBracket } from '../lib/bracket'
import type { DraftState } from '../lib/draft'
import { averageOverall } from '../lib/draft'

interface Props {
  open: boolean
  onClose: () => void
  bracket: KnockoutBracket
  draft: DraftState
}

export function ChampionDrawer({ open, onClose, bracket, draft }: Props) {
  const games = userPath(bracket).filter((m) => m.result || m.winnerCode)
  const totalFor = games.reduce((s, m) => {
    const userIsHome = m.homeCode === bracket.userCode
    const reg = userIsHome ? m.result?.homeGoals ?? 0 : m.result?.awayGoals ?? 0
    const et = userIsHome ? m.extraTime?.homeGoals ?? 0 : m.extraTime?.awayGoals ?? 0
    return s + reg + et
  }, 0)
  const totalAgainst = games.reduce((s, m) => {
    const userIsHome = m.homeCode === bracket.userCode
    const reg = userIsHome ? m.result?.awayGoals ?? 0 : m.result?.homeGoals ?? 0
    const et = userIsHome ? m.extraTime?.awayGoals ?? 0 : m.extraTime?.homeGoals ?? 0
    return s + reg + et
  }, 0)
  const cleanSheets = games.filter((m) => {
    const userIsHome = m.homeCode === bracket.userCode
    const against = (userIsHome ? m.result?.awayGoals ?? 0 : m.result?.homeGoals ?? 0) +
      (userIsHome ? m.extraTime?.awayGoals ?? 0 : m.extraTime?.homeGoals ?? 0)
    return against === 0
  }).length

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="px-6 pb-12 pt-2 max-w-3xl mx-auto">
        <div className="text-center mb-8 pt-4">
          <div className="text-7xl mb-3">🏆</div>
          <p className="text-sm uppercase tracking-[0.18em] text-clay mb-2">Campeão da Copa 2026</p>
          <h2 className="font-display text-4xl text-ink mb-2">Seu XI levantou a taça</h2>
          <p className="text-ink-soft text-sm">
            5 jogos, {totalFor} gols marcados, {cleanSheets} jogos sem sofrer.{' '}
            Rating médio do XI: {averageOverall(draft).toFixed(1)}.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 text-ink-soft hover:text-ink text-lg"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 p-4 rounded-lg border border-rule bg-clay-soft/40 mb-6">
          <Stat label="Jogos" value={games.length} />
          <Stat label="GP" value={totalFor} tone="moss" />
          <Stat label="GC" value={totalAgainst} />
          <Stat label="No goal" value={cleanSheets} tone="moss" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <section>
            <h3 className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-3">
              Caminho do título
            </h3>
            <ul className="space-y-2">
              {games.map((m) => (
                <ChampionPathRow key={m.id} match={m} bracket={bracket} />
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-3">
              Os 11 que fizeram história
            </h3>
            <Field slots={draft.slots} onSlotClick={() => {}} />
          </section>
        </div>
      </div>
    </Drawer>
  )
}

function ChampionPathRow({
  match,
  bracket,
}: {
  match: ReturnType<typeof userPath>[number]
  bracket: KnockoutBracket
}) {
  const userIsHome = match.homeCode === bracket.userCode
  const oppCode = userIsHome ? match.awayCode! : match.homeCode!
  const opp = bracket.teams[oppCode]
  const my = (userIsHome ? match.result?.homeGoals ?? 0 : match.result?.awayGoals ?? 0) +
    (userIsHome ? match.extraTime?.homeGoals ?? 0 : match.extraTime?.awayGoals ?? 0)
  const their = (userIsHome ? match.result?.awayGoals ?? 0 : match.result?.homeGoals ?? 0) +
    (userIsHome ? match.extraTime?.awayGoals ?? 0 : match.extraTime?.homeGoals ?? 0)
  return (
    <li className="flex items-center justify-between p-3 border border-moss/30 rounded bg-moss/5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-soft w-16">
          {ROUND_LABEL[match.round]}
        </span>
        <span className="text-xl">{opp.flag}</span>
        <span className="text-sm text-ink truncate">{opp.name}</span>
      </div>
      <span className="font-display text-base tabular-nums text-moss">
        {my} × {their}
        {match.penalties && <span className="text-[10px] text-ink-soft ml-1">(pen)</span>}
      </span>
    </li>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone?: 'moss' | 'clay'
}) {
  const color = tone === 'moss' ? 'text-moss' : tone === 'clay' ? 'text-clay' : 'text-ink'
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-soft mb-1">{label}</div>
      <div className={`font-display text-2xl tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

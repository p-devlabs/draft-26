import { Drawer } from './Drawer'
import { Field } from './Field'
import {
  ROUND_LABEL,
  userEliminator,
  userPath,
  type KnockoutBracket,
  type KORound,
} from '../lib/bracket'
import type { DraftState } from '../lib/draft'

interface Props {
  open: boolean
  onClose: () => void
  bracket: KnockoutBracket
  draft: DraftState
}

export function KnockoutEliminationDrawer({ open, onClose, bracket, draft }: Props) {
  const games = userPath(bracket).filter((m) => m.result || m.winnerCode)
  const elim = userEliminator(bracket)
  const elimMatch = elim
  const wins = games.filter((m) => m.winnerCode === bracket.userCode).length
  const losses = games.length - wins

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

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="px-6 pb-10 pt-2 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-clay">Eliminado</p>
            <h2 className="font-display text-3xl text-ink">
              Parou nas {elimMatch ? ROUND_LABEL[elimMatch.round as KORound] : 'eliminatórias'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-soft hover:text-ink text-lg"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {elimMatch && <EliminatorCard match={elimMatch} bracket={bracket} />}

        <div className="grid grid-cols-4 gap-3 mt-6 p-4 rounded-lg border border-rule bg-sand/40">
          <Stat label="Jogos" value={games.length} />
          <Stat label="V" value={wins} tone="moss" />
          <Stat label="D" value={losses} tone="clay" />
          <Stat label="GP-GC" value={`${totalFor}-${totalAgainst}`} />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <section>
            <h3 className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-3">
              Seu caminho
            </h3>
            <ul className="space-y-2">
              {games.map((m) => (
                <PathRow key={m.id} match={m} bracket={bracket} />
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-3">
              Sua escalação
            </h3>
            <Field slots={draft.slots} onSlotClick={() => {}} />
          </section>
        </div>
      </div>
    </Drawer>
  )
}

function EliminatorCard({
  match,
  bracket,
}: {
  match: ReturnType<typeof userEliminator>
  bracket: KnockoutBracket
}) {
  if (!match) return null
  const userIsHome = match.homeCode === bracket.userCode
  const oppCode = userIsHome ? match.awayCode! : match.homeCode!
  const opp = bracket.teams[oppCode]
  const myReg = userIsHome ? match.result?.homeGoals ?? 0 : match.result?.awayGoals ?? 0
  const oppReg = userIsHome ? match.result?.awayGoals ?? 0 : match.result?.homeGoals ?? 0
  const myET = userIsHome ? match.extraTime?.homeGoals ?? 0 : match.extraTime?.awayGoals ?? 0
  const oppET = userIsHome ? match.extraTime?.awayGoals ?? 0 : match.extraTime?.homeGoals ?? 0
  const myPen = userIsHome ? match.penalties?.homeScored : match.penalties?.awayScored
  const oppPen = userIsHome ? match.penalties?.awayScored : match.penalties?.homeScored

  return (
    <div className="p-4 rounded-lg border-2 border-clay/40 bg-clay-soft/30">
      <p className="text-xs uppercase tracking-[0.14em] text-clay mb-2">
        Quem te eliminou
      </p>
      <div className="flex items-center justify-between gap-4">
        <div className="text-center flex-1">
          <div className="text-3xl">⚡</div>
          <div className="text-xs text-ink-soft mt-1">Seu XI</div>
        </div>
        <div className="text-center">
          <div className="font-display text-3xl text-ink tabular-nums">
            {myReg + myET} × {oppReg + oppET}
          </div>
          {match.penalties && (
            <div className="text-[10px] text-ink-soft mt-1">
              pen {myPen}-{oppPen}
            </div>
          )}
        </div>
        <div className="text-center flex-1">
          <div className="text-3xl">{opp.flag}</div>
          <div className="text-xs text-ink mt-1">{opp.name}</div>
        </div>
      </div>
    </div>
  )
}

function PathRow({
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
  const won = match.winnerCode === bracket.userCode
  return (
    <li className="flex items-center justify-between p-3 border border-rule rounded">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-soft w-16">
          {ROUND_LABEL[match.round]}
        </span>
        <span className="text-xl">{opp.flag}</span>
        <span className="text-sm text-ink truncate">{opp.name}</span>
      </div>
      <span className={`font-display text-base tabular-nums ${won ? 'text-moss' : 'text-clay'}`}>
        {my} × {their}
        {match.penalties && (
          <span className="text-[10px] text-ink-soft ml-1">
            (pen)
          </span>
        )}
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

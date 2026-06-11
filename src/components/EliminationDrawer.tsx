import { Drawer } from './Drawer'
import { Field } from './Field'
import {
  findTeam,
  standings,
  USER_TEAM_CODE,
  type GroupMatch,
  type GroupStage,
} from '../lib/groups'
import type { DraftState } from '../lib/draft'
import type { Standing } from '../lib/groups'

interface EliminationDrawerProps {
  open: boolean
  onClose: () => void
  draft: DraftState
  stage: GroupStage
}

export function EliminationDrawer({ open, onClose, draft, stage }: EliminationDrawerProps) {
  const sorted = standings(stage)
  const userRow = sorted.find((s) => s.team.isUser)!
  const position = sorted.findIndex((s) => s.team.isUser) + 1
  const userMatches = stage.matches.filter(
    (m) => m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE,
  )

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="px-6 pb-10 pt-2 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-clay">Eliminado</p>
            <h2 className="font-display text-3xl text-ink">
              {position}º lugar no Grupo {stage.letter}
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

        <StatsCard standing={userRow} />

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <section>
            <h3 className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-3">
              Sua escalação
            </h3>
            <Field slots={draft.slots} onSlotClick={() => {}} />
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-3">
              Seus três jogos
            </h3>
            <ul className="space-y-2">
              {userMatches.map((m) => (
                <MatchRow key={`${m.round}`} match={m} stage={stage} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Drawer>
  )
}

function StatsCard({ standing }: { standing: Standing }) {
  const sg = standing.goalsFor - standing.goalsAgainst
  return (
    <div className="grid grid-cols-5 gap-2 p-4 rounded-lg border border-rule bg-sand/40">
      <Stat label="V" value={standing.wins} tone="moss" />
      <Stat label="E" value={standing.draws} />
      <Stat label="D" value={standing.losses} tone="clay" />
      <Stat label="GP" value={standing.goalsFor} />
      <Stat label="GC" value={standing.goalsAgainst} />
      <div className="col-span-5 pt-3 mt-1 border-t border-rule/60 flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.14em] text-ink-soft">Saldo</span>
        <span
          className={`font-display text-2xl tabular-nums ${
            sg > 0 ? 'text-moss' : sg < 0 ? 'text-clay' : 'text-ink-soft'
          }`}
        >
          {sg > 0 ? '+' : ''}
          {sg}
        </span>
        <span className="text-xs uppercase tracking-[0.14em] text-ink-soft">Pontos</span>
        <span className="font-display text-2xl text-ink tabular-nums">{standing.points}</span>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
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

function MatchRow({ match, stage }: { match: GroupMatch; stage: GroupStage }) {
  const home = findTeam(stage, match.homeCode)!
  const away = findTeam(stage, match.awayCode)!
  const userIsHome = home.code === USER_TEAM_CODE
  const userGoals = userIsHome ? match.result?.homeGoals : match.result?.awayGoals
  const oppGoals = userIsHome ? match.result?.awayGoals : match.result?.homeGoals
  const won = userGoals != null && oppGoals != null && userGoals > oppGoals
  const drew = userGoals === oppGoals
  const tone = won ? 'text-moss' : drew ? 'text-ink-soft' : 'text-clay'
  const opp = userIsHome ? away : home
  return (
    <li className="flex items-center justify-between p-3 border border-rule rounded">
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-soft w-12">
          Rod {match.round}
        </span>
        <span className="text-xl">{opp.flag}</span>
        <span className="text-sm text-ink">{opp.name}</span>
      </div>
      <span className={`font-display text-lg tabular-nums ${tone}`}>
        {userGoals} × {oppGoals}
      </span>
    </li>
  )
}

import { useNavigate } from 'react-router-dom'
import {
  isHalfMatch,
  ROUND_LABEL,
  ROUND_ORDER,
  userHalfOf,
  type BracketMatch,
  type KnockoutBracket,
  type KORound,
} from '../lib/bracket'

interface BracketViewProps {
  bracket: KnockoutBracket
}

export function BracketView({ bracket }: BracketViewProps) {
  const userHalf = userHalfOf(bracket)
  // Marca matches do caminho do user pra destacar
  const userPath = new Set<string>()
  for (const m of bracket.matches) {
    if (m.homeCode === bracket.userCode || m.awayCode === bracket.userCode) {
      userPath.add(m.id)
    }
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-2">
      <div className="grid grid-flow-col auto-cols-[minmax(220px,1fr)] gap-6 min-w-[1100px]">
        {ROUND_ORDER.map((round) => {
          const matches = bracket.matches
            .filter((m) => m.round === round)
            .filter((m) => isHalfMatch(m, userHalf))
          return (
            <BracketColumn
              key={round}
              round={round}
              matches={matches}
              bracket={bracket}
              userPath={userPath}
            />
          )
        })}
      </div>
    </div>
  )
}

function BracketColumn({
  round,
  matches,
  bracket,
  userPath,
}: {
  round: KORound
  matches: BracketMatch[]
  bracket: KnockoutBracket
  userPath: Set<string>
}) {
  // Espaçamento vertical cresce conforme avança
  const roundIdx = ROUND_ORDER.indexOf(round)
  const gapStep = Math.pow(2, roundIdx)
  const baseGap = 8

  return (
    <div className="flex flex-col">
      <div className="text-xs uppercase tracking-[0.18em] text-clay mb-3 text-center">
        {ROUND_LABEL[round]}
        <span className="ml-2 text-ink-soft">·{matches.length}</span>
      </div>
      <div
        className="flex-1 flex flex-col justify-around"
        style={{ gap: `${baseGap * gapStep}px` }}
      >
        {matches.map((m) => (
          <BracketCard key={m.id} match={m} bracket={bracket} highlight={userPath.has(m.id)} />
        ))}
      </div>
    </div>
  )
}

function BracketCard({
  match,
  bracket,
  highlight,
}: {
  match: BracketMatch
  bracket: KnockoutBracket
  highlight: boolean
}) {
  const navigate = useNavigate()
  const home = match.homeCode ? bracket.teams[match.homeCode] : null
  const away = match.awayCode ? bracket.teams[match.awayCode] : null
  const isUserMatch =
    match.homeCode === bracket.userCode || match.awayCode === bracket.userCode
  const userWon = match.winnerCode === bracket.userCode
  const userLost = isUserMatch && match.winnerCode && match.winnerCode !== bracket.userCode
  const playable = isUserMatch && !match.winnerCode && home && away

  const totalHome = (match.result?.homeGoals ?? 0) + (match.extraTime?.homeGoals ?? 0)
  const totalAway = (match.result?.awayGoals ?? 0) + (match.extraTime?.awayGoals ?? 0)

  const winnerSide: 'home' | 'away' | null = match.winnerCode
    ? match.winnerCode === match.homeCode
      ? 'home'
      : 'away'
    : null

  return (
    <div
      className={`rounded-md border bg-paper text-xs transition-colors ${
        highlight ? 'border-ink shadow-sm' : 'border-rule'
      } ${userWon ? 'ring-1 ring-moss/50' : ''} ${userLost ? 'opacity-60' : ''}`}
    >
      <Side
        team={home}
        score={match.result ? totalHome : null}
        won={winnerSide === 'home'}
        isUser={home?.isUser}
      />
      <div className="h-px bg-rule" />
      <Side
        team={away}
        score={match.result ? totalAway : null}
        won={winnerSide === 'away'}
        isUser={away?.isUser}
      />
      {match.penalties && (
        <div className="px-3 pb-2 text-[10px] text-ink-soft text-center">
          pen {match.penalties.homeScored}-{match.penalties.awayScored}
        </div>
      )}
      {playable && (
        <button
          type="button"
          onClick={() => navigate(`/copa/partida?kind=knockout&id=${match.id}`)}
          className="block w-full text-[11px] font-medium py-1.5 bg-ink text-paper rounded-b-md hover:bg-clay transition-colors"
        >
          Jogar →
        </button>
      )}
    </div>
  )
}

function Side({
  team,
  score,
  won,
  isUser,
}: {
  team: { name: string; flag: string; seed: number } | null
  score: number | null
  won: boolean
  isUser?: boolean
}) {
  if (!team) {
    return (
      <div className="px-3 py-2 text-ink-soft/50 italic flex items-center gap-2">
        <span className="text-base opacity-30">？</span>
        <span>Aguardando</span>
      </div>
    )
  }
  return (
    <div
      className={`px-3 py-2 flex items-center gap-2 ${
        won ? 'text-ink font-medium' : 'text-ink-soft'
      } ${isUser ? 'bg-clay-soft/40' : ''}`}
    >
      <span className="font-mono text-[10px] text-ink-soft w-5 text-right">{team.seed}</span>
      <span className="text-base leading-none">{team.flag}</span>
      <span className="flex-1 truncate">{team.name}</span>
      {score != null && (
        <span className="font-display text-base tabular-nums">{score}</span>
      )}
    </div>
  )
}
